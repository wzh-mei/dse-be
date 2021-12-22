import { getUserQueue } from './queueworker'
import { Job } from 'bullmq'
import * as fs from 'fs'
import * as path from 'path'
import { DPFile } from './types'

/**
 * Generate a job in a simulation
 *
 * @param queueUserName: username of bullmq queue
 * @param simulationName: simulation name
 * @param workspacePath: workspace path
 * @param exePath: simulation exe path
 * @param dpCSV: dpcsv file info
 * @param jobName: job name
 * @param params: simulation parameters
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
  params?: { [key: string]: string | number | boolean }
): Promise<Job<any, any, string>> {
  const cmdQueue = getUserQueue(queueUserName).queue
  const cwd = path.resolve(`${workspacePath}/${jobName}`)
  exePath = path.resolve(exePath)
  if (!fs.existsSync(cwd)) {
    fs.mkdirSync(cwd, { recursive: true })
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
 *
 * @param queueUserName
 * @param workspacePath
 * @param subWorkspacePath
 * @param exePath
 * @param dpCSVFiles
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
  params?: { [key: string]: string | number | boolean }
): Promise<{ name: string; jobs: Job<any, any, string>[] }> {
  const genSimulationJobs = []
  const subWorkspacePath = simulationName
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
        params
      )
    )
  }
  return { name: simulationName, jobs: genSimulationJobs }
}
