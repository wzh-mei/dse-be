import * as express from 'express'
import * as multer from 'multer'
import * as fs from 'fs'
import { Request, Response } from 'express'
import {
  DPRange,
  DPSetList,
  generateDPCSVFiles,
  parseDPCSVFile
} from './dphelper'
import { generateSimulationsWithDpSetList } from './jobhelper'
import { aggregateData } from './datahelper'

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
  const upload = multer({ dest: 'extra/dps/upload' }).single('file')
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
  const simParams = req.body.simParams
  const templateDPpath = req.params.templateDPpath
  const dpset = new DPSetList([], [])
  for (const i in simParams) {
    const param = simParams[i]
    const dp: DPRange = {
      key: param.name,
      value: param.values
    }
    dpset.desProduct(dp)
  }
  const genDPs = generateDPCSVFiles(
    '../extra/dps/gen',
    templateDPpath,
    'cofs_dp_gen',
    dpset
  )
  const subfolder = new Date().toISOString().replace(/:/g, '.')
  genDPs.then(csvs => {
    generateSimulationsWithDpSetList(
      'maywzh',
      '../extra/run',
      subfolder,
      '../extra/bin/sample_compute_die_8x8_top.exe',
      csvs,
      '5us',
      '27000@10.239.44.116'
    )
  })
  const ans = aggregateData(
    '../extra/run/fff',
    ['0', '2', '4'],
    'sim_param.json',
    'received_packet_statistic.csv',
    'layer IV port 0',
    'Total BW'
  )
  return apiResponse(res)(ans)
})

export { router as ApiRouter }
