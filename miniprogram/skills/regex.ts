/**
 * 正则板块（合并 index + tutorial 为单文件，避免小程序目录式 import 解析问题）
 */
import type { Skill, CheckResult, TestCase, TutorialSection } from '../shared/types'
import {
  buildResult,
  toExpectedArray,
  arraysEqualUnordered,
} from '../shared/utils'

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

export const regexTutorial: TutorialSection[] = [
  {
    id: 'regex-intro',
    title: '什么是正则表达式',
    content: `# 正则表达式简介

正则表达式（Regular Expression，简称 regex）是一种描述字符串模式的微型语言。

## 用途
- 校验输入（邮箱、手机号）
- 提取信息
- 替换文本

## 最简单的例子
\`\`\`
/abc/   匹配字符串 "abc"
/\\d/    匹配任意数字
/^abc/  匹配以 abc 开头
\`\`\`

左侧讲解区会逐步介绍语法，右侧练习框可立即动手试一试。`,
  },
  {
    id: 'regex-charclass',
    title: '字符类',
    content: `# 字符类

字符类用方括号包裹，匹配其中任意一个字符。

| 写法 | 含义 |
|---|---|
| \`[abc]\` | a 或 b 或 c |
| \`[a-z]\` | 任意小写字母 |
| \`[^abc]\` | 非 a、b、c |
| \`\\d\` | 数字 \`[0-9]\` |
| \`\\D\` | 非数字 |
| \`\\w\` | 单词字符 \`[A-Za-z0-9_]\` |
| \`\\W\` | 非单词字符 |
| \`\\s\` | 空白字符 |
| \`\\S\` | 非空白字符 |
| \`.\` | 任意字符（换行除外） |`,
    exercises: ['regex-low-001', 'regex-low-002'],
  },
  {
    id: 'regex-quantifier',
    title: '量词',
    content: `# 量词

量词控制前面的元素出现多少次。

| 写法 | 含义 |
|---|---|
| \`a*\` | 0 次或多次 |
| \`a+\` | 1 次或多次 |
| \`a?\` | 0 次或 1 次 |
| \`a{n}\` | 恰好 n 次 |
| \`a{n,}\` | 至少 n 次 |
| \`a{n,m}\` | n 到 m 次 |

默认贪婪（匹配尽可能多），加 \`?\` 变惰性（匹配尽可能少）：\`a*?\``,
  },
  {
    id: 'regex-anchor',
    title: '锚点',
    content: `# 锚点

锚点匹配位置而非字符。

| 写法 | 含义 |
|---|---|
| \`^\` | 字符串开头 |
| \`$\` | 字符串结尾 |
| \`\\b\` | 单词边界 |
| \`\\B\` | 非单词边界 |`,
  },
  {
    id: 'regex-group',
    title: '分组与引用',
    content: `# 分组与反向引用

\`(abc)\` 捕获分组，可用 \`\\1\` 反向引用。

- \`(\\w+)\\s\\1\` 匹配重复单词
- \`(?:abc)\` 非捕获分组
- \`(?<name>abc)\` 命名分组，用 \`\\k<name>\` 引用`,
  },
  {
    id: 'regex-lookaround',
    title: '环视（零宽断言）',
    content: `# 环视

环视匹配位置，不消耗字符。

| 写法 | 含义 |
|---|---|
| \`(?=abc)\` | 顺序肯定环视 |
| \`(?!abc)\` | 顺序否定环视 |
| \`(?<=abc)\` | 逆序肯定环视 |
| \`(?<!abc)\` | 逆序否定环视 |

例：\`\\d+(?=元)\` 匹配后面跟着"元"的数字。`,
  },
]

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
