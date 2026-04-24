/**
 *
 * Converts a string to a snake_case version of the same string
 *
 */

export default function toSnakeCase(str = '') {
    if (str) {
        return str

            // match words
            .match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)

            // make the string lowercase
            .map((x) => x.toLowerCase())

            //concatenate using an underscore
            .join('_')
    }
    return ''
}