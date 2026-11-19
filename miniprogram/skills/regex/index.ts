/**
 * 正则板块
 */
import type { Skill, CheckResult, TestCase } from '../../shared/types'
import {
  buildResult,
  toExpectedArray,
  arraysEqualUnordered,
  stringify,
} from '../../shared/utils'
import { regexTutorial } from './tutorial'

/**
 * 正则填空题校验器
 * - expectedType: 'match'  → 输入字符串中应能匹配出 expected（全局匹配）
 * - expectedType: 'nomatch' → 输入字符串中不应匹配出任何结果
 * - expectedType: 'equal'  → 整个 input 匹配后等于 expected
 */
export function regexChecker(
  userInput: string,
  testCases: TestCase[]
): CheckResult {
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
    // 复位 lastIndex
    re.lastIndex = 0
    while ((m = re.exec(tc.input)) !== null) {
      matches.push(m[0])
      if (m.index === re.lastIndex) re.lastIndex++ // 防止零宽匹配死循环
    }

    let pass = false
    const got = matches.join(', ')
    const expectedStr = expectedArr.join(', ')

    switch (tc.expectedType) {
      case 'nomatch':
        pass = matches.length === 0
        break
      case 'equal':
        pass = matches.length === 1 && matches[0] === expectedArr[0]
        break
      case 'match':
      default:
        pass = arraysEqualUnordered(matches, expectedArr)
        break
    }

    return { pass, got, expected: expectedStr }
  })

  return buildResult(details)
}

export const regexSkill: Skill = {
  id: 'regex',
  name: '正则表达式',
  icon: '/assets/icons/regex.svg',
  desc: '掌握正则语法，从字符类到零宽断言',
  levels: [
    { id: 'low', name: '初级', desc: '字符类、量词、锚点等基础语法', count: 80 },
    { id: 'mid', name: '中级', desc: '分组、反向引用、替换', count: 80 },
    { id: 'high', name: '高级', desc: '环视、贪婪与惰性、复杂结构', count: 80 },
    { id: 'top', name: '顶级', desc: '陷阱、性能、回溯', count: 80 },
  ],
  checker: regexChecker,
  tutorial: regexTutorial,
  enabled: true,
}
