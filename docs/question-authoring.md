# 题目编写规范

## 目录结构

每个板块的题目按阶段分文件存放：

```
data/
├── regex/
│   ├── low.json      # ~80 题
│   ├── mid.json
│   ├── high.json
│   └── top.json
├── jsonpath/
│   └── ...
└── ...
```

## JSON 格式

```json
[
  {
    "id": "regex-low-001",
    "skill": "regex",
    "level": "low",
    "type": "choice",
    "title": "下列哪个正则可以匹配任意数字？",
    "options": ["\\d", "\\D", "\\w", "\\s"],
    "answer": 0,
    "explanation": "\\d 匹配任意数字字符 [0-9]；\\D 匹配非数字；\\w 匹配单词字符；\\s 匹配空白字符。",
    "tags": ["字符类", "元字符"]
  },
  {
    "id": "regex-low-002",
    "skill": "regex",
    "level": "low",
    "type": "fill",
    "title": "写一个正则，匹配字符串中的所有数字。",
    "hint": "使用 \\d",
    "testCases": [
      { "input": "abc123", "expected": ["1","2","3"], "expectedType": "match" },
      { "input": "no digits", "expected": [], "expectedType": "match" }
    ],
    "referenceAnswer": "\\d",
    "explanation": "\\d 等价于 [0-9]，加 g 标志可全局匹配。本题要求匹配所有数字，所以用 /\\d/g。",
    "tags": ["字符类"]
  }
]
```

## 校验脚本

```bash
npm run validate-questions
```

校验内容：
- 必填字段：id / skill / level / type / title / explanation
- 选择题：有 options 和 answer
- 填空题：有 testCases，且 referenceAnswer 自身能通过所有 testCases
- id 全局唯一
- 正则题：referenceAnswer 能被 `new RegExp()` 构造

## 编写要点

1. 选择题：4 个选项，1 个正确答案，干扰项要有迷惑性
2. 填空题：答案不唯一，靠 testCases 校验通过即可；explanation 给参考答案 + 思路
3. 解析要详细：解释语法、说明为什么对/错、给出参考链接
4. 难度递进：low 基础语法 → mid 组合 → high 实战 → top 边界与陷阱
