export class ConfigurationError extends Error {
    constructor(...params: string[]) {
        super(...params)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ConfigurationError)
        }
        this.name = 'ConfigurationError'
    }
}

export default {
    ConfigurationError,
}