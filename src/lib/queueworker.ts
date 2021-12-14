import { Queue, Worker, QueueEvents } from 'bullmq'
import { spawn } from 'child_process'
import { createBullBoard } from 'bull-board'
import { BullMQAdapter } from 'bull-board/bullMQAdapter'
import * as os from 'os'
import * as Redis from 'ioredis'
import * as dotenv from 'dotenv'
import Logger from './logger'

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
      async job => {
        const { cmd, args, cwd } = job.data
        job.updateProgress(10)
        const p = new Promise((resolve, reject) => {
          const exe = spawn(cmd, args, { cwd })
          exe.on('close', code => {
            const message = `child process exited with code ${code}`
            if (code === 0) {
              resolve(code)
            } else {
              reject(new Error(message))
            }
          })
          exe.on('error', err => {
            reject(err)
          })
        })
        await p
        job.updateProgress(100)
      },
      { concurrency: os.cpus().length, connection }
    )

    this.queueEvents = new QueueEvents(this.queueName, { connection })
    this.queueEvents.on('completed', jobId => {
      Logger.info(`${jobId?.jobId} done`)
    })
    this.queueEvents.on('failed', (jobId, err) => {
      Logger.error(`${jobId?.jobId} error, message: ${err}`)
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
  }
  return QueueList[queueName]
}

const removeUserQueue = (userName: string) => {
  const queueName = `${userName}-${process.platform}`
  if (QueueList[queueName]) {
    QueueList[queueName].removeFromBullBoard()
    delete QueueList[queueName]
  }
}

export { getUserQueue, removeUserQueue, bullBoardRouter }
