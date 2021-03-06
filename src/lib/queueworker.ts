import { Queue, Worker, QueueEvents } from 'bullmq'
import { spawn } from 'child_process'
import { createBullBoard } from 'bull-board'
import { BullMQAdapter } from 'bull-board/bullMQAdapter'
import * as os from 'os'
import * as Redis from 'ioredis'
import * as dotenv from 'dotenv'
import Logger from './logger'
import config from './config'

dotenv.config()

const { router: bullBoardRouter, addQueue, removeQueue } = createBullBoard([])

const host = process.env.REDIS_HOST
const port = Number(process.env.REDIS_PORT)

const connection = new Redis(port, host, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
})

class UserQueue {
  queueName: string
  queue: Queue
  queueWorker: Worker
  queueEvents: QueueEvents
  constructor (queueName: string) {
    this.queueName = queueName

    this.queue = new Queue(this.queueName, { connection })

    this.queueWorker = new Worker(
      this.queueName,
      async (job) => {
        const { cmd, args, cwd } = job.data
        const p = new Promise((resolve, reject) => {
          const exe = spawn(cmd, args, { cwd })
          exe.on('spawn', () => {
            job.log(`Job started at ${new Date().toLocaleString()}`)
            job.update({ ...job.data, pid: exe.pid })
            job.updateProgress(0)
          })
          exe.on('close', (code, signal) => {
            const message = `Close: Child process closed at ${new Date().toLocaleString()}, Code: ${code}, Signal: ${signal}`
            job.log(message)
            job.update({ ...job.data, pid: null })
            if (code === 0) {
              job.updateProgress(100)
              resolve(code)
            } else {
              job.updateProgress(80)
              reject(new Error(message))
            }
          })
          exe.on('error', (err) => {
            job.log(
              `Job error at ${new Date().toLocaleString()}, message: ${
                err.message
              }`
            )
            reject(err)
          })
          exe.on('exit', (code, signal) => {
            const message = `Exit: Child process exited with code ${code}, Signal: ${signal}`
            job.log(message)
          })
          exe.on('message', (msg, handler) => {
            const message = `Message: ${msg}`
            job.log(message)
          })
        })
        await p
      },
      {
        concurrency: Math.floor(os.cpus().length * config.concurrencyFactor),
        connection
      }
    )

    this.queueEvents = new QueueEvents(this.queueName, { connection })
    this.queueEvents.on('completed', (job) => {
      Logger.info(`${job?.jobId} done`)
      Logger.info(job?.returnValue)
    })
    this.queueEvents.on('failed', (job, err) => {
      Logger.error(
        `${job?.jobId} error: ${job.failedReason}, stacktrace: ${job.stacktrace}`
      )
    })

    this.add2BullBoard()
  }

  add2BullBoard = () => {
    addQueue(new BullMQAdapter(this.queue))
  }

  removeFromBullBoard = () => {
    removeQueue(this.queueName)
  }
}

const QueueList: { [userName: string]: UserQueue } = {}

const getUserQueue = (userName: string) => {
  const queueName = `${userName}-${process.platform}`
  if (!QueueList[queueName]) {
    QueueList[queueName] = new UserQueue(queueName)
    Logger.info(`Created new task queue ${queueName}`)
  }
  return QueueList[queueName]
}

const removeUserQueue = (userName: string) => {
  const queueName = `${userName}-${process.platform}`
  if (QueueList[queueName]) {
    QueueList[queueName].removeFromBullBoard()
    delete QueueList[queueName]
    Logger.info(`Removed new task queue ${queueName}`)
  }
}

export { getUserQueue, removeUserQueue, bullBoardRouter }
