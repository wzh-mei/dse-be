import * as express from 'express'
import * as multer from 'multer'
import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuidv4 } from 'uuid'
import * as decompress from 'decompress'

import {
  dpcsvUploadDir,
  dpcsvGenerateDir,
  dpcsvGenerateTemplateNamePrefix,
  paramfileUploadDir,
  paramfileGenerateDir,
  paramfileGenerateTemplateNamePrefix,
  workQueueName,
  appUploadDir,
  tmpUploadDir,
  appDependencyDirname,
  simulationRunDir,
  simulationBinDir
} from '../lib/config'
import { Request, Response } from 'express'
import type { DPType, DPRange } from '../lib/types'
import {
  DPSetList,
  generateDPCSVFiles,
  generateDPInputFiles
} from '../lib/dphelper'

import { generateSimulation } from '../lib/jobhelper'
import Logger from '../lib/logger'
import { getUserQueue } from '../lib/queueworker'
import { Job } from 'bullmq'
import { parseDPCSVFile } from '../lib/common'

type JobQueue = {
  active: Job<any, any, string>[]
  waiting: Job<any, any, string>[]
  failed: Job<any, any, string>[]
  completed: Job<any, any, string>[]
  delayed: Job<any, any, string>[]
}

const allJobTypes = ['active', 'completed', 'waiting', 'failed', 'delayed']

type paramInfo = { [key: string]: string }

type JobInfo = {
  id: any
  name: string
  createTime: number
  state: string
  simulationId: string
  simulationName: string
  simulationTime: number
}

type SimulationInfo = {
  id: string
  name: string
  createTime: number
  active: JobInfo[]
  failed: JobInfo[]
  completed: JobInfo[]
  delayed: JobInfo[]
  waiting: JobInfo[]
}

type SimulationStatInfo = {
  id: string
  name: string
  createTime: number
  activeCount: number
  failedCount: number
  completedCount: number
  delayedCount: number
  waitingCount: number
}

const getJobState = (job: Job, jobQueue: JobQueue): string => {
  const active = jobQueue.active.map((job) => job.id)
  const completed = jobQueue.completed.map((job) => job.id)
  const waiting = jobQueue.waiting.map((job) => job.id)
  const failed = jobQueue.failed.map((job) => job.id)
  const delayed = jobQueue.delayed.map((job) => job.id)
  return active.indexOf(job.id) >= 0
    ? 'active'
    : completed.indexOf(job.id) >= 0
      ? 'completed'
      : waiting.indexOf(job.id) >= 0
        ? 'waiting'
        : failed.indexOf(job.id) >= 0
          ? 'failed'
          : delayed.indexOf(job.id) >= 0
            ? 'delayed'
            : 'unknown'
}

const paramToObj = (paramsStr: string) => {
  const paramKVs = paramsStr
    .trim()
    .split(' ')
    .map((x) => x.replace(/^-./, ''))
  const obj: paramInfo = {}
  for (const paramKV of paramKVs) {
    const [key, value] = paramKV.split('=')
    obj[key] = value
  }
  return obj
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
  filter?: any,
  sorter?: any
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
      simulationId: job.data.simulationId,
      simulationName: job.data.simulationName,
      simulationTime: job.data.simulationTime,
      createTime: job.processedOn as number,
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
        filename: `${fileInfo.filename}.exe`,
        type: 'exe'
      })
    } catch (e) {
      return apiError(res)((e as Error).message, e as Error)
    }
  })
})

router.post('/uploadExeZip', (req: Request, res: Response) => {
  const upload = multer({ dest: appUploadDir }).single('file')
  upload(req, res, async (err) => {
    if (err) {
      return apiError(res)('An error occurred uploading files', err)
    }
    if (!req.file) {
      return apiError(res)('Cannot find any file to upload')
    }
    const fileInfo = req.file
    const fileRealPath = `${fileInfo.path}.zip`
    fs.renameSync(fileInfo.path, fileRealPath)
    try {
      const files = await decompress(fileRealPath, tmpUploadDir)
      if (files.length <= 0) throw new Error('No file in zip')

      const exeFiles = files.filter((f) => f.path.endsWith('.exe'))
      let exeFile = null
      if (exeFiles.length <= 0) {
        throw new Error('No executable file found in zip')
      } else if (exeFiles.length > 1) {
        throw new Error(
          'Multiple executable files found in zip, which should contain only one executable file'
        )
      } else {
        exeFile = exeFiles[0]
      }
      const folderName = files[0].path.split('/')[0]
      const newFolderName = `${folderName}-${new Date().getTime()}`
      fs.cpSync(
        `${tmpUploadDir}/${folderName}`,
        `${simulationBinDir}/${newFolderName}`,
        { recursive: true }
      )
      const newExeFile = exeFile.path.replace(folderName, newFolderName)
      fs.chmodSync(path.resolve(simulationBinDir, newExeFile), '0711')
      return apiResponse(res)({
        filename: newExeFile,
        type: 'dir'
      })
    } catch (e: any) {
      return apiError(res)((e as Error).message, e as Error)
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
  try {
    const simParams = req.body
    const exeName = simParams.APP_NAME
    const simTime = new Date()
    const cmsParams = simParams.CMD_PARAM
    const cmsParamObj = paramToObj(cmsParams)
    const dpcsvName = simParams.DPCSV_NAME
    const simName =
      simParams.SIM_NAME || simTime.toISOString().replace(/:/g, '.')
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
            const genedParamFiles = generateDPInputFiles(
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
    const genDPs = await generateDPCSVFiles(
      dpcsvGenerateDir,
      `${simName}-${simTime.getTime()}`,
      templateDPpath,
      dpcsvGenerateTemplateNamePrefix,
      dpset
    )
    const simId = uuidv4()
    const genSims = await generateSimulation(
      workQueueName,
      simulationRunDir,
      simId,
      simName,
      simTime,
      exePath,
      genDPs,
      appDependencyDirname,
      cmsParamObj
    )
    return apiResponse(res)(genSims)
  } catch (e: any) {
    return apiError(res)((e as Error).message, e as Error)
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
  const { start, end, state } = req.body
  // const { username } = req.user as { [username: string]: string }
  const cmdQueue = getUserQueue('DSE').queue
  const active = await cmdQueue.getActive(start, end)
  const waiting = await cmdQueue.getWaiting(start, end)
  const failed = await cmdQueue.getFailed(start, end)
  const completed = await cmdQueue.getCompleted(start, end)
  const delayed = await cmdQueue.getDelayed(start, end)
  const allJobs = await cmdQueue.getJobs(state, start, end)
  const jobQueue = { active, waiting, failed, completed, delayed }
  return apiResponse(res)(returnJob(allJobs, jobQueue))
})

router.post('/getSimulationJobs', async (req, res) => {
  const { start, end, state, simulationId } = req.body
  // const { username } = req.user as { [username: string]: string }
  const cmdQueue = getUserQueue('DSE').queue
  const active = await cmdQueue.getActive(start, end)
  const waiting = await cmdQueue.getWaiting(start, end)
  const failed = await cmdQueue.getFailed(start, end)
  const completed = await cmdQueue.getCompleted(start, end)
  const delayed = await cmdQueue.getDelayed(start, end)
  const allJobs = await cmdQueue.getJobs(state, start, end)
  const jobQueue = { active, waiting, failed, completed, delayed }
  return apiResponse(res)(
    returnJob(
      allJobs,
      jobQueue,
      (job: Job) => job.data.simulationId === simulationId
    )
  )
})

router.post('/getSimulations', async (req, res) => {
  const { start, end } = req.body
  const cmdQueue = getUserQueue('DSE').queue
  const active = await cmdQueue.getActive()
  const waiting = await cmdQueue.getWaiting()
  const failed = await cmdQueue.getFailed()
  const completed = await cmdQueue.getCompleted()
  const delayed = await cmdQueue.getDelayed()
  const allJobs = await cmdQueue.getJobs(allJobTypes)
  const jobQueue = { active, waiting, failed, completed, delayed }

  const groupBy = (jobs: JobInfo[], keyGetter: any) => {
    const map = new Map()
    jobs.forEach((job) => {
      const key = keyGetter(job)
      const collection = map.get(key)
      if (!collection) {
        map.set(key, [job])
      } else {
        collection.push(job)
      }
    })
    return Object.fromEntries(map.entries())
  }
  const allJobInfos = returnJob(allJobs, jobQueue)
  const simulations = groupBy(allJobInfos, (job: JobInfo) => job.simulationName)
  return apiResponse(res)(simulations)
})

router.post('/getSimulationList', async (req, res) => {
  const { start, end } = req.body
  const cmdQueue = getUserQueue('DSE').queue
  const active = await cmdQueue.getActive()
  const waiting = await cmdQueue.getWaiting()
  const failed = await cmdQueue.getFailed()
  const completed = await cmdQueue.getCompleted()
  const delayed = await cmdQueue.getDelayed()
  const allJobs = await cmdQueue.getJobs(allJobTypes)
  const jobQueue = { active, waiting, failed, completed, delayed }

  const groupBy = (jobs: JobInfo[], keyGetter: any) => {
    const map = new Map()
    jobs.forEach((job) => {
      const key = keyGetter(job)
      const collection = map.get(key)
      if (!collection) {
        map.set(key, [job])
      } else {
        collection.push(job)
      }
    })
    return Object.fromEntries(map.entries())
  }
  const allJobInfos = returnJob(allJobs, jobQueue)
  const simulations = groupBy(allJobInfos, (job: JobInfo) => job.simulationId)
  const rtn: SimulationStatInfo[] = []
  try {
    Object.keys(simulations).forEach((key: string) => {
      const simulation = simulations[key]
      if (simulation.length > 0) {
        rtn.push({
          id: simulation[0].simulationId,
          name: simulation[0].simulationName,
          createTime: simulation[0].simulationTime,
          activeCount: 0,
          failedCount: 0,
          completedCount: 0,
          delayedCount: 0,
          waitingCount: 0
        })
      }
    })
  } catch (err) {
    return apiError(res)((err as Error).message)
  }

  return apiResponse(res)(rtn)
})

router.post('getSimulationInfos', async (req, res) => {
  const { start, end, state, simulationId } = req.body

  // const { username } = req.user as { [username: string]: string }
  const cmdQueue = getUserQueue('DSE').queue
  const active = await cmdQueue.getActive(start, end)
  const waiting = await cmdQueue.getWaiting(start, end)
  const failed = await cmdQueue.getFailed(start, end)
  const completed = await cmdQueue.getCompleted(start, end)
  const delayed = await cmdQueue.getDelayed(start, end)
  const allJobs = await cmdQueue.getJobs(state, start, end)
  const jobQueue = { active, waiting, failed, completed, delayed }
  const jobInfos = returnJob(
    allJobs,
    jobQueue,
    (job: Job) => job.data.simulationId === simulationId
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

router.get('/getJobs', async (req, res) => {
  // const { username } = req.user as { [username: string]: string }
  const { start, end, type } = req.query
  const _start = Number(start)
  const _end = Number(end)
  const _type = type as string
  const cmdQueue = getUserQueue('DSE').queue
  const active = await cmdQueue.getActive(_start, _end)
  const waiting = await cmdQueue.getWaiting(_start, _end)
  const failed = await cmdQueue.getFailed(_start, _end)
  const completed = await cmdQueue.getCompleted(_start, _end)
  const delayed = await cmdQueue.getDelayed(_start, _end)
  const allJobs = await cmdQueue.getJobs(_type, _start, _end)
  const jobQueue = { active, waiting, failed, completed, delayed }
  return apiResponse(res)(returnJob(allJobs, jobQueue))
})

router.get('/aggregateData', async (req, res) => {
  return apiResponse(res)('success')
})

export { router as ApiRouter }
