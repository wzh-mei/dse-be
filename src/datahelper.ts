import * as fs from 'fs'

type dataStat = {
  param: any
  data: any
}

function readFileLines (filename: string): string[] {
  return fs
    .readFileSync(filename)
    .toString()
    .split('\n')
}

// function readData (
//   workSpace: string,
//   fileName: string,
//   domainKeyword: string,
//   dataKeyword: string
// ): string {
//   const dataFilePath = `${workSpace}/${fileName}`
//   // const dataFile = fs.readFileSync(dataFilePath)
//   const dataFileRl = readline.createInterface({
//     input: fs.createReadStream(dataFilePath)
//   })
//   let domainTest = false
//   let dataTest = false
//   let res = ''
//   dataFileRl.on('line', function (line) {
//     const re1 = new RegExp(domainKeyword)
//     const re2 = new RegExp(dataKeyword)
//     if (re1.test(line)) {
//       domainTest = true
//     }
//     if (domainTest && !dataTest && re2.test(line)) {
//       dataTest = true
//       res = line
//     }
//   })
//   return res
// }

export function getStatistic (
  workDir: string,
  fileName: string,
  domainKeyword: string,
  dataKeyword: string
): string {
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
      console.log(line)
      domainTest = true
    }
    if (domainTest && !dataTest && re2.test(line)) {
      dataTest = true
      console.log(line)
      res = line.trim()
    }
  }
  return res
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
): dataStat[] {
  const res: dataStat[] = []
  for (const i in workDirRange) {
    const subDir = `${workSpace}/${workDirRange[i]}`
    res.push({
      param: getParam(subDir, paramFileName),
      data: getStatistic(subDir, dataFileName, domainKeyword, dataKeyword)
    })
  }
  return res
}
