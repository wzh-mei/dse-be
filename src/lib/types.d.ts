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
