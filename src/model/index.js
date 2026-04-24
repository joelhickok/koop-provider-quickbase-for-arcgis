import dotenvx from '@dotenvx/dotenvx'
import {QuickBase,} from 'quickbase'
import bbox from '@turf/bbox'
import {toSnakeCase, queryTable, mapFieldTypes, getQbTableFields, qbRecordToFeature} from '../utils/index.js'
import {ConfigurationError} from '../utils/errors.js'
import Cache from '@koopjs/cache-memory'

dotenvx.config()

const cacheInstance = new Cache()


export class Model {
    logger

    constructor({logger},) {
        this.logger = logger
    }

    // Koop is not happy if we provide an async getData function (uses Promisify under the hood)
    // So we are forced (below) to nest async logic in a Promise - see below
    getData(req, callback) {

        const CACHE_KEY = req.originalUrl

        cacheInstance.retrieve(CACHE_KEY, {}).then(cached => {
            if (cached) {
                console.log('Sending cached request.')
                return callback(null, cached)
            } else {
                const geoserviceParams = req.query

                if (!req.query?.coords_fid) {
                    return callback(new ConfigurationError('A URL parameter named "coords_fid" is required'))
                }

                // get the tableId and the appId, which come concatenated by a '-'
                const idParameters = req.params.id
                const [appId, tableId] = idParameters?.split('-')

                // if a select query was pased, parse it and map to numbers for QB FIDs
                const selectQuery = req.query?.select ? req.query?.select : null

                // build key parameters from req.params and req.query
                const PARAMS = {
                    realm: req.params.host,
                    appId,
                    tableId,
                    select: selectQuery?.split(',').map(d => Number(d)),
                    coordinatesFID: req.query?.coords_fid,
                    isQuery: req.route.path.includes(':layer'),
                }

                const qbOptions = {
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

                    let rawData

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
                    const geojsonResponse = {
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

                    let fields = await getQbTableFields(quickbase, tableId)
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
                        const select = fields.map((f) => f.id)

                        // make the actual table query
                        rawData = await queryTable({
                            quickbase,
                            tableId,
                            select,
                        })

                        // Translate to uniform GeoJSON Feature Collection
                        // bind some objects needed in the map function
                        geojsonResponse.features = rawData.map(qbRecordToFeature.bind({
                            PARAMS,
                            fields,
                        }))

                    }

                    const bboxFlat = bbox(geojsonResponse)
                    console.log(bboxFlat)

                    geojsonResponse.metadata.extent = [
                        [bboxFlat[2], bboxFlat[3]],
                        [bboxFlat[0], bboxFlat[1]],
                    ]
                    // console.log(geojsonResponse.metadata.extent)

                    //[ -122.03098, 34.75087, -105.99234, 46.24871 ]
                    // 	[[180,90],[-180,-90]]

                    geojsonResponse.metadata.limitExceeded = geojsonResponse.features.length > geojsonResponse.metadata.maxRecordCount

                    geojsonResponse.metadata.fields = fields.map(f => {
                        return {
                            name: toSnakeCase(f.label),
                            type: mapFieldTypes(f.fieldType),
                            alias: f.label,
                            // length: f.properties.width || null,
                        }
                    })

                    const options = {
                        ttl: 10000 // The TTL option is measured in seconds, it will be used to set the `maxAge` property in the LRU cache
                    }

                    await cacheInstance.insert(CACHE_KEY, geojsonResponse, options, err => {
                        console.log('CACHE ERROR: ', err)
                    })

                    return callback(null, geojsonResponse)
                })
            }

        })
    }

}

export default Model