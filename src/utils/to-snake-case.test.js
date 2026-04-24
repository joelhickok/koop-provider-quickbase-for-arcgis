import {describe, assert, test} from 'vitest'
import toSnakeCase from './to-snake-case.js'

const testStrings = [
    {input: 'Koop Provider', expectedOutput: 'koop_provider'},
    {input: 'Koop Provider Quickbase', expectedOutput: 'koop_provider_quickbase'},
    {input: 'Koop Provider.Quickbase', expectedOutput: 'koop_provider_quickbase'},
    {input: 'Koop-Provider-Quickbase', expectedOutput: 'koop_provider_quickbase'},
]

describe('to snake_case', () => {

    test('does not contain spaces', () => {
        testStrings.forEach(testString => {
            assert(!toSnakeCase(testString.input).includes(' '))
        })
    })

    test('does not contain any CAPS', () => {
        testStrings.forEach(testString => {
            assert(!/[A-Z]/.test(toSnakeCase(testString.input)))
        })
    })

    test('does not contain forbidden characters', () => {
        testStrings.forEach(testString => {
            assert(!/[.-]/.test(toSnakeCase(testString.input)))
        })
    })

})

