import { StreamOptions } from 'morgan'
import morgan = require('morgan')
import Logger from './logger'

const stream: StreamOptions = {
  // Use the http severity
  write: message => Logger.http(message)
}

const skip = () => {
  const env = process.env.NODE_ENV || 'development'
  return env !== 'development'
}

const morganMiddleware = morgan(
  ':method :url :status :res[content-length] - :response-time ms',
  { stream, skip }
)

export default morganMiddleware
