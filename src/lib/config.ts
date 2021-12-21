import * as ini from 'ini'
import * as path from 'path'
import * as fs from 'fs'
import Logger from './logger'

const readIni = (iniPath: string) => {
  Logger.info(`Load config file from ${iniPath}`)
  if (!fs.existsSync(iniPath)) {
    Logger.warn(`No config file found in ${iniPath}`)
    return null
  }
  Logger.info(`Loaded config file from ${iniPath}`)

  const Info = ini.parse(fs.readFileSync(iniPath, 'utf-8'))
  return Info
}

const iniPath =
  process.env.CONFIG || path.resolve(__dirname, '../../config/config.ini')

const iniConf = readIni(iniPath)
const dpcsvUploadDir = iniConf?.common.dpcsvUploadDir
  ? iniConf.common.dpcsvUploadDir
  : process.platform === 'win32'
    ? 'C:/Service/dse-be/upload/dpcsv/'
    : '/srv/dse-be/upload/dpcsv'

const dpcsvGenerateDir = iniConf?.common.dpcsvGenerateDir
  ? iniConf.common.dpcsvGenerateDir
  : process.platform === 'win32'
    ? 'C:/Service/dse-be/gen/dpcsv/'
    : '/srv/dse-be/gen/dpcsv'

const dpcsvGenerateTemplateNamePrefix = iniConf?.common
  .dpcsvGenerateTemplateNamePrefix
  ? iniConf.common.dpcsvGenerateTemplateNamePrefix
  : 'cofs_dp'

const paramfileUploadDir = iniConf?.common.paramfileUploadDir
  ? iniConf.common.paramfileUploadDir
  : process.platform === 'win32'
    ? 'C:/Service/dse-be/upload/paramfile/'
    : '/srv/dse-be/upload/upload/paramfile'

const paramfileGenerateDir = iniConf?.common.paramfileGenerateDir
  ? iniConf.common.paramfileGenerateDir
  : process.platform === 'win32'
    ? 'C:/Service/dse-be/gen/paramfile/'
    : '/srv/dse-be/gen/paramfile'

const paramfileGenerateTemplateNamePrefix = iniConf?.common
  .paramfileGenerateTemplateNamePrefix
  ? iniConf?.common.paramfileGenerateTemplateNamePrefix
  : 'paramfile'

const workQueueName = iniConf?.common.workQueueName
  ? iniConf.common.workQueueName
  : 'DSE'

const appUploadDir = iniConf?.common.appUploadDir
  ? iniConf.common.appUploadDir
  : process.platform === 'win32'
    ? 'C:/Service/dse-be/upload/bin/'
    : '/srv/dse-be/upload/bin'

const tmpUploadDir = iniConf?.common.tmpUploadDir
  ? iniConf.common.tmpUploadDir
  : process.platform === 'win32'
    ? 'C:/Service/dse-be/upload/tmp/'
    : '/srv/dse-be/upload/tmp'

const simulationRunDir = iniConf?.common.simulationRunDir
  ? iniConf.common.simulationRunDir
  : process.platform === 'win32'
    ? 'C:/Service/dse-be/gen/simulation/'
    : '/srv/dse-be/gen/simulation'

const simulationBinDir = iniConf?.common.simulationBinDir
  ? iniConf.common.simulationBinDir
  : process.platform === 'win32'
    ? 'C:/Service/dse-be/extra/bin/'
    : '/srv/dse-be/extra/bin'

const logDir = iniConf?.common.logDir
  ? iniConf.common.logDir
  : process.platform === 'win32'
    ? 'C:/Service/dse-be/logs/'
    : '/srv/dse-be/logs'

export {
  dpcsvUploadDir,
  dpcsvGenerateDir,
  dpcsvGenerateTemplateNamePrefix,
  paramfileUploadDir,
  paramfileGenerateDir,
  paramfileGenerateTemplateNamePrefix,
  workQueueName,
  appUploadDir,
  tmpUploadDir,
  simulationRunDir,
  simulationBinDir,
  logDir
}
