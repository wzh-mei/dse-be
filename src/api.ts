import * as express from 'express'
import * as multer from 'multer'
import * as fs from 'fs'
import {
  dpcsvUploadDir,
  dpcsvGenerateDir,
  dpcsvGenerateTemplateNamePrefix,
  workQueueName,
  simulationRunDir,
  simulationBinDir
} from '../config/config'
import { Request, Response } from 'express'
import {
  DPRange,
  DPSetList,
  generateDPCSVFilesInSubDir,
  parseDPCSVFile
} from './dphelper'
import { generateSimulationsWithDpSetList } from './jobhelper'
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
      filepath: `${fileInfo.path.replace(/\\/g, '/')}.csv`,
      params: params
    })
  })
})

router.post('/uploadConfigFile', (req: Request, res: Response) => {
  // const configtype = req.body.configtype
  const upload = multer({ dest: 'extra/configs/upload' }).single('file')
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
  console.log(simParams)
  const templateDPpath = simParams.DPCSV_NAME
  const dpset = new DPSetList([], [])
  for (const k in simParams) {
    const valueRange = simParams[k]
    if (k !== 'DPCSV_NAME') {
      const dp: DPRange = {
        key: k,
        value: valueRange
      }
      dpset.desProduct(dp)
    }
  }
  console.log(dpset)
  const subfolder = new Date().toISOString().replace(/:/g, '.')

  const genDPs = generateDPCSVFilesInSubDir(
    dpcsvGenerateDir,
    subfolder,
    templateDPpath,
    dpcsvGenerateTemplateNamePrefix,
    dpset
  )
  console.log(genDPs)
  genDPs.then(csvs => {
    generateSimulationsWithDpSetList(
      workQueueName,
      simulationRunDir,
      subfolder,
      simulationBinDir,
      csvs,
      '5us',
      '27000@10.239.44.116'
    )
  })
  /*  const ans = aggregateData(
    '../extra/run/fff',
    ['0', '2', '4'],
    'sim_param.json',
    'received_packet_statistic.csv',
    'layer IV port 0',
    'Total BW'
  ) */
  return apiResponse(res)('success')
})

export { router as ApiRouter }
