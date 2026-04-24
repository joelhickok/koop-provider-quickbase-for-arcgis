import {toSnakeCase} from '../utils/index.js'

export default function (record) {
    // console.log(record)

    // bound to this
    let {PARAMS, fields} = this

    const properties = {
        realm: PARAMS.realm,
        appId: PARAMS.appId,
        tableId: PARAMS.tableId,
    }

    // map the Quickbase field names to the GeoJSON Feature properties
    // use snake_case to rename the original field names

    fields
        .forEach((field) => {
            // console.log(field)
            // console.log(record[field.id])
            const label = toSnakeCase(field.label)

            if (field.fieldType === 'user') {
                // field type user is an object with a name property
                properties[label] = record[field.id].value.name
            } else {
                // other fields have the value directly on the 'value' property
                properties[label] = record[field.id].value
            }

        })

    // Get the coordinates value using the pre-defined ID and map the value
    const coordinatesValue = record[PARAMS.coordinatesFID].value
    const coordinatesMapped = coordinatesValue
        .split(',')
        .map((r) => Number(r.trim()))
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
}