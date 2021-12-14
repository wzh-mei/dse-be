import { getUserQueue, bullBoardRouter } from './queueworker'
import { ApiRouter } from './api'
import * as cors from 'cors'
import * as express from 'express'
import * as dotenv from 'dotenv'
import Logger from './lib/logger'

dotenv.config()

// const expressPino = require('express-pino-logger')
// const logger = pino({ level: process.env.LOG_LEVEL || 'info' })
// const expressLogger = expressPino({ logger })
const PORT = process.env.PORT
const app = express()

app.use(express.json())
app.use(cors())
// app.use(expressLogger)

const username = 'maywzh'
// eslint-disable-next-line no-unused-vars
const maywzhQueue = getUserQueue(username).queue

app.use('/', bullBoardRouter)

app.use('/api', ApiRouter)

app.get('/logger', (_, res) => {
  Logger.error('This is an error log')
  Logger.warn('This is a warn log')
  Logger.info('This is a info log')
  Logger.http('This is a http log')
  Logger.debug('This is a debug log')

  res.send('Hello logger')
})
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`)
})
