import * as express from 'express'
import * as multer from 'multer'
import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuidv4 } from 'uuid'
import * as decompress from 'decompress'
import { zip } from 'zip-a-folder'

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
  simulationBinDir,
  downloadJobZipDir,
  paramFileName,
  downloadDataDir
} from '../lib/config'
import { Request, Response } from 'express'
import type {
  DPType,
  DPRange,
  paramInfo,
  JobInfo,
  SimulationStatInfo
} from '../lib/types'
import {
  DPSetList,
  generateDPCSVFiles,
  generateDPInputFiles
} from '../lib/dphelper'

import { generateSimulation } from '../lib/jobhelper'
import { aggregateDatas } from '../lib/datahelper'
import Logger from '../lib/logger'
import { getUserQueue } from '../lib/queueworker'
import { Job } from 'bullmq'
import {
  apiError,
  apiResponse,
  commonAsyncHandler,
  commonHandler,
  parseDPCSVFile,
  toCSV
} from '../lib/common'

const allJobTypes = ['active', 'completed', 'waiting', 'failed', 'delayed']

const router = express.Router()

const paramToObj = (paramsStr: string) => {
  if (!paramsStr) return {}
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

const returnJob = async (
  jobs: Job<any, any, string>[],
  filter?: any,
  sorter?: any
): Promise<JobInfo[]> => {
  let _jobs: Job<any, any, string>[] = jobs
  if (filter) {
    _jobs = _jobs.filter(filter)
  }
  if (sorter) {
    _jobs = _jobs.sort(sorter)
  }
  const rtn: JobInfo[] = []
  for (const job of _jobs) {
    const jobState = await job.getState()
    rtn.push({
      id: job.id,
      name: job.name,
      simulationId: job.data.simulationId,
      simulationName: job.data.simulationName,
      simulationTime: job.data.simulationTime,
      createTime: job.processedOn as number,
      finishTime: job.finishedOn as number,
      state: jobState
    })
  }
  return rtn
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

router.post('/getJobs', async (req, res) => {
  const { start, end, state } = req.body
  // const { username } = req.user as { [username: string]: string }
  const cmdQueue = getUserQueue('DSE').queue
  const allJobs = await cmdQueue.getJobs(state, start, end)
  const rtn = await returnJob(allJobs)
  return apiResponse(res)(rtn)
})

router.post('/getSimulationJobs', async (req, res) => {
  const { start, end, state, simulationId } = req.body
  // const { username } = req.user as { [username: string]: string }
  const cmdQueue = getUserQueue('DSE').queue

  const allJobs = await cmdQueue.getJobs(state, start, end)
  const rtn = await returnJob(
    allJobs,
    (job: Job) => job.data.simulationId === simulationId
  )
  return apiResponse(res)(rtn)
})

router.post('/getSimulations', async (req, res) => {
  const cmdQueue = getUserQueue('DSE').queue

  const allJobs = await cmdQueue.getJobs(allJobTypes)

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
  const allJobInfos = await returnJob(allJobs)
  const simulations = groupBy(allJobInfos, (job: JobInfo) => job.simulationName)
  return apiResponse(res)(simulations)
})

router.post('/getSimulationList', async (req, res) => {
  const cmdQueue = getUserQueue('DSE').queue
  const allJobs = await cmdQueue.getJobs(allJobTypes)
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
  const allJobInfos = await returnJob(allJobs)
  const simulations = groupBy(allJobInfos, (job: JobInfo) => job.simulationId)
  const rtn: SimulationStatInfo[] = []
  try {
    Object.keys(simulations).forEach((key: string) => {
      const jobs: JobInfo[] = simulations[key]
      if (jobs.length > 0) {
        const ans: SimulationStatInfo = {
          id: jobs[0].simulationId,
          name: jobs[0].simulationName,
          createTime: jobs[0].simulationTime,
          activeCount: 0,
          failedCount: 0,
          completedCount: 0,
          delayedCount: 0,
          waitingCount: 0
        }
        for (const job of jobs) {
          switch (job.state) {
            case 'active':
              ans.activeCount++
              break
            case 'failed':
              ans.failedCount++
              break
            case 'completed':
              ans.completedCount++
              break
            case 'delayed':
              ans.delayedCount++
              break
            case 'waiting':
              ans.waitingCount++
              break
            default:
              break
          }
        }
        rtn.push(ans)
      }
    })
  } catch (err) {
    return apiError(res)((err as Error).message)
  }

  return apiResponse(res)(rtn)
})

router.post('/getSimulationInfos', async (req, res) => {
  const { start, end, state, simulationId } = req.body

  // const { username } = req.user as { [username: string]: string }
  const cmdQueue = getUserQueue('DSE').queue
  const allJobs = await cmdQueue.getJobs(state, start, end)
  const jobInfos = await returnJob(
    allJobs,
    (job: Job) => job.data.simulationId === simulationId
  )
  return apiResponse(res)(jobInfos)
})

router.post('/getRunOutputFileList', (req, res) =>
  commonHandler(req, res, (r) => {
    const { runDir } = r.body
    if (!fs.existsSync(runDir)) {
      throw new Error('File not exist')
    }
    const res = fs
      .readdirSync(runDir)
      .filter(
        (filename) =>
          filename.endsWith('.csv') &&
          filename !== `${dpcsvGenerateTemplateNamePrefix}.csv`
      )
    return res
  })
)

router.post('/getJobOutputFileList', async (req, res) =>
  commonAsyncHandler(req, res, async (r) => {
    const { jobId } = r.body
    const cmdQueue = getUserQueue('DSE').queue
    const job = await cmdQueue.getJob(jobId)
    const jobState = await job?.getState()
    if (jobState !== 'completed') {
      return []
    }
    const runDir = job?.data.cwd
    if (!fs.existsSync(runDir)) {
      throw new Error('File not exist')
    }
    const res = fs
      .readdirSync(runDir)
      .filter(
        (filename) =>
          filename.endsWith('.csv') &&
          filename !== `${dpcsvGenerateTemplateNamePrefix}.csv`
      )
    return res
  })
)

router.get('/downloadJob', async (req, res) => {
  const jobId = req.query.jobId as string
  const cmdQueue = getUserQueue('DSE').queue
  const job = await cmdQueue.getJob(jobId)
  const jobState = await job?.getState()
  if (jobState !== 'completed') {
    return apiError(res)('The job is not completed')
  }
  const runDir = job?.data.cwd
  if (!fs.existsSync(runDir)) {
    return apiError(res)('Not found job run folder')
  }
  if (!fs.existsSync(downloadJobZipDir)) {
    fs.mkdirSync(downloadJobZipDir, { recursive: true })
  }
  if (fs.statSync(runDir).isDirectory()) {
    const folderName = runDir.split(/\\|\//).pop()
    const zipPath = path.resolve(`${downloadJobZipDir}/${folderName}.zip`)
    zip(runDir, zipPath).then(() => {
      return res.download(zipPath)
    })
  } else {
    return res.download(runDir)
  }
})

router.post('/aggregateData', async (req, res) => {
  const { DATA_FILE, DOMAIN_KEYWORD, DATA_KEYWORD, jobs } = req.body
  const cmdQueue = getUserQueue('DSE').queue
  const workDirs = []
  for (const jobId of jobs) {
    const job = await cmdQueue.getJob(jobId)
    workDirs.push(job?.data.cwd)
  }
  const ans = aggregateDatas(
    workDirs,
    paramFileName,
    DATA_FILE,
    DOMAIN_KEYWORD,
    DATA_KEYWORD
  )
  return apiResponse(res)(ans)
})

router.post('/downloadAggregateDataCSV', async (req, res) => {
  const { DATA_FILE, DOMAIN_KEYWORD, DATA_KEYWORD, jobs } = req.body
  const cmdQueue = getUserQueue('DSE').queue
  const workDirs = []
  for (const jobId of jobs) {
    const job = await cmdQueue.getJob(jobId)
    workDirs.push(job?.data.cwd)
  }
  const csvRecords = aggregateDatas(
    workDirs,
    paramFileName,
    DATA_FILE,
    DOMAIN_KEYWORD,
    DATA_KEYWORD
  )
  const csvString = toCSV(csvRecords)
  if (!fs.existsSync(downloadDataDir)) {
    fs.mkdirSync(downloadDataDir, { recursive: true })
  }
  const filePath = `${downloadDataDir}/output-${new Date().getDate()}.csv`
  fs.writeFileSync(filePath, csvString)
  return res.download(filePath)
})

router.post('/retryJob', async (req, res) =>
  commonAsyncHandler(req, res, async (r) => {
    const { jobId } = r.body
    const cmdQueue = getUserQueue('DSE').queue
    const job = await cmdQueue.getJob(jobId)
    const jobState = await job?.getState()
    if (jobState === 'failed') job?.retry()
    return 'success'
  })
)

router.post('/stopJob', async (req, res) =>
  commonAsyncHandler(req, res, async (r) => {
    const { jobId } = r.body
    const cmdQueue = getUserQueue('DSE').queue
    const job = await cmdQueue.getJob(jobId)
    if (await job?.isActive()) {
      if (job?.data.pid) process.kill(job?.data.pid)
      // job?.moveToFailed(new Error('Manually stopped'), '')
      return { data: true, message: 'Success' }
    } else if (await job?.isWaiting()) {
      job?.remove()
      return { data: true, message: 'Success' }
    } else {
      return { data: false, message: 'Job is not active' }
    }
  })
)

router.post('/stopSimulation', async (req, res) =>
  commonAsyncHandler(req, res, async (r) => {
    const { simId } = r.body
    const cmdQueue = getUserQueue('DSE').queue
    const allJobs = await cmdQueue.getJobs(allJobTypes)
    const simJobs = allJobs.filter((job) => job.data.simulationId === simId)
    for (const job of simJobs) {
      if (await job?.isActive()) {
        if (job?.data.pid) process.kill(job?.data.pid)
        return { data: true, message: 'Success' }
      } else if (await job?.isWaiting()) {
        job?.remove()
        return { data: true, message: 'Success' }
      }
    }
    return { data: true, message: 'success' }
  })
)

router.post('/retrySimulation', async (req, res) =>
  commonAsyncHandler(req, res, async (r) => {
    const { simId } = r.body
    const cmdQueue = getUserQueue('DSE').queue
    const allJobs = await cmdQueue.getJobs(allJobTypes)
    const simJobs = allJobs.filter((job) => job.data.simulationId === simId)
    for (const job of simJobs) {
      if (await job?.isFailed()) {
        job?.retry()
      }
    }
    return { data: true, message: 'success' }
  })
)

export { router as ApiRouter }
