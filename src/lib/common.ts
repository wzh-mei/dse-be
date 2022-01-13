/* eslint-disable no-eval */
import { CSVRecord, DPSet, DPType } from './types'
import * as fs from 'fs'
import { Request, Response } from 'express'
import Logger from './logger'
const parse = require('csv-parse/lib/sync')

export function jsonPathTranslate (jPath: string): string {
  if (!(jPath.startsWith('[') && jPath.endsWith(']'))) {
    jPath = jPath
      .split('.')
      .map(x => {
        return `["${x}"]`
      })
      .join('')
  }
  return jPath
}

export function setJsonValue (_obj: DPSet, _key: string, _value: DPType): DPSet {
  const _nKey = jsonPathTranslate(_key)
  const objValue = eval(`_obj${jsonPathTranslate(_nKey)}`)

  if (typeof objValue === 'string') {
    eval(`_obj${_nKey}='${_value}'`)
  } else {
    eval(`_obj${_nKey}=${_value}`)
  }
  return _obj
}

export function parseDPCSVFile (filePath: string): string[] {
  const dpFileContents = fs.readFileSync(filePath)
  const dpParams = parse(dpFileContents, {
    columns: true
  })
  const ans = []
  for (let i = 0; i < dpParams.length; i++) {
    ans.push(dpParams[i].design_parameter_name)
  }
  return ans
}

export function parseJsonFile (filePath: string): string[] {
  const jsonFileContents = fs.readFileSync(filePath)
  const jsonFileObj = JSON.parse(jsonFileContents.toString())

  return jsonFileObj
}

export function toCSV (records: CSVRecord[]): string {
  const header = Object.keys(records[0])
  const headerLine = header.join(',')
  let csv = headerLine + '\n'
  records.forEach((record: any) => {
    csv +=
      header
        .map(key => (record[key].length <= 0 ? '""' : record[key]))
        .join(',') + '\n'
  })
  return csv
}

export const apiResponse = (res: Response, status = 200) => (
  data: any,
  success?: boolean,
  errorMsg?: string,
  error?: Error
) => {
  return res.status(status).json(data)
}

export const apiError = (res: Response, status = 500) => (
  errorMsg: string,
  error?: Error
) => {
  return res.status(status).json({ errorMsg, error })
}

export const commonHandler = (
  req: Request,
  res: Response,
  func: (r: Request) => any
) => {
  try {
    return apiResponse(res)(func(req))
  } catch (err) {
    Logger.error(err)
    return apiError(res)((err as Error).message, err as Error)
  }
}

export const commonAsyncHandler = async (
  req: Request,
  res: Response,
  func: (r: Request) => Promise<any>
) => {
  try {
    return apiResponse(res)(await func(req))
  } catch (err) {
    Logger.error(err)
    return apiError(res)((err as Error).message, err as Error)
  }
}

// export const asyncApiHandlerGenerator =
//   (func: (r: Request) => Promise<any>) => (req: Request, res: Response) =>
//     commonAsyncHandler(req, res, func)

// export const apiHandlerGenerator =
//   (func: (r: Request) => Promise<any>) => (req: Request, res: Response) =>
//     commonHandler(req, res, func)
