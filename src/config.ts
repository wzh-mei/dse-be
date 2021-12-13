import * as ini from 'ini'
import * as path from 'path'
import * as fs from 'fs'

const readIni = (inipath: string) => {
  if (!fs.existsSync(inipath)) {
    return null
  }
  const Info = ini.parse(fs.readFileSync(inipath, 'utf-8'))
  return Info
}
const iniConf = readIni(
  path.resolve('/home/wmei/Workspace/dse-be/config/config.ini')
)

const dpcsvUploadDir = iniConf?.common.dpcsvUploadDir
  ? iniConf.common.dpcsvUploadDir
  : 'C:/Service/dse-be/upload/dpcsv/'

const dpcsvGenerateDir = iniConf?.common.dpcsvGenerateDir
  ? iniConf.common.dpcsvGenerateDir
  : 'C:/Service/dse-be/gen/dpcsv/'

const dpcsvGenerateTemplateNamePrefix = iniConf?.common
  .dpcsvGenerateTemplateNamePrefix
  ? iniConf.common.dpcsvGenerateTemplateNamePrefix
  : 'cofs_dp_gen'

const paramfileUploadDir = iniConf?.common.paramfileUploadDir
  ? iniConf.common.paramfileUploadDir
  : 'C:/Service/dse-be/upload/paramfile/'

const workQueueName = iniConf?.common.workQueueName
  ? iniConf.common.workQueueName
  : 'DSE'

const simulationRunDir = iniConf?.common.simulationRunDir
  ? iniConf.common.simulationRunDir
  : 'C:/Service/dse-be/gen/simrun/'

const simulationBinDir = iniConf?.common.simulationBinDir
  ? iniConf.common.simulationBinDir
  : 'C:/Service/dse-be/extra/bin/sample_compute_die_8x8_top.exe'

export {
  dpcsvUploadDir,
  dpcsvGenerateDir,
  dpcsvGenerateTemplateNamePrefix,
  paramfileUploadDir,
  workQueueName,
  simulationRunDir,
  simulationBinDir
}
