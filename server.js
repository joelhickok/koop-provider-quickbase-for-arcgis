import dotenvx from '@dotenvx/dotenvx'
import fs from 'fs'
import path from 'path'
import http from 'http'
import https from 'https'
import cors from 'cors'
import Koop from '@koopjs/koop-core'
import cache from '@koopjs/cache-memory'
import express from 'express'
import plugin from './build/koop-provider.quickbase.dev.js'

dotenvx.config()

const SSL = process.env.SSL === 'true'
let server
const PORT = process.env.PORT || (SSL ? 8443 : 8080)

// create a Koop app for the plugin to use
const koop = new Koop()
koop.register(cache, { size: 300 })
koop.register(plugin)

// create a regular old express app
// checking for the SSL env flag
const app = express()

const corsOptions = {
    origin: ['http://localhost:5173'],
    // credentials: true,
    // optionsSuccessStatus: 200
}

app.use(cors())

/* Use Koop as middleware */
app.use('/', koop.server)

// assign the type of server based on the SSL flag
if (SSL) {
    server = https.createServer({
        key: fs.readFileSync(path.join(process.cwd(), process.env.SSL_KEY)),
        cert: fs.readFileSync(path.join(process.cwd(), process.env.SSL_CERT))
    }, app)
} else {
    server = http.createServer(app)
}

// Vercel serverless functions don't want 'listen' called in the server.js code
if (process.env.NODE_ENV === 'development') {
    server.listen(PORT, () => {
        console.log(`Server running on http${SSL ? 's' : ''}://localhost:${PORT}`)
    })
}

export default server