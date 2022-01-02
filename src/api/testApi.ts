import * as express from 'express'
import { apiResponse, commonAsyncHandler } from '../lib/common'
import Logger from '../lib/logger'
import { getUserQueue } from '../lib/queueworker'

const router = express.Router()

router.post('/getAllJobs', async (req, res) => {
  const { start, end } = req.body
  // const { username } = req.user as { [username: string]: string }
  const cmdQueue = getUserQueue('DSE').queue

  const allJobs = await cmdQueue.getJobs(
    ['completed', 'failed', 'active'],
    start,
    end
  )
  const jobStates = []
  for (const job of allJobs) {
    jobStates.push(await job.getState())
  }
  return apiResponse(res)(jobStates)
})

router.get('/getActiveJobs', async (req, res) => {
  const { start, end } = req.body
  // const { username } = req.user as { [username: string]: string }
  const cmdQueue = getUserQueue('DSE').queue
  const activeJobs = await cmdQueue.getActive(start, end)
  return apiResponse(res)(activeJobs)
})

router.get('/getWaitingJobs', async (req, res) => {
  const { start, end } = req.body
  // const { username } = req.user as { [username: string]: string }
  const cmdQueue = getUserQueue('DSE').queue
  const waitingJobs = await cmdQueue.getWaiting(start, end)
  return apiResponse(res)(waitingJobs)
})

router.post('/getCompletedJobs', async (req, res) => {
  const { start, end } = req.body
  // const { username } = req.user as { [username: string]: string }
  const cmdQueue = getUserQueue('DSE').queue
  const completedJobs = await cmdQueue.getCompleted(start, end)
  return apiResponse(res)(completedJobs)
})

router.post('/getFailedJobs', async (req, res) => {
  const { start, end } = req.body
  // const { username } = req.user as { [username: string]: string }
  const cmdQueue = getUserQueue('DSE').queue
  const failedJobs = await cmdQueue.getFailed(start, end)
  return apiResponse(res)(failedJobs)
})

router.post('/getCompletedJobsTest', async (req, res) => {
  commonAsyncHandler(req, res, async (r) => {
    const { start, end } = r.body
    // const { username } = req.user as { [username: string]: string }
    const cmdQueue = getUserQueue('DSE').queue
    const completedJobs = await cmdQueue.getCompleted(start, end)
    Logger.debug(completedJobs)

    return completedJobs
  })
})

router.post('/downloadJobTest', (req, res) =>
  commonAsyncHandler(req, res, async (r) => {
    const { jobId } = r.body
    const cmdQueue = getUserQueue('DSE').queue
    const job = await cmdQueue.getJob(jobId)
    const jobRunDir = job?.data.cwd
    return jobRunDir
  })
)

export { router as TestApiRouter }
