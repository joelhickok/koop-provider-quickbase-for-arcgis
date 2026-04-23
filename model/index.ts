import dotenvx from '@dotenvx/dotenvx'
import {QuickBase, type  QuickBaseOptions} from 'quickbase'
import {type Request} from 'express'
import bbox from '@turf/bbox'
import {toSnakeCase, queryTable} from '../utils/index.ts'
import {ConfigurationError} from '../utils/errors.ts'

// types
import * as types from '../types/common.ts'
import type {QuickBaseResponseGetFields,} from 'quickbase'
import type {FeatureCollection, Feature, Geometry, GeoJsonProperties} from 'geojson'

dotenvx.config()

export class Model {
    logger

    // @ts-ignore
    constructor({logger},) {
        this.logger = logger
    }

    // Koop is not happy if we provide an async getData function (uses Promisify under the hood)
    // So we are forced (below) to nest async logic in a Promise - see below
    getData(req: Request, callback: Function) {

        const geoserviceParams = req.query

        console.log('geoserviceParams')
        console.log(geoserviceParams)

        // get the tableId and the appId, which come concatenated by a '-'
        const idParameters: string = req.params.id as string
        const [appId, tableId] = idParameters?.split('-')

        // if a select query was pased, parse it and map to numbers for QB FIDs
        const selectQuery = req.query?.select ? req.query?.select as string : null

        // build key parameters from req.params and req.query
        const PARAMS: types.ILocalParams = {
            realm: req.params.host as string,
            appId,
            tableId,
            select: selectQuery?.split(',').map(d => Number(d)),
            coordinatesFID: req.query?.coords_fid as string || '9',
            isQuery: req.route.path.includes(':layer'),
        }

        const qbOptions: QuickBaseOptions = {
            realm: PARAMS.realm,
        }

        if (process.env.QB_TOKEN) {
            qbOptions.userToken = process.env.QB_TOKEN
        } else {
            const message = `The Quickbase User Token is not set in the environment file.  Set a key/value combo named: 'QB_TOKEN'`
            const error = new ConfigurationError(message)
            console.log(`${error.name}: ${error.message}`)
            return callback(error)
        }

        const quickbase = new QuickBase(qbOptions)

        // nest logic inside a Promise so we can use async/await
        new Promise(async () => {

            let rawData: any[]

            const {name: tableName} = await quickbase.getTable({
                appId,
                tableId,
            })

            const description =
                `This layer pulls data from the Quickbase Realm named '${qbOptions.realm}' with`
                + ` the App ID of ${PARAMS.appId} and`
                + ` the Table ID of ${PARAMS.tableId}.  Learn more at:`
                + ` https://${qbOptions.realm}.quickbase.com/nav/app/${PARAMS.appId}/table/${PARAMS.tableId}`

            // Create custom FeatureCollection extended for Koop
            const geojsonResponse: types.KoopCollection = {
                type: 'FeatureCollection',
                features: [],
                metadata: {
                    geometryType: 'Point',
                    title: tableName,
                    name: tableName,
                    id: PARAMS.tableId,
                    description,
                    displayField: 'name',
                    idField: 'record_id',
                    maxRecordCount: 1000,
                },
            }

            let fields: QuickBaseResponseGetFields[] = await quickbase.getFields({
                tableId,
            }).then((fields: QuickBaseResponseGetFields) => {
                // filter QB field formula types
                const filtered = fields.filter((f) => f.mode !== 'formula')
                return filtered as unknown as QuickBaseResponseGetFields[]
            })

            // geojsonResponse.metadata.geometryType = _.get(geojson, 'features[0].geometry.type')

            if (PARAMS.select) {
                // If the URL contains a list of fields to 'select' in the query
                /// then use that list
                rawData = await queryTable({
                    quickbase,
                    tableId,
                    select: PARAMS.select,
                })
            } else {
                // If the user did not pass a list to select in the query, then
                // map the field IDs so we can use them to select data as part of the query
                const select = fields.map((f: QuickBaseResponseGetFields):number => f.id)

                // make the actual table query
                rawData = await queryTable({
                    quickbase,
                    tableId,
                    select,
                })

                // Translate to uniform GeoJSON Feature Collection
                geojsonResponse.features = rawData.map((record: types.QuickbaseRecord): Feature<Geometry, GeoJsonProperties> => {
                    // console.log(record)

                    const properties: { [key: string]: any; } = {
                        realm: PARAMS.realm,
                        appId: PARAMS.appId,
                        tableId: PARAMS.tableId,
                    }

                    // map the Quickbase field names to the GeoJSON Feature properties
                    // use snake_case to rename the original field names

                    fields
                        .forEach((field: QuickBaseResponseGetFields) => {
                            // console.log(field)
                            // console.log(record[field.id])
                            const label = toSnakeCase(field.label as string)

                            if (field.fieldType === 'user') {
                                // field type user is an object with a name property
                                // @ts-ignore
                                properties[label] = record[field.id].value.name
                            } else {
                                // other fields have the value directly on the 'value' property
                                properties[label] = record[field.id].value
                            }

                        })

                    // Get the coordinates value using the pre-defined ID and map the value
                    // @ts-ignore
                    const coordinatesValue: string = record[PARAMS.coordinatesFID].value
                    const coordinatesMapped: number[] = coordinatesValue
                        .split(',')
                        .map((r: string) => Number(r.trim()))
                        .reverse() // GeoJSON wants Lng before Lat

                    // return the actual GeoJSON Feature object
                    // with full geometry property and properties
                    return {
                        type: 'Feature',
                        id: record[3].value,
                        geometry: {
                            type: 'Point',
                            coordinates: coordinatesMapped,     // 4326
                        },
                        properties,
                    }
                })
            }

            const bboxFlat = bbox(geojsonResponse as FeatureCollection)
            // console.log(bboxFlat)

            geojsonResponse.metadata.extent = [
                [bboxFlat[2], bboxFlat[3]],
                [bboxFlat[0], bboxFlat[1]],
            ]
            // console.log(geojsonResponse.metadata.extent)

            //[ -122.03098, 34.75087, -105.99234, 46.24871 ]
            // 	[[180,90],[-180,-90]]

            geojsonResponse.metadata.limitExceeded = geojsonResponse.features.length > geojsonResponse.metadata.maxRecordCount

            const mapFieldTypes = (type: string) => {
                switch (type) {
                    case 'text-multi-line':
                        return 'String'
                    case 'text':
                        return 'String'
                    case 'numeric':
                        return 'Double'
                    case 'recordid':
                        return 'Integer'
                    case 'date':
                        return 'Date'
                    default:
                        return 'String'
                }
            }

            geojsonResponse.metadata.fields = fields.map(f => {
                return {
                    name: toSnakeCase(f.label),
                    type: mapFieldTypes(f.fieldType),
                    alias: f.label,
                    // length: f.properties.width || null,
                }
            })

            return callback(null, geojsonResponse)
        })

    }

}

export default Model