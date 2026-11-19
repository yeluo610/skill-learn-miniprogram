/**
 * 题库导入云数据库脚本
 * 用法：npm run seed-db
 * 需要环境变量 WXBENCH_CLOUD_ENV（或在下方常量填入）
 * 由于小程序云数据库无独立 Node SDK 直连，本脚本提供两种方式：
 *   1. 生成 import.json 供"微信开发者工具 → 数据库 → 导入"使用（默认）
 *   2. 调用 importQuestions 云函数批量导入（需配置）
 */
import * as fs from 'fs'
import * as path from 'path'

const dataDir = path.join(__dirname, '..', 'data')
const outDir = path.join(__dirname, '..', 'dist')
const skills = ['regex', 'jsonpath', 'linux', 'kubectl']
const levels = ['low', 'mid', 'high', 'top']

fs.mkdirSync(outDir, { recursive: true })

let total = 0
const perFile: Record<string, number> = {}

for (const sk of skills) {
  for (const lv of levels) {
    const f = path.join(dataDir, sk, `${lv}.json`)
    if (!fs.existsSync(f)) continue
    const arr = JSON.parse(fs.readFileSync(f, 'utf-8'))
    perFile[`${sk}/${lv}`] = arr.length
    total += arr.length
    // 为每条补 createdAt 并追加到总文件
    const allPath = path.join(outDir, `import-${sk}-${lv}.json`)
    const lines = arr.map((q: any) => JSON.stringify({ ...q, createdAt: Date.now() }))
    fs.writeFileSync(allPath, lines.join('\n'), 'utf-8')
  }
}

console.log('生成导入文件完成：')
for (const [k, v] of Object.entries(perFile)) {
  console.log(`  ${k}: ${v} 题 → dist/import-${k.replace('/', '-')}.json`)
}
console.log(`总计：${total} 题`)
console.log('\n下一步：')
console.log('  方式1: 打开微信开发者工具 → 云开发 → 数据库 → questions 集合 → 导入，选择 dist/import-*.json（JSON Lines 格式）')
console.log('  方式2: 调用 importQuestions 云函数批量导入')
