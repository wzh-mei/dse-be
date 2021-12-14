/* eslint-disable no-eval */
import * as fs from 'fs'
import * as path from 'path'
import parse = require('csv-parse/lib/sync')
import ObjectsToCsv = require('objects-to-csv')

export type DPFile = {
  param: { [key: string]: any }
  file: string
  dpName: string
}

export type DPType = string | number | boolean | DPFile

type treeNodeType = {
  title: string | number
  value: string | number
  children: treeNodeType[]
}

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

function jsonPathTranslate (jPath: string): string {
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

function setJsonValue (_obj: DPSet, _key: string, _value: DPType): DPSet {
  const _nKey = jsonPathTranslate(_key)
  if (typeof _value === 'string') {
    console.log(`_obj${jsonPathTranslate(_nKey)}='${_value}'`)
    eval(`_obj${jsonPathTranslate(_nKey)}='${_value}'`)
  } else {
    console.log(`_obj${jsonPathTranslate(_nKey)}=${_value}`)
    eval(`_obj${jsonPathTranslate(_nKey)}=${_value}`)
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

// function parseJson2TreeData (json: {
//   [key: string]: number | string | object
// }): treeNodeType {
//   const ans: treeNodeType = { title: 'object', value: 'object', children: [] }

//   for (const k in json) {
//     const newObj: treeNodeType = { title: k, value: k, children: [] }
//     if (json[k] instanceof Array && Object.keys(json[k]).length > 0) {
//       for (let i = 0; i < Object.keys(json[k]).length; i++) {
//         const a = parseJson2TreeData(json[k][i])
//         newObj.children.push(a)
//       }
//     } else if (json[k] instanceof Object && Object.keys(json[k]).length > 0) {
//       for (const kk in json[k].keys) {
//         newObj.children.push(parseJson2TreeData(json[k][kk]))
//       }
//     }
//   }
//   return ans
// }

export function parseJsonFile (filePath: string): string[] {
  const jsonFileContents = fs.readFileSync(filePath)
  const jsonFileObj = JSON.parse(jsonFileContents.toString())

  return jsonFileObj
}

export function generateDPInputFiles (
  workspaceDirPath: string,
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

  if (fs.existsSync(workspaceDirPath)) {
    fs.rmSync(workspaceDirPath, { recursive: true })
    fs.mkdirSync(workspaceDirPath, { recursive: true })
  } else {
    fs.mkdirSync(workspaceDirPath, { recursive: true })
  }
  dpSets.data.forEach((dpSet, i) => {
    let outputObj = { ...templateFileJsonObj }
    for (const k in dpSet) {
      outputObj = setJsonValue(outputObj, k, dpSet[k])
    }
    const genFilePath = `${workspaceDirPath}/${genTemplateName}${i}.${fileExtension}`
    fs.writeFileSync(genFilePath, JSON.stringify(outputObj))
    res.push({ param: dpSet, file: path.resolve(genFilePath), dpName: dpName })
  })
  return res
}

export function generateDPInputFilesInSubDir (
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

export async function generateDPCSVFiles (
  workspaceDirPath: string,
  templateFilePath: string,
  genTemplateName: string,
  dpSets: DPSetList
): Promise<DPFile[]> {
  const res: DPFile[] = []
  const fileExtension = templateFilePath.substring(
    templateFilePath.lastIndexOf('.') + 1
  )
  const templateFileContents = fs.readFileSync(templateFilePath)
  const templateRecords = parse(templateFileContents, {
    columns: true
  })
  if (fs.existsSync(workspaceDirPath)) {
    fs.rmSync(workspaceDirPath, { recursive: true })
    fs.mkdirSync(workspaceDirPath, { recursive: true })
  } else {
    fs.mkdirSync(workspaceDirPath, { recursive: true })
  }
  dpSets.data.forEach(async (dpSet, i) => {
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
    const csv = new ObjectsToCsv(templateRecords)
    const genFilePath = `${workspaceDirPath}/${genTemplateName}${i}.${fileExtension}`
    res.push({ param: dpSet, file: path.resolve(genFilePath), dpName: '' })
    await csv.toDisk(genFilePath)
  })
  return res
}

export async function generateDPCSVFilesInSubDir (
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
  const templateRecords = parse(templateFileContents, {
    columns: true
  })
  const workDirPath = path.join(workspaceDirPath, subDirPath)
  if (fs.existsSync(workDirPath)) {
    fs.rmSync(workDirPath, { recursive: true })
    fs.mkdirSync(workDirPath, { recursive: true })
  } else {
    fs.mkdirSync(workDirPath, { recursive: true })
  }
  dpSets.data.forEach(async (dpSet, idx) => {
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
    const csv = new ObjectsToCsv(templateRecords)
    const genFilePath = `${workDirPath}/${idx}/${genTemplateName}.${fileExtension}`
    if (fs.existsSync(`${workDirPath}/${idx}`)) {
      fs.rmSync(`${workDirPath}/${idx}`, { recursive: true })
      fs.mkdirSync(`${workDirPath}/${idx}`, { recursive: true })
    } else {
      fs.mkdirSync(`${workDirPath}/${idx}`, { recursive: true })
    }
    res.push({ param: dpSet, file: path.resolve(genFilePath), dpName: '' })
    await csv.toDisk(genFilePath)
  })
  return res
}
