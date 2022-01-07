export type DPFile = {
  param: { [key: string]: any }
  file: string
  dpName: string
}

export type DPType = string | number | boolean | DPFile

// type treeNodeTypesObj = {
//   [key: string]: treeNodeType
// }

// type treeDataType = treeNodeType[]

export type DPSet = {
  [key: string]: DPType
}

export type DPRange = {
  key: string
  value: Array<DPType>
}

// export type IDPFileList {
//   keys: Array<string>
//   data: Array<DPFile>
// }

export type FileDPSetDict = {
  [key: string]: DPSet
}

export interface IDPSetList {
  keys: Array<string>
  data: Array<DPSet>
  desProduct: (arg0: DPRange) => IDPSetList
}

export type DataStat = {
  param: any
  data: any
}

export type CSVRecord = { [key: string]: any }

export type paramInfo = { [key: string]: string }

export type JobInfo = {
  id: any
  name: string
  createTime: number
  finishTime: number
  state: string
  simulationId: string
  simulationName: string
  simulationTime: number
}

export type SimulationInfo = {
  id: string
  name: string
  createTime: number
  active: JobInfo[]
  failed: JobInfo[]
  completed: JobInfo[]
  delayed: JobInfo[]
  waiting: JobInfo[]
}

export type SimulationStatInfo = {
  id: string
  name: string
  createTime: number
  activeCount: number
  failedCount: number
  completedCount: number
  delayedCount: number
  waitingCount: number
}
