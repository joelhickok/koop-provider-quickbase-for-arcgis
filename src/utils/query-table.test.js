import {describe, expect, test, assert, assertType} from 'vitest'
import queryTable from './query-table.js'
import {QuickBase} from 'quickbase'
import dotenvx from '@dotenvx/dotenvx'

dotenvx.config()

describe('QueryTable', async () => {

    const quickbase = new QuickBase({
        realm: 'builderprogram-jhickok',
        userToken: process.env.QB_TOKEN,
    })

    const response = await queryTable({
        quickbase,
        tableId: 'bvy26afhg',
        select: [3],
        // where
    })
    // .then(result => {
    //     return [{
    //         test: 'test'
    //     }]
    // })

    console.log(response)

    test('to be an array', () => {
        assert.isArray(response)
    })

    test('item at index 0 is an object', () => {
        assert.isObject(response[0])
    })

    test('first item to have a property name "3"', () => {
        expect(response[0]).toHaveProperty('3')
    })

    test('keys to have an object property with a "value" property', () => {
        expect(response[0][3]).toHaveProperty('value')
    })
})
