import * as express from 'express'
import * as multer from 'multer'
import * as fs from 'fs'
import * as path from 'path'
import {
  dpcsvUploadDir,
  dpcsvGenerateDir,
  dpcsvGenerateTemplateNamePrefix,
  paramfileUploadDir,
  paramfileGenerateDir,
  paramfileGenerateTemplateNamePrefix,
  workQueueName,
  appUploadDir,
  simulationRunDir
} from '../lib/config'
import { Request, Response } from 'express'
import {
  DPType,
  DPRange,
  DPSetList,
  generateDPCSVFilesInSubDir,
  generateDPInputFilesInSubDir,
  parseDPCSVFile
} from '../lib/dphelper'
import { generateSimulation } from '../lib/jobhelper'
import Logger from '../lib/logger'
import { getUserQueue } from '../lib/queueworker'
import { Job } from 'bullmq'

type JobQueue = {
  active: Job<any, any, string>[]
  waiting: Job<any, any, string>[]
  failed: Job<any, any, string>[]
  completed: Job<any, any, string>[]
  delayed: Job<any, any, string>[]
}
type JobInfo = {
  id: any
  name: any
  simulationName: any
  createTime: any
  state: any
}
const getJobState = (job: Job, jobQueue: JobQueue): string => {
  const active = jobQueue.active.map((job) => job.id)
  const completed = jobQueue.completed.map((job) => job.id)
  const waiting = jobQueue.waiting.map((job) => job.id)
  const failed = jobQueue.failed.map((job) => job.id)
  const delayed = jobQueue.delayed.map((job) => job.id)
  return active.indexOf(job.id) > 0
    ? 'active'
    : completed.indexOf(job.id) > 0
      ? 'completed'
      : waiting.indexOf(job.id) > 0
        ? 'waiting'
        : failed.indexOf(job.id) > 0
          ? 'failed'
          : delayed.indexOf(job.id) > 0
            ? 'delayed'
            : 'unknown'
}

const router = express.Router()

const apiResponse =
  (res: Response, status = 200) =>
    (data: any, success?: boolean, errorMsg?: string, error?: Error) => {
      return res.status(status).json(data)
    }

const apiError =
  (res: Response, status = 500) =>
    (errorMsg: string, error?: Error) => {
      return res.status(status).json({ errorMsg, error })
    }

const returnJob = (
  jobs: Job<any, any, string>[],
  queuedJobs: JobQueue,
  sorter?: any,
  filter?: any
): JobInfo[] => {
  let rtn: Job<any, any, string>[] = jobs
  if (filter) {
    rtn = rtn.filter(filter)
  }
  if (sorter) {
    rtn = rtn.sort(sorter)
  }
  return rtn.map((job) => {
    return {
      id: job.id,
      name: job.name,
      simulationName: job.data.simulationName,
      createTime: new Date(job.processedOn as number).toString(),
      state: getJobState(job, queuedJobs)
    }
  })
}

router.post('/uploadExe', (req: Request, res: Response) => {
  const upload = multer({ dest: appUploadDir }).single('file')
  upload(req, res, (err) => {
    if (err) {
      return apiError(res)('An error occurred uploading files', err)
    }
    if (!req.file) {
      return apiError(res)('Cannot find any file to upload')
    }
    const fileInfo = req.file
    fs.renameSync(fileInfo.path, `${fileInfo.path}.exe`)
    try {
      fs.chmodSync(`${fileInfo.path}.exe`, '0711')
      return apiResponse(res)({
        filename: `${fileInfo.filename}.exe`
      })
    } catch (e) {
      return apiError(res)('Cannot change app mode')
    }
  })
})

router.post('/uploadDPCSV', (req: Request, res: Response) => {
  const upload = multer({ dest: dpcsvUploadDir }).single('file')
  upload(req, res, (err) => {
    if (err) {
      return apiError(res)('An error occurred uploading files', err)
    }
    if (!req.file) {
      return apiError(res)('Cannot find any file to upload')
    }
    const fileInfo = req.file
    fs.renameSync(fileInfo.path, `${fileInfo.path}.csv`)
    const filePath = `${fileInfo.path.replace(/\\/g, '/')}.csv`
    const params = parseDPCSVFile(filePath)
    return apiResponse(res)({
      filename: `${fileInfo.filename}.csv`,
      params: params
    })
  })
})

router.post('/uploadConfigFile', (req: Request, res: Response) => {
  // const configtype = req.body.configtype
  const upload = multer({ dest: paramfileUploadDir }).single('file')
  upload(req, res, (err) => {
    if (err) {
      return apiError(res)('An error occurred uploading files', err)
    }
    if (!req.file) {
      return apiError(res)('Cannot find any file to upload')
    }
    const fileInfo = req.file
    fs.renameSync(fileInfo.path, `${fileInfo.path}.json`)
    const filePath = `${fileInfo.path.replace(/\\/g, '/')}.json`
    return apiResponse(res)({
      filename: `${fileInfo.filename}.json`,
      filepath: filePath,
      params: {}
    })
  })
})

router.post('/createJobs', async (req: Request, res: Response) => {
  const simParams = req.body
  const exeName = simParams.APP_NAME
  const simTime = new Date()
  const dpcsvName = simParams.DPCSV_NAME
  const simName = simParams.SIM_NAME || simTime.toISOString().replace(/:/g, '.')
  const exePath = path.resolve(appUploadDir, exeName)
  const templateDPpath = path.join(dpcsvUploadDir, dpcsvName)
  const dpset = new DPSetList([], [])
  if (!fs.existsSync(exePath)) {
    Logger.error('cannot find uploaded executable program')
    return apiError(res)('cannot find uploaded executable program')
  }
  if (!fs.existsSync(templateDPpath)) {
    Logger.error('cannot find uploaded DPCSV file')
    return apiError(res)('cannot find uploaded DPCSV file')
  }
  try {
    for (const param in simParams) {
      const valueRange: Array<DPType> = simParams[param]
      if (param !== 'DPCSV_NAME') {
        if (typeof simParams[param] === 'object') {
          if (simParams[param].FILE_NAME !== undefined) {
            const paramFilePath = path.resolve(
              paramfileUploadDir,
              simParams[param].FILE_NAME
            )
            const paramSetList = new DPSetList([], [])
            for (const fileParam in simParams[param]) {
              if (fileParam !== 'FILE_NAME') {
                const paramFileParam: DPRange = {
                  key: fileParam,
                  value: simParams[param][fileParam]
                }
                paramSetList.desProduct(paramFileParam)
              }
            }
            const genedParamFiles = generateDPInputFilesInSubDir(
              paramfileGenerateDir,
              simName,
              paramFilePath,
              paramfileGenerateTemplateNamePrefix,
              param,
              paramSetList
            )
            const dp: DPRange = {
              key: param,
              value: genedParamFiles
            }
            dpset.desProduct(dp)
          } else {
            const dp: DPRange = {
              key: param,
              value: valueRange
            }
            dpset.desProduct(dp)
          }
        }
      }
    }
    const genDPs = await generateDPCSVFilesInSubDir(
      dpcsvGenerateDir,
      simName,
      templateDPpath,
      dpcsvGenerateTemplateNamePrefix,
      dpset
    )

    const genSims = await generateSimulation(
      workQueueName,
      simulationRunDir,
      simName,
      simTime,
      exePath,
      genDPs,
      { 'cf-sim-duration': '5us', 'cf-lic-location': '27000@10.239.44.116' }
    )
    return apiResponse(res)(genSims)
  } catch (err: any) {
    return apiError(res)(err)
  }
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

router.post('/getJobs', async (req, res) => {
  const { start, end, type } = req.body
  // const { username } = req.user as { [username: string]: string }
  const cmdQueue = getUserQueue('DSE').queue
  const active = await cmdQueue.getActive(start, end)
  const waiting = await cmdQueue.getWaiting(start, end)
  const failed = await cmdQueue.getFailed(start, end)
  const completed = await cmdQueue.getCompleted(start, end)
  const delayed = await cmdQueue.getDelayed(start, end)
  const allJobs = await cmdQueue.getJobs(type, start, end)
  const jobQueue = { active, waiting, failed, completed, delayed }
  return apiResponse(res)(returnJob(allJobs, jobQueue))
})

router.post('/getSimulationJobs', async (req, res) => {
  const { start, end, type, simulationName } = req.body
  // const { username } = req.user as { [username: string]: string }
  const cmdQueue = getUserQueue('DSE').queue
  const active = await cmdQueue.getActive(start, end)
  const waiting = await cmdQueue.getWaiting(start, end)
  const failed = await cmdQueue.getFailed(start, end)
  const completed = await cmdQueue.getCompleted(start, end)
  const delayed = await cmdQueue.getDelayed(start, end)
  const allJobs = await cmdQueue.getJobs(type, start, end)
  const jobQueue = { active, waiting, failed, completed, delayed }
  return apiResponse(res)(
    returnJob(
      allJobs,
      jobQueue,
      (job: Job) => job.data.simulationName === simulationName
    )
  )
})

router.post('getSimulationInfos', async (req, res) => {
  const { start, end, type, simulationName } = req.body
  // const { username } = req.user as { [username: string]: string }
  const cmdQueue = getUserQueue('DSE').queue
  const active = await cmdQueue.getActive(start, end)
  const waiting = await cmdQueue.getWaiting(start, end)
  const failed = await cmdQueue.getFailed(start, end)
  const completed = await cmdQueue.getCompleted(start, end)
  const delayed = await cmdQueue.getDelayed(start, end)
  const allJobs = await cmdQueue.getJobs(type, start, end)
  const jobQueue = { active, waiting, failed, completed, delayed }
  const jobInfos = returnJob(
    allJobs,
    jobQueue,
    (job: Job) => job.data.simulationName === simulationName
  )
  return apiResponse(res)(jobInfos)
})

// router.get('/getSimulationJobs', async (req, res) => {
//   const { start, end, type, simulation } = req.query

//   const cmdQueue = getUserQueue('DSE').queue
//   const active = await cmdQueue.getActive(
//     start as unknown as number,
//     end as unknown as number
//   )
//   const waiting = await cmdQueue.getWaiting(start, end)
//   const failed = await cmdQueue.getFailed(start, end)
//   const completed = await cmdQueue.getCompleted(start, end)
//   const delayed = await cmdQueue.getDelayed(start, end)
//   const allJobs = await cmdQueue.getJobs(type, start, end)
//   const jobQueue = { active, waiting, failed, completed, delayed }
//   return apiResponse(res)(
//     returnJob(
//       allJobs,
//       jobQueue,
//       (job: Job) => job.data.simulationName === simulation
//     )
//   )
// })

// router.post('/getSimulations', async (req, res) => {
//   const { start, end } = req.body
// })

router.get('/getJobs', async (req, res) => {
  // const { username } = req.user as { [username: string]: string }
  const start = undefined
  const end = undefined
  const type = 'completed'
  const cmdQueue = getUserQueue('DSE').queue
  const active = await cmdQueue.getActive(start, end)
  const waiting = await cmdQueue.getWaiting(start, end)
  const failed = await cmdQueue.getFailed(start, end)
  const completed = await cmdQueue.getCompleted(start, end)
  const delayed = await cmdQueue.getDelayed(start, end)
  const allJobs = await cmdQueue.getJobs(type, start, end)
  const jobQueue = { active, waiting, failed, completed, delayed }
  return apiResponse(res)(returnJob(allJobs, jobQueue))
})

export { router as ApiRouter }
