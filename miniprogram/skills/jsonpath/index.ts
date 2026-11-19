/**
 * JSONPath 板块
 */
import type { Skill, CheckResult, TestCase } from '../../shared/types'
import { buildResult, toExpectedArray, arraysEqualUnordered, stringify } from '../../shared/utils'
import { jsonpathTutorial } from './tutorial'

/**
 * JSONPath 填空题校验器
 * 需要 jsonpath-plus 库；小程序端按需引入。
 * 这里用动态 require，云函数侧 Node 环境可用。
 */
function loadJsonPath(): typeof import('jsonpath-plus').JSONPath | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('jsonpath-plus')
    return mod.JSONPath || mod.default || mod
  } catch {
    return null
  }
}

export function jsonpathChecker(
  userInput: string,
  testCases: TestCase[]
): CheckResult {
  const JSONPath = loadJsonPath()
  if (!JSONPath) {
    return buildResult([], 'jsonpath-plus 未安装，无法校验')
  }

  const details = testCases.map((tc) => {
    let json: unknown
    try {
      json = JSON.parse(tc.input)
    } catch (e) {
      return {
        pass: false,
        got: 'JSON 解析失败',
        expected: tc.expected as string,
      }
    }

    let result: unknown
    try {
      result = JSONPath({ path: userInput, json })
    } catch (e) {
      return {
        pass: false,
        got: `执行错误：${(e as Error).message}`,
        expected: tc.expected as string,
      }
    }

    const gotArr = (Array.isArray(result) ? result : [result]).map((v) =>
      typeof v === 'string' ? v : stringify(v)
    )
    const expectedArr = toExpectedArray(tc.expected)
    const pass = arraysEqualUnordered(gotArr, expectedArr)
    return { pass, got: gotArr.join(', '), expected: expectedArr.join(', ') }
  })

  return buildResult(details)
}

export const jsonpathSkill: Skill = {
  id: 'jsonpath',
  name: 'JSONPath',
  icon: '/assets/icons/jsonpath.svg',
  desc: '查询 JSON 数据的路径表达式',
  levels: [
    { id: 'low', name: '初级', desc: '根、点号、下标', count: 80 },
    { id: 'mid', name: '中级', desc: '通配符、切片、过滤', count: 80 },
    { id: 'high', name: '高级', desc: '递归、脚本表达式', count: 80 },
    { id: 'top', name: '顶级', desc: '复杂查询与陷阱', count: 80 },
  ],
  checker: jsonpathChecker,
  tutorial: jsonpathTutorial,
  enabled: true,
}
