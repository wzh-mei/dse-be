import { getUserQueue } from './queueworker'
import { Job } from 'bullmq'
import * as fs from 'fs'
import * as path from 'path'
import { DPFile } from './types'

/**
 * Generate A job in one simulation
 * @param queueUserName
 * @param simulationId
 * @param simulationName
 * @param simulationTime
 * @param workspacePath
 * @param exePath
 * @param dpCSV
 * @param jobName
 * @param depName
 * @param params
 * @returns
 */
export async function generateSimulationJob (
  queueUserName: string,
  simulationId: string,
  simulationName: string,
  simulationTime: Date,
  workspacePath: string,
  exePath: string,
  dpCSV: DPFile,
  jobName: string,
  depName: string,
  params?: { [key: string]: string | number | boolean }
): Promise<Job<any, any, string>> {
  const cmdQueue = getUserQueue(queueUserName).queue
  const cwd = path.resolve(`${workspacePath}/${jobName}`)
  exePath = path.resolve(exePath)
  const exeDir = path.dirname(exePath)
  if (!fs.existsSync(cwd)) {
    fs.mkdirSync(cwd, { recursive: true })
  }

  if (fs.existsSync(path.resolve(exeDir, depName))) {
    fs.symlinkSync(
      path.resolve(exeDir, depName),
      path.resolve(cwd, depName),
      'dir'
    )
  }
  fs.writeFileSync(`${cwd}/sim_param.json`, JSON.stringify(dpCSV.param))
  const dpCSVPath = path.resolve(dpCSV.file)
  let args = [`${exePath}`, `--cf-dp-values-file=${dpCSVPath}`]
  for (const paramName in params) {
    args.push(`--${paramName}=${params[paramName]}`)
  }
  const cmd = args[0]
  args = args.slice(1, args.length)
  const data = await cmdQueue.add(jobName, {
    cmd,
    cwd,
    args,
    simulationId,
    simulationName,
    simulationTime: simulationTime.getTime()
  })
  return data
}

/**
 * Generate a simulation
 * @param queueUserName
 * @param workspacePath
 * @param simulationId
 * @param simulationName User input sim name
 * @param simulationTime
 * @param exePath
 * @param dpCSVFiles
 * @param depName
 * @param params
 * @returns
 */
export async function generateSimulation (
  queueUserName: string,
  workspacePath: string,
  simulationId: string,
  simulationName: string,
  simulationTime: Date,
  exePath: string,
  dpCSVFiles: DPFile[],
  depName: string,
  params?: { [key: string]: string | number | boolean }
): Promise<{ name: string; jobs: Job<any, any, string>[] }> {
  const genSimulationJobs = []
  const subWorkspacePath = `${simulationName}-${simulationTime.getTime()}`
  const workDir = `${workspacePath}/${subWorkspacePath}`
  for (const idx in dpCSVFiles) {
    genSimulationJobs.push(
      await generateSimulationJob(
        queueUserName,
        simulationId,
        simulationName,
        simulationTime,
        workDir,
        exePath,
        dpCSVFiles[idx],
        idx,
        depName,
        params
      )
    )
  }
  return { name: simulationName, jobs: genSimulationJobs }
}
