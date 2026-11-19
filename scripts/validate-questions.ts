/**
 * 题库校验脚本
 * 校验 data/ 下的题库 JSON 格式与答案正确性
 * 用法：npm run validate-questions
 */
import * as fs from 'fs'
import * as path from 'path'

type SkillId = 'regex' | 'jsonpath' | 'linux' | 'kubectl'
type LevelId = 'low' | 'mid' | 'high' | 'top'
type QType = 'choice' | 'fill'

interface TestCase {
  input: string
  expected: string | string[]
  expectedType?: 'match' | 'nomatch' | 'equal'
}

interface Question {
  id: string
  skill: SkillId
  level: LevelId
  type: QType
  title: string
  content?: string
  options?: string[]
  answer?: number
  testCases?: TestCase[]
  hint?: string
  explanation: string
  referenceAnswer?: string
  tags?: string[]
}

const dataDir = path.join(__dirname, '..', 'data')
const skills: SkillId[] = ['regex', 'jsonpath', 'linux', 'kubectl']
const levels: LevelId[] = ['low', 'mid', 'high', 'top']

let errors = 0
let total = 0
const seenIds = new Set<string>()

function err(qid: string, msg: string) {
  console.error(`❌ [${qid}] ${msg}`)
  errors++
}

function checkRegexAnswer(userInput: string, tcs: TestCase[]): { pass: boolean } {
  let re: RegExp
  try {
    re = new RegExp(userInput, 'g')
  } catch (e) {
    return { pass: false }
  }
  const toArr = (v: string | string[]) => (Array.isArray(v) ? v : [v])
  const unorderedEq = (a: string[], b: string[]) => {
    if (a.length !== b.length) return false
    const sa = [...a].sort()
    const sb = [...b].sort()
    return sa.every((v, i) => v === sb[i])
  }
  for (const tc of tcs) {
    const matches: string[] = []
    let m: RegExpExecArray | null
    re.lastIndex = 0
    while ((m = re.exec(tc.input)) !== null) {
      matches.push(m[0])
      if (m.index === re.lastIndex) re.lastIndex++
    }
    const exp = toArr(tc.expected)
    let pass = false
    switch (tc.expectedType) {
      case 'nomatch': pass = matches.length === 0; break
      case 'equal': pass = matches.length === 1 && matches[0] === exp[0]; break
      default: pass = unorderedEq(matches, exp); break
    }
    if (!pass) return { pass: false }
  }
  return { pass: true }
}

function validateFile(file: string, skill: SkillId, level: LevelId) {
  if (!fs.existsSync(file)) return
  const raw = fs.readFileSync(file, 'utf-8')
  let arr: Question[]
  try {
    arr = JSON.parse(raw)
  } catch (e) {
    console.error(`❌ ${file} JSON 解析失败: ${(e as Error).message}`)
    errors++
    return
  }
  if (!Array.isArray(arr)) {
    console.error(`❌ ${file} 顶层必须是数组`)
    errors++
    return
  }
  for (const q of arr) {
    total++
    if (!q.id) { err('(无id)', `${file} 题目缺 id`); continue }
    if (seenIds.has(q.id)) { err(q.id, 'id 重复'); continue }
    seenIds.add(q.id)
    if (q.skill !== skill) err(q.id, `skill 应为 ${skill} 实际 ${q.skill}`)
    if (q.level !== level) err(q.id, `level 应为 ${level} 实际 ${q.level}`)
    if (!q.title) err(q.id, '缺 title')
    if (!q.explanation) err(q.id, '缺 explanation')
    if (q.type !== 'choice' && q.type !== 'fill') { err(q.id, `未知 type: ${q.type}`); continue }
    if (q.type === 'choice') {
      if (!Array.isArray(q.options) || q.options.length < 2) err(q.id, '选择题 options 不足')
      if (typeof q.answer !== 'number') err(q.id, '选择题缺 answer')
    } else {
      if (!Array.isArray(q.testCases) || q.testCases.length === 0) err(q.id, '填空题缺 testCases')
      if (q.referenceAnswer) {
        if (skill === 'regex') {
          const r = checkRegexAnswer(q.referenceAnswer, q.testCases || [])
          if (!r.pass) err(q.id, 'referenceAnswer 不能通过自身 testCases')
        }
      }
    }
  }
}

for (const sk of skills) {
  for (const lv of levels) {
    const f = path.join(dataDir, sk, `${lv}.json`)
    validateFile(f, sk, lv)
  }
}

console.log(`\n校验完成：共 ${total} 题，${errors} 个错误`)
process.exit(errors === 0 ? 0 : 1)
