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

JSONPath 是一种**从 JSON 文档里查询数据的表达式语言**，地位类似 XPath 之于 XML、SQL 之于数据库。JSON 已是接口和配置的主流格式，写一段表达式就能精准取出想要的字段，比层层 \`.foo.bar\` 解析优雅得多。

## 基本符号

- \`$\` 表示**根对象**，所有表达式都从这里开始
- \`.\` 访问子字段，如 \`$.store.book\`
- \`[n]\` 数组下标，从 0 开始；\`[-1]\` 是最后一个
- \`[*]\` 数组所有元素
- \`..\` 递归下降（任意层级里找）

## 一个完整例子

数据：
\`\`\`json
{ "store": { "book": [ {"price": 10}, {"price": 20} ] } }
\`\`\`

- \`$.store.book[0].price\` → 10
- \`$.store.book[*].price\` → [10, 20]
- \`$..price\` → [10, 20]（递归找所有 price）

## 和点号访问的关系

\`$.a.b\` 等价于在代码里 \`data.a.b\`，但用字符串描述，可以**动态拼装、存储、传递**。这是它最大的价值——查询逻辑可以数据化。

## 本板块怎么学

从根、点号、下标这些基础访问入手，再学通配符、切片、过滤表达式，最后到递归下降与脚本表达式。每节都有练习题，动手写表达式看结果，最快掌握。`,
  },
  {
    id: 'jsonpath-basic',
    title: '基础访问',
    content: `# 基础访问

基础访问是 JSONPath 的根基，掌握 \`$\`、\`.\`、\`[]\` 三个符号就能查 80% 的数据。

## 符号对照

| 表达式 | 含义 | 例（取下面数据） |
|---|---|---|
| \`$\` | 根对象 | 整个 JSON |
| \`$.a\` | 根下的 a 字段 | 1 |
| \`$['a']\` | 同上（单引号写法） | 1 |
| \`$[0]\` | 数组第 0 个 | 数组首元素 |
| \`$[-1]\` | 数组最后一个 | 数组末元素 |
| \`$.store.book\` | 链式访问嵌套字段 | book 数组 |

示例数据：
\`\`\`json
{ "a": 1, "list": [10, 20, 30], "store": { "book": [{"title":"A"}] } }
\`\`\`

## 两种写法的区别

\`$.a\` 和 \`$['a']\` 等价，但有差别：
- \`$.a\` 简洁，但字段名必须是合法标识符（不能含空格、点、特殊符号）
- \`$['a']\` 用括号字符串，字段名任意，如 \`$['my key']\`、\`$['a.b']\`

## 负数下标

\`$[-1]\` 取最后一个，\`$[-2]\` 取倒数第二个，比先算 length 再算索引方便很多。

## 易错点

- 下标从 **0** 开始，不是 1
- \`$.store.book\` 中间不能漏点，每个层级都要用 \`.\` 连接
- 字段名带特殊字符时必须用括号字符串写法`,
  },
  {
    id: 'jsonpath-wildcard',
    title: '通配符与切片',
    content: `# 通配符与切片

通配符和切片让你**批量取值**，不必逐个写索引。

## 通配符

| 表达式 | 含义 |
|---|---|
| \`$.*\` | 根对象所有字段的值 |
| \`$.store.*\` | store 下所有字段的值 |
| \`$.list[*]\` | 数组所有元素 |

\`*\` 用在对象上取**所有值**（不含字段名），用在数组上要写成 \`[*]\`。

## 切片

切片借鉴 Python，语法 \`[start:end:step]\`，**含头不含尾**：

| 表达式 | 取哪些下标 |
|---|---|
| \`$[1:3]\` | 1、2 |
| \`$[:2]\` | 0、1（省略 start 默认 0） |
| \`$[2:]\` | 2 到末尾 |
| \`$[-2:]\` | 最后 2 个 |
| \`$[::2]\` | 0、2、4...（步长 2） |
| \`$[::-1]\` | 倒序全部 |

## 含头不含尾的含义

\`[1:3]\` 取下标 1、2，**不取 3**。这是切片的传统约定，记住"含头不含尾"就不会错。

## 实用技巧

- 取前 N 个：\`$[:N]\`
- 取后 N 个：\`$[-N:]\`
- 反转数组：\`$[::-1]\`
- 隔一个取一个：\`$[::2]\``,
  },
  {
    id: 'jsonpath-filter',
    title: '过滤表达式',
    content: `# 过滤表达式

过滤表达式用 \`?[?(条件)]\` **按条件筛选数组元素**，相当于 SQL 的 WHERE。

## 基本结构

\`\`\`
$.book[?( 条件 )]
\`\`\`

\`@\` 代表**当前正在判断的元素**（类似循环变量）。

## 比较运算

| 表达式 | 含义 |
|---|---|
| \`$.book[?(@.price < 10)]\` | price 小于 10 |
| \`$.book[?(@.category == 'fiction')]\` | 分类为 fiction |
| \`$.book[?(@.price > 10 && @.price < 50)]\` | 区间 |
| \`$.book[?(@.title)]\` | 有 title 字段 |
| \`$.book[?(!@.price)]\` | 没有 price 字段 |

## 支持的运算符

- 比较：\`==\` \`!=\` \`<\` \`>\` \`<=\` \`>=\`
- 逻辑：\`&&\`（与）\`||\`（或）\`!\`（非）
- 正则匹配：\`=~ /pattern/\`（部分实现支持）

## @ 和 $ 的区别

- \`$\` 永远是**根**
- \`@\` 是**当前过滤的元素**

\`$.store.book[?(@.price < $.max)]\`：当前书的 price 和根的 max 比较，分别用 \`@\` 和 \`$\`。

## 易错点

- 条件外层 \`?\` 不能少：\`[?(...)]\` 而不是 \`[(...)]\`
- 字符串比较要加引号：\`== 'fiction'\` 不是 \`== fiction\`
- 不同实现（jsonpath-plus / Goessner）支持的语法略有差异`,
  },
  {
    id: 'jsonpath-recursive',
    title: '递归下降',
    content: `# 递归下降

\`..\` 是 JSONPath 最强大的运算符之一：**在任意层级查找**，不管嵌套多深。

## 用法

\`\`\`
$..book        # 任意层级叫 book 的字段
$..price       # 所有层级的 price
$..[0]         # 每个数组的第 0 个
\`\`\`

## 示例

数据：
\`\`\`json
{
  "a": { "price": 1, "sub": { "price": 2 } },
  "b": { "price": 3 }
}
\`\`\`

- \`$..price\` → [1, 2, 3]（把所有层级的 price 都抓出来）
- \`$.a..price\` → [1, 2]（只从 a 往下递归）

## 何时用递归

- **结构不确定**：不知道 price 在第几层，用 \`$..price\` 一把全抓
- **批量提取**：日志里所有 \`timestamp\` 字段，不管在哪层
- **找特定名字的字段**：配置文件里所有 \`url\`

## 和通配符的区别

- \`$.*\` 只取**直接子节点**，一层
- \`$..\` 取**所有层级**，递归到底

递归更深更全，但也更慢、结果顺序可能不直观。能用具体路径就用具体路径，结构未知才用递归。

## 易错点

- 递归结果顺序与实现有关，不要假设固定顺序
- 递归会把所有匹配的字段都返回，量大时注意性能`,
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
