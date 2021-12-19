import winston = require('winston')

const levels = {
  error: 0,
  warn: 1,
  data: 2,
  info: 3,
  http: 4,
  debug: 5
}

const level = () => {
  const env = process.env.NODE_ENV || 'development'
  return env === 'development' ? 'debug' : 'warn'
}

const colors = {
  error: 'red',
  warn: 'yellow',
  data: 'blue',
  info: 'green',
  http: 'magenta',
  debug: 'white'
}

winston.addColors(colors)

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
)

const transports = [
  new winston.transports.Console(),
  new winston.transports.File({
    filename: `${process.env.LOGDIR || 'logs'}/error.log`,
    level: 'error'
  }),
  new winston.transports.File({
    filename: `${process.env.LOGDIR || 'logs'}/all.log`
  })
]

const Logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports
})

export default Logger
