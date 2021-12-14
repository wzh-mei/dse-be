import * as ini from 'ini'
import * as path from 'path'
import * as fs from 'fs'
import Logger from './logger'

const readIni = (inipath: string) => {
  Logger.info(`Load inifile from ${inipath}`)
  if (!fs.existsSync(inipath)) {
    Logger.warn(`Not found inifile from ${inipath}`)
    return null
  }
  Logger.info(`Loaded inifile from ${inipath}`)

  const Info = ini.parse(fs.readFileSync(inipath, 'utf-8'))
  return Info
}
const iniPath = path.resolve(__dirname, '../../config/config.ini')
const iniConf = readIni(iniPath)
const dpcsvUploadDir = iniConf?.common.dpcsvUploadDir
  ? iniConf.common.dpcsvUploadDir
  : 'C:/Service/dse-be/upload/dpcsv/'

const dpcsvGenerateDir = iniConf?.common.dpcsvGenerateDir
  ? iniConf.common.dpcsvGenerateDir
  : 'C:/Service/dse-be/gen/run/'

const dpcsvGenerateTemplateNamePrefix = iniConf?.common
  .dpcsvGenerateTemplateNamePrefix
  ? iniConf.common.dpcsvGenerateTemplateNamePrefix
  : 'cofs_dp_gen'

const paramfileUploadDir = iniConf?.common.paramfileUploadDir
  ? iniConf.common.paramfileUploadDir
  : 'C:/Service/dse-be/upload/paramfile/'

const paramfileGenerateDir = iniConf?.common.paramfileGenerateDir
  ? iniConf.common.paramfileGenerateDir
  : 'C:/Service/dse-be/gen/paramfile/'

const paramfileGenerateTemplateNamePrefix = iniConf?.common
  .paramfileGenerateTemplateNamePrefix
  ? iniConf?.common.paramfileGenerateTemplateNamePrefix
  : 'paramfile'

const workQueueName = iniConf?.common.workQueueName
  ? iniConf.common.workQueueName
  : 'DSE'

const simulationRunDir = iniConf?.common.simulationRunDir
  ? iniConf.common.simulationRunDir
  : 'C:/Service/dse-be/gen/run/'

const simulationBinDir = iniConf?.common.simulationBinDir
  ? iniConf.common.simulationBinDir
  : 'C:/Service/dse-be/extra/bin/'

const logDir = iniConf?.common.logDir
  ? iniConf.common.logDir
  : 'C:/Service/dse-be/logs/'

export {
  dpcsvUploadDir,
  dpcsvGenerateDir,
  dpcsvGenerateTemplateNamePrefix,
  paramfileUploadDir,
  paramfileGenerateDir,
  paramfileGenerateTemplateNamePrefix,
  workQueueName,
  simulationRunDir,
  simulationBinDir,
  logDir
}
