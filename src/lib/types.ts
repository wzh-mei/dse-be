// design parameter of file type
export type DPFile = {
  param: { [key: string]: any }
  file: string
  dpName: string
}

// Valid design parameter types
export type DPType = string | number | boolean | DPFile

// type treeNodeTypesObj = {
//   [key: string]: treeNodeType
// }

// type treeDataType = treeNodeType[]

/**
 * A set of design parameters
 */
export type DPSet = {
  [key: string]: DPType
}

/**
 * Design parameter range
 * @key Design parameter name
 * @value Design parameter value range
 */
export type DPRange = {
  key: string
  value: Array<DPType>
}

/**
 * A set of DPSet, meaning a simulation with different job of different dpset
 */
export interface IDPSetList {
  keys: Array<string>
  data: Array<DPSet>
  cartProduct: (arg0: DPRange) => IDPSetList
}

export type DataStat = {
  param: any
  data: any
}

export type CSVRecord = { [key: string]: any }

export type ParamInfo = { [key: string]: string }

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
