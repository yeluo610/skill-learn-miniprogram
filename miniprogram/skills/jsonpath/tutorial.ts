/**
 * JSONPath 教程
 */
import type { TutorialSection } from '../../shared/types'

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
