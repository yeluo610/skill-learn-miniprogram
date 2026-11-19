/**
 * JSONPath 板块（合并 index + tutorial 为单文件）
 */
import type { Skill, CheckResult, TestCase, TutorialSection } from '../shared/types'
import { buildResult, toExpectedArray, arraysEqualUnordered, stringify } from '../shared/utils'

/**
 * JSONPath 填空题校验器
 * 需要 jsonpath-plus 库；小程序端按需引入。
 */
function loadJsonPath(): any {
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
    } catch {
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

export const jsonpathTutorial: TutorialSection[] = [
  {
    id: 'jsonpath-intro',
    title: '什么是 JSONPath',
    content: `# JSONPath 简介

JSONPath 是一种从 JSON 文档中提取数据的查询语言，类似 XPath 之于 XML。

## 基础语法
- \`$\` 表示根对象
- \`.\` 子节点，如 \`$.store.book\`
- \`[n]\` 数组下标，如 \`$.book[0]\`
- \`[*]\` 数组所有元素
- \`..\` 递归下降

## 例子
数据：
\`\`\`json
{ "store": { "book": [ {"price": 10}, {"price": 20} ] } }
\`\`\`
- \`$.store.book[0].price\` → 10
- \`$.store.book[*].price\` → [10, 20]
- \`$..price\` → [10, 20]`,
  },
  {
    id: 'jsonpath-basic',
    title: '基础访问',
    content: `# 基础访问

| 表达式 | 含义 |
|---|---|
| \`$\` | 根 |
| \`$.a\` | 根下的 a 字段 |
| \`$['a']\` | 同上（单引号） |
| \`$[0]\` | 数组第 0 个 |
| \`$[-1]\` | 数组最后一个 |`,
  },
  {
    id: 'jsonpath-wildcard',
    title: '通配符与切片',
    content: `# 通配符与切片

- \`$\`.\*\` 所有字段值
- \`$[*]\` 数组所有元素
- \`$[1:3]\` 切片，下标 1、2
- \`$[start:end:step]\` 完整切片`,
  },
  {
    id: 'jsonpath-filter',
    title: '过滤表达式',
    content: `# 过滤表达式

\`?[?(expr)]\` 过滤数组元素。

\`\`\`
$.book[?(@.price < 10)]     # price 小于 10 的书
$.book[?(@.category == 'fiction')]
\`\`\`

\`@\` 代表当前元素。`,
  },
  {
    id: 'jsonpath-recursive',
    title: '递归下降',
    content: `# 递归下降

\`..\` 从当前位置递归查找所有层级。

\`\`\`
$..book        # 任意层级叫 book 的字段
$..price       # 所有 price 字段
\`\`\``,
  },
]

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
