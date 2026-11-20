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
    // 支持 /pattern/flags 形式（如 /\d/g）
    let pattern = userInput
    let flags = 'g'
    const m = /^\/(.+)\/([gimsuy]*)$/.exec(userInput.trim())
    if (m) {
      pattern = m[1]
      flags = m[2].includes('g') ? m[2] : 'g' + m[2]
    }
    re = new RegExp(pattern, flags)
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

正则表达式（Regular Expression，简称 regex）是一种**描述字符串模式的微型语言**。它用几个符号就能表达"匹配所有手机号""提取所有邮箱"这类规则，比手写循环判断简洁得多。

## 它能做什么

- **校验**：判断输入是否合法（手机号、邮箱、身份证）
- **提取**：从文本里抓出符合规则的部分（日志里的 IP、URL）
- **替换**：批量改写文本（脱敏、格式化）
- **拆分**：按复杂分隔符切分字符串

## 最简单的例子

\`\`\`
/abc/     匹配字符串 "abc"（字面量）
/\\d/      匹配任意一个数字
/^abc/    匹配以 abc 开头的字符串
/a+/      匹配 1 个或多个连续 a
\`\`\`

## 两个斜杠是什么意思

\`/模式/标志\` 是正则的字面量写法。两个 \`/\` 之间是模式，结尾的字母是标志：
- \`g\` 全局匹配（找全部，不只找第一个）
- \`i\` 忽略大小写
- \`m\` 多行模式

例如 \`/foo/gi\` 在整段文本里忽略大小写地找所有 foo。

本板块从字符类、量词、锚点一路讲到环视、回溯，每个知识点都配了练习题，边学边练。`,
  },
  {
    id: 'regex-charclass',
    title: '字符类',
    content: `# 字符类

字符类用方括号 \`[]\` 包裹，表示**匹配其中任意一个字符**。它是"或"的关系：\`[abc]\` 匹配 a、b 或 c 中的任意一个，不是匹配 "abc" 这个字符串。

## 写法对照

| 写法 | 含义 | 例子 |
|---|---|---|
| \`[abc]\` | a 或 b 或 c | \`[abc]x\` 匹配 ax、bx、cx |
| \`[a-z]\` | 任意小写字母 | 匹配 a 到 z |
| \`[A-Za-z0-9]\` | 字母和数字 | 范围可组合 |
| \`[^abc]\` | 非 a、b、c | \`^\` 在开头表示取反 |
| \`\\d\` | 数字，等价 \`[0-9]\` | \`\\d+\` 匹配一串数字 |
| \`\\D\` | 非数字 | 等价 \`[^0-9]\` |
| \`\\w\` | 单词字符 \`[A-Za-z0-9_]\` | 字母、数字、下划线 |
| \`\\W\` | 非单词字符 | |
| \`\\s\` | 空白字符 | 空格、制表、换行 |
| \`\\S\` | 非空白字符 | |
| \`.\` | 任意字符（换行除外） | 最通用的通配 |

## 为什么要有 \\d \\w \\s

它们是常用字符类的**简写**，比写 \`[0-9]\` 更短。背下来这组（小写 = 是，大写 = 非）能大幅提速：
- 小写 \`\\d \\w \\s\` = "是数字 / 是单词字符 / 是空白"
- 大写 \`\\D \\W \\S\` = "不是..."

## 容易踩的坑

- \`.\` 在默认模式下**不匹配换行符**，要匹配任意字符（含换行）用 \`[\\s\\S]\` 或加 \`s\` 标志
- \`[^abc]\` 匹配的是"不是 a/b/c 的任意字符"，会匹配换行、空格
- 方括号里大多数特殊字符不需要转义，\`[.+*]\` 就是匹配 . + *

练习：试着用 \`\\d+\` 从 "abc123def456" 里抓出 123 和 456。`,
    exercises: ['regex-low-001', 'regex-low-002'],
  },
  {
    id: 'regex-quantifier',
    title: '量词',
    content: `# 量词

量词控制**前面的元素出现多少次**。它贴在前一个字符或分组后面。

## 量词一览

| 写法 | 含义 | 记忆 |
|---|---|---|
| \`a*\` | 0 次或多次 | 可以没有 |
| \`a+\` | 1 次或多次 | 至少一个 |
| \`a?\` | 0 次或 1 次 | 可有可无 |
| \`a{n}\` | 恰好 n 次 | 精确 |
| \`a{n,}\` | 至少 n 次 | 下限 |
| \`a{n,m}\` | n 到 m 次 | 区间 |

## 等价关系

- \`+\` 等价 \`{1,}\`（至少 1 个）
- \`*\` 等价 \`{0,}\`（可以 0 个）
- \`?\` 等价 \`{0,1}\`（可选）

## 贪婪 vs 惰性

默认是**贪婪**的，会尽可能多匹配。在量词后加 \`?\` 变**惰性**（最少匹配）：

\`\`\`
"aabbb".match(/a+/)     → "aa"     贪婪，能吃多少吃多少
"aabbb".match(/a+?/)    → "a"      惰性，能少吃就少吃
\`\`\`

\`<.+>\` 匹配 \`<a><b>\` 会一次吞掉整串（贪婪），而 \`<.+?>\` 会分别匹配 \`<a>\` 和 \`<b>\`（惰性）。**解析 HTML/标签时一定要用惰性量词**，否则容易出错。

## 常见模式

- \`\\d{3}-\\d{4}\` → 匹配 123-4567
- \`\\d{11}\` → 11 位手机号
- \`colou?r\` → 匹配 color 和 colour（u 可有可无）`,
  },
  {
    id: 'regex-anchor',
    title: '锚点',
    content: `# 锚点

锚点匹配的是**位置**，不消耗字符。它像书签一样标定"这里必须是什么位置"，本身不占字符长度。

## 常用锚点

| 写法 | 含义 |
|---|---|
| \`^\` | 字符串开头 |
| \`$\` | 字符串结尾 |
| \`\\b\` | 单词边界 |
| \`\\B\` | 非单词边界 |

## 锚点的作用

锚点常用来**限定匹配位置**，做整体验证：

\`\`\`
/^\\d+$/        整个字符串必须全是数字（常用于校验）
/^https?:/     必须以 http: 或 https: 开头
/\\.com$/      必须以 .com 结尾
/cat\\b/       匹配 cat 但不匹配 category（cat 后必须是边界）
\`\`\`

## 什么是单词边界

\`\\b\` 是单词字符 (\`\\w\`) 和非单词字符之间的位置：
- 字符串开头/结尾
- 字母数字 与 空格/标点 之间

例如 \`\\bcat\\b\` 在 "the cat sat" 里匹配 cat，但在 "category" 里不匹配——因为 cat 后面紧跟字母，不是边界。

## 为什么校验要用 ^ 和 $

不加锚点时 \`\\d+\` 在 "abc123" 里也能匹配出 123（部分匹配）。如果你要校验"整个输入必须是数字"，必须写成 \`/^\\d+$/\`，否则 "abc123" 会被判合法。`,
  },
  {
    id: 'regex-group',
    title: '分组与引用',
    content: `# 分组与反向引用

## 捕获分组

用 \`()\` 把一部分模式括起来，就形成一个**捕获分组**。它的作用：
1. 给一段模式加量词（如 \`(ab)+\` 匹配 ab、abab、ababab）
2. 提取匹配的子串（如从日期里分别拿年月日）
3. 在替换时引用

\`\`\`
/(\\d{4})-(\\d{2})-(\\d{2})/   日期，3 个分组
$1=年  $2=月  $3=日（替换时用 $1 $2 $3）
\`\`\`

## 反向引用

\`\\1\` 引用**第一个捕获分组**实际匹配到的内容。常用来匹配"重复内容"：

\`\`\`
/(\\w+)\\s\\1/   匹配重复单词，如 "hello hello"
\`\`\`
这里 \`\\1\` 不是"再匹配一个单词"，而是"匹配和第一个分组**相同**的字符串"。

## 非捕获分组

\`(?:...)\` 是**非捕获分组**，只起分组作用，不保存匹配结果，性能更好：
\`(?:ab)+\` 匹配 ababab，但不能用 \`\\1\` 引用。

## 命名分组

\`(?<name>...)\` 给分组起名字，用 \`\\k<name>\` 引用，比数字 \`\\1\` 更清晰：
\`\`\`
/(?<word>\\w+)\\s\\k<word>/   匹配重复单词
\`\`\`

## 易错点

- \`()\` 默认捕获，不需要捕获时用 \`(?:)\`，性能更高
- 反向引用编号按 \`(\` 出现的顺序从 1 开始
- 嵌套分组同样按开括号顺序编号`,
  },
  {
    id: 'regex-lookaround',
    title: '环视（零宽断言）',
    content: `# 环视（零宽断言）

环视是一种**只看位置不消耗字符**的断言。它要求"这个位置的前后满足某条件"，但匹配结果里不包含被环视的内容。

## 四种环视

| 写法 | 名称 | 含义 |
|---|---|---|
| \`(?=abc)\` | 顺序肯定 | 后面是 abc |
| \`(?!abc)\` | 顺序否定 | 后面不是 abc |
| \`(?<=abc)\` | 逆序肯定 | 前面是 abc |
| \`(?<!abc)\` | 逆序否定 | 前面不是 abc |

## 为什么需要环视

经典例子：**匹配后面跟着"元"的数字**，但不要把"元"也匹配进去。

\`\`\`
/\\d+(?=元)/   在 "100元 200块 300元" 里匹配 100、300，不含"元"
\`\`\`

如果不用环视写成 \`\\d+元\`，匹配结果会包含"元"字，后续还得再剥离——环视帮你省了这一步。

## 常见用法

- \`(?<=\\$)\\d+\` 匹配 $ 后面的数字
- \`\\d+(?![\\d.])\` 匹配后面不再是数字或点的数字（避免 123.45 里的 45 被单独抓走）
- \`(?<![\\d.])\\d+\` 前面不能是数字或点

## 注意

- 环视**不消耗字符**，所以同一位置可叠加多个断言
- JavaScript 旧版不支持逆序环视 (\`(?<=)\`)，ES2018 之后才支持，需确认运行环境
- 逆序环视里通常不能用变长模式（视实现而定）`,
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
