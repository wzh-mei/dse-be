import { getUserQueue, bullBoardRouter } from './queueworker'
import { ApiRouter } from './api'
import * as cors from 'cors'
import * as express from 'express'
// const expressPino = require('express-pino-logger')

// const logger = pino({ level: process.env.LOG_LEVEL || 'info' })
// const expressLogger = expressPino({ logger })
const PORT = process.env.PORT || 8089
const app = express()

app.use(cors())
// app.use(expressLogger)

const username = 'maywzh'
// eslint-disable-next-line no-unused-vars
const maywzhQueue = getUserQueue(username).queue

app.use('/', bullBoardRouter)

app.use('/api', ApiRouter)

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`)
})
