import {
  DPRange,
  DPSetList,
  generateDPInputFiles,
  generateDPCSVFiles
} from './dphelper'

import { generateSimulationsWithDpSetList } from './jobhelper'

import { aggregateData } from './datahelper'

const ijr = {
  key: 'streams.0.ops.1.inject_rate',
  value: [0.1, 0.11, 0.12]
}

// const bs = { key: 'streams.0.batch_size', value: [-1, 1] }

const genStreamsRes = new DPSetList([], [])

genStreamsRes.desProduct(ijr)
const genedFiles = generateDPInputFiles(
  '../extra/stream/gen-streams',
  '../extra/stream/stream_core_4c_to_all.json',
  'stream',
  'DP_STREAM_FILE',
  genStreamsRes
)
console.log(genedFiles)

const dp3: DPRange = {
  key: 'DP_STREAM_FILE',
  value: genedFiles
}

// const dp4: DPRange = {
//   key: 'DP_IGR_ARB_PHASE',
//   value: [0.06, 0.07]
// }
const dpset = new DPSetList([], [])
dpset.desProduct(dp3)
console.log(dpset)

const genedDpCSVs = generateDPCSVFiles(
  '../extra/dps/gen',
  '../extra/dps/cofs_dp.csv',
  'cofs_dp_gen',
  dpset
)

// // genedDpCSVs.then(data => {
// //   console.log(data)
// //   console.log(data.map(e => e.param))
// // })

const subfolder = new Date().toISOString().replace(/:/g, '.')

genedDpCSVs.then(csvs => {
  generateSimulationsWithDpSetList(
    'maywzh',
    '../extra/run',
    subfolder,
    '../extra/bin/sample_compute_die_8x8_top.exe',
    csvs,
    '5us',
    '27000@10.239.44.116'
  )
})

// const ans = aggregateData(
//   '../extra/run/fffnsins'[('0', '2', '4')],
//   'sim_param.json',
//   'received_packet_statistic.csv',
//   'layer IV port 0',
//   'Total BW'
// )

// console.log(ans)

// fs.writeFileSync('../extra/out.json', JSON.stringify({ data: ans }))

// genedDpCSVs.then(data => {
//   console.log(data)
//   generateSimulationsWithDpSetList(
//     'maywzh',
//     '../extra/run',
//     '5us',
//     '27000@10.239.44.116',
//     '../extra/bin/sample_compute_die_8x8_top.exe',
//     data
//   )
// })
// genedDpCSVs.then(data => {
//   for (const idx in data) {
//     generateSimulation(
//       'maywzh',
//       '../extra/run',
//       '../extra/bin/sample_compute_die_8x8_top.exe',
//       data[idx],
//       new Date().toISOString(),
//       '5us',
//       '27000@10.239.44.116'
//     )
//   }
// })

// const data = generateSimulation(
//   'maywzh',
//   '../extra/run',
//   '../extra/bin/sample_compute_die_8x8_top.exe',
//   '../extra/dps/cofs_dp.csv',
//   '123123',
//   '5us',
//   '27000@10.239.44.116'
// )
// data.then(str => {
//   console.log(str)
// })
// const b: DPRange = { key: 'Y', value: ['Y1', 'Y2'] }
// // const c: DPRange = { key: 'Z', value: [1.0, 2.0, 3.0] }
// // const d: DPRange = { key: '["W"]["ops"]', value: [1.1, 1.2, 1.3] }
// const e: DPRange = { key: 'V.arr.1.ip', value: [8, 9] }
// const res = new DPSetList([], [])

// const dp1: DPRange = { key: 'DP_EGR_ARB_PHASE', value: [0.04, 0.05, 0.06] }
// const dp2: DPRange = { key: 'DP_IGR_ARB_PHASE', value: [0.03, 0.07, 0.08] }

// res.desProduct(a).desProduct(b)

// const genedFiles = generateDPInputFiles(
//   workSpaceFilePath,
//   configTplFilePath,
//   res
// )
// console.log(genedFiles)
// const dp3: DPRange = { key: 'DP_STREAM_FILE', value: genedFiles }

//

// dpset
//   .desProduct(dp1)
//   .desProduct(dp2)
//   .desProduct(dp3)

// const genedDpCSVs = generateDPCSVFiles(
//   '../extra/dps/gen',
//   '../extra/dps/cofs_dp.csv',
//   dpset
// )

// genedDpCSVs.then(str => {
//   console.log(str)
// })

// const data = generateSimulation(
//   'maywzh',
//   '../extra/run',
//   '../extra/bin/sample_compute_die_8x8_top.exe',
//   '../extra/dps/cofs_dp.csv'
// )
// data.then(str => {
//   console.log(str)
// })
