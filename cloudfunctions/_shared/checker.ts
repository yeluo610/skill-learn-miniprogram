/**
 * 校验器（云函数端使用，与 miniprogram/skills 保持逻辑一致）
 * 正则用原生 RegExp；JSONPath 用 jsonpath-plus
 */
import type { CheckResult, TestCase, ExpectType } from './types'

export function toExpectedArray(expected: string | string[]): string[] {
  return Array.isArray(expected) ? expected : [expected]
}

export function arraysEqualUnordered(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((v, i) => v === sb[i])
}

export function stringify(v: unknown): string {
  if (v === null) return 'null'
  if (v === undefined) return 'undefined'
  if (typeof v === 'string') return v
  return JSON.stringify(v)
}

export function buildResult(
  details: { pass: boolean; got: string; expected: string }[],
  error?: string
): CheckResult {
  return {
    pass: details.length > 0 && details.every((d) => d.pass),
    details,
    error,
  }
}

/** 正则校验器 */
export function regexChecker(userInput: string, testCases: TestCase[]): CheckResult {
  let re: RegExp
  try {
    re = new RegExp(userInput, 'g')
  } catch (e) {
    return buildResult([], `正则语法错误：${(e as Error).message}`)
  }
  const details = testCases.map((tc) => {
    const expectedArr = toExpectedArray(tc.expected)
    const matches: string[] = []
    let m: RegExpExecArray | null
    re.lastIndex = 0
    while ((m = re.exec(tc.input)) !== null) {
      matches.push(m[0])
      if (m.index === re.lastIndex) re.lastIndex++
    }
    const got = matches.join(', ')
    const expectedStr = expectedArr.join(', ')
    let pass = false
    switch (tc.expectedType) {
      case 'nomatch': pass = matches.length === 0; break
      case 'equal': pass = matches.length === 1 && matches[0] === expectedArr[0]; break
      default: pass = arraysEqualUnordered(matches, expectedArr); break
    }
    return { pass, got, expected: expectedStr }
  })
  return buildResult(details)
}

/** JSONPath 校验器 */
export function jsonpathChecker(userInput: string, testCases: TestCase[]): CheckResult {
  let JSONPath: any
  try {
    JSONPath = require('jsonpath-plus').JSONPath
  } catch {
    return buildResult([], 'jsonpath-plus 未安装')
  }
  const details = testCases.map((tc) => {
    let json: unknown
    try {
      json = JSON.parse(tc.input)
    } catch {
      return { pass: false, got: 'JSON 解析失败', expected: tc.expected as string }
    }
    let result: unknown
    try {
      result = JSONPath({ path: userInput, json })
    } catch (e) {
      return { pass: false, got: `执行错误：${(e as Error).message}`, expected: tc.expected as string }
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

/** 根据 skill 选择 checker */
export function getChecker(skill: string) {
  switch (skill) {
    case 'regex': return regexChecker
    case 'jsonpath': return jsonpathChecker
    default: return null
  }
}
