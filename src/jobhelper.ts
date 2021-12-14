import { getUserQueue } from './queueworker'
import { Job } from 'bullmq'
import * as fs from 'fs'
import * as path from 'path'
import { DPFile } from './dphelper'

export async function generateSimulation (
  queueUserName: string,
  workspacePath: string,
  exePath: string,
  dpCSV: DPFile,
  taskName: string,
  simDuration: string,
  license: string
): Promise<Job<any, any, string>> {
  const cmdQueue = getUserQueue(queueUserName).queue
  let cwd = `${workspacePath}/${taskName}`
  if (fs.existsSync(cwd)) {
    fs.rmSync(cwd, { recursive: true })
    fs.mkdirSync(cwd, { recursive: true })
  } else {
    fs.mkdirSync(cwd, { recursive: true })
  }
  fs.writeFileSync(`${cwd}/sim_param.json`, JSON.stringify(dpCSV.param))
  cwd = path.resolve(cwd)
  exePath = path.resolve(exePath)
  const dpCSVPath = path.resolve(dpCSV.file)
  let args = [
    `${exePath}`,
    `--cf-dp-values-file=${dpCSVPath}`,
    `--cf-lic-location=${license}`,
    `--cf-sim-duration=${simDuration}`
  ]
  const cmd = args[0]
  args = args.slice(1, args.length)
  const data = await cmdQueue.add(taskName, {
    cmd,
    args,
    cwd
  })
  return data
}

export async function generateSimulationJob (
  queueUserName: string,
  workspacePath: string,
  exePath: string,
  dpCSV: DPFile,
  taskName: string,
  params: { [key: string]: string | number | boolean }
): Promise<Job<any, any, string>> {
  const cmdQueue = getUserQueue(queueUserName).queue
  let cwd = `${workspacePath}/${taskName}`
  if (!fs.existsSync(cwd)) {
    fs.mkdirSync(cwd, { recursive: true })
  }
  fs.writeFileSync(`${cwd}/sim_param.json`, JSON.stringify(dpCSV.param))
  cwd = path.resolve(cwd)
  exePath = path.resolve(exePath)
  const dpCSVPath = path.resolve(dpCSV.file)
  let args = [`${exePath}`, `--cf-dp-values-file=${dpCSVPath}`]
  for (const paramName in params) {
    args.push(`--${paramName}=${params[paramName]}`)
  }
  console.log(args.join(' '))
  const cmd = args[0]
  args = args.slice(1, args.length)
  const data = await cmdQueue.add(taskName, {
    cmd,
    args,
    cwd
  })
  return data
}

export async function generateSimulationsWithDpSetList (
  queueUserName: string,
  workspacePath: string,
  subWorkspacePath: string,
  exePath: string,
  dpCSVFiles: DPFile[],
  params: { [key: string]: string | number | boolean }
): Promise<any> {
  const res = []
  const workDir = `${workspacePath}/${subWorkspacePath}`
  for (const idx in dpCSVFiles) {
    res.push(
      await generateSimulationJob(
        queueUserName,
        workDir,
        exePath,
        dpCSVFiles[idx],
        idx,
        params
      )
    )
  }
  return res
}
