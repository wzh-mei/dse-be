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
  simulationRunDir,
  simulationBinDir
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
import { generateSimulationsWithDpSetList } from '../lib/jobhelper'
import Logger from '../lib/logger'

// import { aggregateData } from './datahelper'

const router = express.Router()

const apiResponse = (res: Response, status = 200) => (
  data: any,
  success?: boolean,
  errorMsg?: string,
  error?: Error
) => {
  return res.status(status).json(data)
}

const apiError = (res: Response, status = 500) => (
  errorMsg: string,
  error?: Error
) => {
  return res.status(status).json({ errorMsg, error })
}

router.post('/uploadExe', (req: Request, res: Response) => {
  const upload = multer({ dest: simulationBinDir }).single('file')
  upload(req, res, err => {
    if (err) {
      return apiError(res)('An error occurred uploading files', err)
    }
    if (!req.file) {
      return apiError(res)('Cannot find any file to upload')
    }
    const fileInfo = req.file
    fs.renameSync(fileInfo.path, `${fileInfo.path}.exe`)
    return apiResponse(res)({
      filename: `${fileInfo.filename}.exe`
    })
  })
})

router.post('/uploadDPCSV', (req: Request, res: Response) => {
  const upload = multer({ dest: dpcsvUploadDir }).single('file')
  upload(req, res, err => {
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
  upload(req, res, err => {
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

router.post('/createJobs', (req: Request, res: Response) => {
  const simParams = req.body
  const templateDPpath = path.join(dpcsvUploadDir, simParams.DPCSV_NAME)
  const subfolder = new Date().toISOString().replace(/:/g, '.')
  const dpset = new DPSetList([], [])
  const exeName = 'App.exe'
  const exePath = path.resolve(simulationBinDir, exeName)
  Logger.info(simulationBinDir)
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
              subfolder,
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
          }
        } else {
          const dp: DPRange = {
            key: param,
            value: valueRange
          }
          dpset.desProduct(dp)
        }
      }
    }
    Logger.debug(dpset)
    const genDPs = generateDPCSVFilesInSubDir(
      dpcsvGenerateDir,
      subfolder,
      templateDPpath,
      dpcsvGenerateTemplateNamePrefix,
      dpset
    )

    genDPs.then(csvs => {
      generateSimulationsWithDpSetList(
        workQueueName,
        simulationRunDir,
        subfolder,
        exePath,
        csvs,
        { 'cf-sim-duration': '5us', 'cf-lic-location': '27000@10.239.44.116' }
      )
    })
    return apiResponse(res)('success')
  } catch (err) {
    return apiError(res)('error')
  }
})

export { router as ApiRouter }
