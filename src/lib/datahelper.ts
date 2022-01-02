import * as fs from 'fs'
import Logger from './logger'
import { DataStat } from './types'

function readFileLines (filename: string): string[] {
  return fs.readFileSync(filename).toString().split('\n')
}

export function getStatistic (
  workDir: string,
  fileName: string,
  domainKeyword: string,
  dataKeyword: string
): string {
  try {
    const dataFilePath = `${workDir}/${fileName}`
    // const dataFile = fs.readFileSync(dataFilePath)
    const dataFileLines = readFileLines(dataFilePath)
    let domainTest = false
    let dataTest = false
    let res = ''
    for (const i in dataFileLines) {
      const line = dataFileLines[i]
      const re1 = new RegExp(domainKeyword)
      const re2 = new RegExp(dataKeyword)
      if (re1.test(line)) {
        Logger.debug(line)
        domainTest = true
      }
      if (domainTest && !dataTest && re2.test(line)) {
        dataTest = true
        Logger.debug(line)
        res = line.trim()
      }
    }
    return res
  } catch (err) {
    Logger.error(err)
    return ''
  }
}

export function getParam (workDir: string, fileName: string): any {
  const dataFilePath = `${workDir}/${fileName}`
  const dataFileJson = JSON.parse(fs.readFileSync(dataFilePath).toString())
  return dataFileJson
}

export function aggregateData (
  workSpace: string,
  workDirRange: string[],
  paramFileName: string,
  dataFileName: string,
  domainKeyword: string,
  dataKeyword: string
): DataStat[] {
  const res: DataStat[] = []
  for (const i in workDirRange) {
    const subDir = `${workSpace}/${workDirRange[i]}`
    res.push({
      param: getParam(subDir, paramFileName),
      data: getStatistic(subDir, dataFileName, domainKeyword, dataKeyword)
    })
  }
  return res
}

/**
 * Aggregate selected data from exe run directory
 * @param workDirs
 * @param paramFileName
 * @param dataFileName
 * @param domainKeyword
 * @param dataKeyword
 * @returns
 */
export function aggregateDatas (
  workDirs: string[],
  paramFileName: string,
  dataFileName: string,
  domainKeyword: string,
  dataKeyword: string
): DataStat[] {
  const res: DataStat[] = []
  for (const workDir of workDirs) {
    res.push({
      param: getParam(workDir, paramFileName),
      data: getStatistic(workDir, dataFileName, domainKeyword, dataKeyword)
    })
  }
  return res
}
