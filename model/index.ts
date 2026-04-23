import dotenvx from '@dotenvx/dotenvx'
import {QuickBase, type  QuickBaseOptions} from 'quickbase'
import {type Request} from 'express'
import {type FeatureCollection} from 'geojson'

import {toSnakeCase, queryTable} from '../utils/index.ts'
import {ConfigurationError} from '../utils/errors.ts'

type QuickbaseRecord = Record<string, {
    value: any | { name: string };
}>[]

interface KoopCollection extends FeatureCollection {
    metadata: Record<string, any>,
}

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
        const PARAMS = {
            realm: req.params.host as string,
            appId,
            tableId,
            select: selectQuery?.split(',').map(d => Number(d)),
            coordinatesFID: req.query?.coords_fid as string || '9',
            isQuery: req.route.path.includes(':layer'),
            tableInfo: undefined,
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

            let rawData = []

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
            const geojsonResponse: KoopCollection = {
                type: 'FeatureCollection',
                features: [],
                metadata: {
                    geometryType: 'Point',
                    title: tableName,
                    name: tableName,
                    id: PARAMS.tableId,
                    description,
                },
            }

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
                // request the full list of fields available for this Quickbase table
                const fields = await quickbase.getFields({
                    tableId,
                })

                // Map the field IDs so we can use them to select data as part of the query
                const select = fields.map(f => f.id)

                // make the actual table query
                rawData = await queryTable({
                    quickbase,
                    tableId,
                    select,
                })

                // Translate to uniform GeoJSON Feature Collection
                geojsonResponse.features = rawData.map((record: QuickbaseRecord) => {
                    // console.log(record)

                    const properties: { [key: string]: any; } = {
                        realm: PARAMS.realm,
                        appId: PARAMS.appId,
                        tableId: PARAMS.tableId,
                    }

                    // map the Quickbase field names to the GeoJSON Feature properties
                    // use snake_case to rename the original field names
                    fields.forEach(field => {
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
            return callback(null, geojsonResponse)
        })

    }

}

export default Model