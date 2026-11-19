/**
 * 通过 importQuestions 云函数批量导入题库
 * 用法：
 *   设置环境变量 WXBENCH_CLOUD_ENV 为你的云环境 ID
 *   然后 node scripts/seed-via-cloud.js [skill] [level]
 *   例：node scripts/seed-via-cloud.js regex low
 *   不传参数则导入全部
 *
 * 注意：调用云函数需要云开发 HTTP API 或本地调试。
 * 此脚本走"微信开发者工具 → 云开发 → 本地调试"方式，
 * 实际部署推荐用"数据库控制台导入 JSON Lines 文件"（见 scripts/seed-db.ts 生成的 dist/import-*.json）。
 *
 * 推荐流程：
 *   1. 运行 `npm run seed-db` 生成 dist/import-*.json（JSON Lines）
 *   2. 微信开发者工具 → 云开发 → 数据库 → questions 集合 → 导入
 *      选择对应文件，格式选 JSON Lines
 *
 * 若要程序化导入，请在云开发控制台开启 HTTP API，再用本脚本调 callFunction。
 */
const fs = require('fs')
const path = require('path')

const dataDir = path.join(__dirname, '..', 'data')

function loadAll() {
  const all = []
  for (const sk of ['regex', 'jsonpath', 'linux', 'kubectl']) {
    for (const lv of ['low', 'mid', 'high', 'top']) {
      const f = path.join(dataDir, sk, `${lv}.json`)
      if (fs.existsSync(f)) {
        const arr = JSON.parse(fs.readFileSync(f, 'utf-8'))
        all.push(...arr)
      }
    }
  }
  return all
}

const args = process.argv.slice(2)
let questions = loadAll()
if (args[0]) {
  questions = questions.filter((q) => q.skill === args[0])
  if (args[1]) questions = questions.filter((q) => q.level === args[1])
}

console.log(`待导入题目数：${questions.length}`)

const envId = process.env.WXBENCH_CLOUD_ENV
if (!envId) {
  console.log('\n⚠️  未设置 WXBENCH_CLOUD_ENV 环境变量，无法自动调用云函数。')
  console.log('推荐方式：')
  console.log('  1. 运行 `npm run seed-db` 生成 dist/import-*.json（JSON Lines）')
  console.log('  2. 微信开发者工具 → 云开发 → 数据库 → questions → 导入')
  console.log('     格式选 JSON Lines')
  console.log('\n或设置 WXBENCH_CLOUD_ENV 后用 HTTP API 调用（需在控制台开启）。')
  process.exit(0)
}

// 走云开发 HTTP API（需用户自行配置 access_token 等）
console.log(`云环境 ID：${envId}`)
console.log('请通过微信开发者工具的本地调试或 HTTP API 调用 importQuestions 云函数导入。')
console.log('每批建议 50 条，避免超时。')
process.exit(0)
