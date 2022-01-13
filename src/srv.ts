import { getUserQueue, bullBoardRouter } from './lib/queueworker'
import { ApiRouter } from './api/dseApi'
import { TestApiRouter } from './api/testApi'
import * as cors from 'cors'
import * as express from 'express'
import Logger from './lib/logger'
import morganMiddleware from './lib/morganLog'
import config from './lib/config'

// const expressPino = require('express-pino-logger')
// const logger = pino({ level: process.env.LOG_LEVEL || 'info' })
// const expressLogger = expressPino({ logger })
const app = express()

app.use(express.json())
app.use(cors())
// app.use(expressLogger)

// eslint-disable-next-line no-unused-vars
const dseQueue = getUserQueue(config.username).queue
app.use(morganMiddleware)

app.use('/', bullBoardRouter)

app.use('/api', ApiRouter)

if (config.ProdMode !== 'production') { app.use('/testapi', TestApiRouter) }

app.get('/logger', (_, res) => {
  Logger.error('This is an error log')
  Logger.warn('This is a warn log')
  Logger.info('This is a info log')
  Logger.http('This is a http log')
  Logger.debug('This is a debug log')

  res.send('Hello logger')
})
app.listen(config.PORT, config.HOST, () => {
  Logger.info(`Server is running on ${config.HOST}:${config.PORT}. Production Mode: ${config.ProdMode}`)
})
