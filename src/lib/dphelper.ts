/* eslint-disable no-eval */
import * as fs from 'fs'
import * as path from 'path'
import parse = require('csv-parse/lib/sync')
import { CSVRecord, DPFile, DPRange, DPSet, IDPSetList } from './types'
import { setJsonValue, toCSV } from './common'

export class DPSetList implements IDPSetList {
  keys: Array<string>
  data: Array<DPSet>
  constructor (keys: Array<string>, data: Array<DPSet>) {
    this.keys = keys
    this.data = data
  }

  desProduct (dpRange: DPRange): DPSetList {
    if (this.keys.indexOf(dpRange.key) !== -1) return this
    this.keys.push(dpRange.key)
    if (this.data.length <= 0) {
      for (const i in dpRange.value) {
        const newObj: DPSet = {}
        newObj[dpRange.key] = dpRange.value[i]
        this.data.push(newObj)
      }
    } else {
      const newData: Array<DPSet> = []
      for (const i in this.data) {
        const obj = this.data[i]
        for (const j in dpRange.value) {
          const cpObj = { ...obj }
          cpObj[dpRange.key] = dpRange.value[j]
          newData.push(cpObj)
        }
      }
      this.data = newData
    }
    return this
  }
}

/**
 * Generate param files
 * @param workspaceDirPath
 * @param subDirPath
 * @param templateFilePath
 * @param genTemplateName
 * @param dpName
 * @param dpSets
 * @returns
 */
export function generateDPInputFiles (
  workspaceDirPath: string,
  subDirPath: string,
  templateFilePath: string,
  genTemplateName: string,
  dpName: string,
  dpSets: DPSetList
): DPFile[] {
  const res: DPFile[] = []
  const templateFileContents = fs.readFileSync(templateFilePath)
  const templateFileJsonObj: DPSet = JSON.parse(templateFileContents.toString())
  const fileExtension = templateFilePath.substring(
    templateFilePath.lastIndexOf('.') + 1
  )
  const workDir = path.resolve(workspaceDirPath, subDirPath)

  if (fs.existsSync(workDir)) {
    fs.rmSync(workDir, { recursive: true })
    fs.mkdirSync(workDir, { recursive: true })
  } else {
    fs.mkdirSync(workDir, { recursive: true })
  }
  dpSets.data.forEach((dpSet, i) => {
    let outputObj = { ...templateFileJsonObj }
    for (const k in dpSet) {
      outputObj = setJsonValue(outputObj, k, dpSet[k])
    }
    const genFilePath = `${workDir}/${genTemplateName}${i}.${fileExtension}`
    fs.writeFileSync(genFilePath, JSON.stringify(outputObj))
    res.push({ param: dpSet, file: path.resolve(genFilePath), dpName: dpName })
  })
  return res
}

/**
 * Generate dp csv files
 * @param workspaceDirPath
 * @param subDirPath
 * @param templateFilePath
 * @param genTemplateName
 * @param dpSets
 * @returns
 */
export async function generateDPCSVFiles (
  workspaceDirPath: string,
  subDirPath: string,
  templateFilePath: string,
  genTemplateName: string,
  dpSets: DPSetList
): Promise<DPFile[]> {
  const res: DPFile[] = []
  const fileExtension = templateFilePath.substring(
    templateFilePath.lastIndexOf('.') + 1
  )
  const templateFileContents = fs.readFileSync(templateFilePath)
  const templateRecords: CSVRecord[] = parse(templateFileContents, {
    columns: true
  })
  const workDirPath = path.join(workspaceDirPath, subDirPath)
  if (fs.existsSync(workDirPath)) {
    fs.rmSync(workDirPath, { recursive: true })
    fs.mkdirSync(workDirPath, { recursive: true })
  } else {
    fs.mkdirSync(workDirPath, { recursive: true })
  }
  dpSets.data.forEach((dpSet, idx) => {
    for (let i = 0; i < templateRecords.length; i++) {
      const templateRecord = templateRecords[i]
      const dpn = templateRecord.design_parameter_name
      if (dpn in dpSet) {
        if (typeof dpSet[dpn] === 'object') {
          templateRecord.value = (dpSet[dpn] as DPFile).file
        } else {
          templateRecord.value = dpSet[dpn]
        }
      }
    }

    const csv = toCSV(templateRecords)
    const genFilePath = `${workDirPath}/${idx}/${genTemplateName}.${fileExtension}`
    if (fs.existsSync(`${workDirPath}/${idx}`)) {
      fs.rmSync(`${workDirPath}/${idx}`, { recursive: true })
      fs.mkdirSync(`${workDirPath}/${idx}`, { recursive: true })
    } else {
      fs.mkdirSync(`${workDirPath}/${idx}`, { recursive: true })
    }
    res.push({ param: dpSet, file: path.resolve(genFilePath), dpName: '' })
    // await csv.toDisk(genFilePath)
    fs.writeFileSync(genFilePath, csv)
  })
  return res
}
