# 题目数据结构

## Question（题目）

```ts
interface Question {
  _id: string
  skill: 'regex' | 'jsonpath' | 'linux' | 'kubectl'
  level: 'low' | 'mid' | 'high' | 'top'
  type: 'choice' | 'fill'
  title: string                  // 题干
  content?: string               // 补充说明（可选）

  // 选择题
  options?: string[]             // 选项数组
  answer?: number                // 正确选项索引

  // 填空题
  testCases?: TestCase[]         // 测试用例
  hint?: string                  // 提示

  // 公共
  explanation: string            // 详细答案解析（必填）
  referenceAnswer?: string       // 参考答案（填空题展示用）
  tags?: string[]                // 知识点标签
  createdAt: number
}

interface TestCase {
  input: string                  // 测试输入
  expected: string | string[]    // 期望输出
  expectedType?: 'match' | 'nomatch' | 'equal'  // 匹配/不匹配/相等
}
```

## 数据集合

### user_progress
```ts
interface UserProgress {
  _id: string
  _openid: string         // 云开发自动注入
  skill: string
  level: string
  questionId: string
  status: 'correct' | 'wrong' | 'unattempted'
  lastAnswer?: string | number
  attempts: number
  updatedAt: number
}
```

### wrong_questions
```ts
interface WrongQuestion {
  _id: string
  _openid: string
  skill: string
  questionId: string
  source: 'level' | 'exam'
  status: 'unreviewed' | 'mastered' | 'stillwrong'
  addedAt: number
  updatedAt: number
}
```

### exam_records
```ts
interface ExamRecord {
  _id: string
  _openid: string
  skill: string
  examSetId: number            // 第几套 1-20
  questionIds: string[]
  answers: Record<string, string | number>
  score: number
  startedAt: number
  finishedAt: number
}
```

## 校验规则

- 选择题：`userAnswer === question.answer`
- 填空题：对每个 testCase 执行 checker：
  - regex：`new RegExp(userInput)` 匹配 `input`，结果（匹配/不匹配）与 `expectedType` 比对；或匹配结果与 `expected` 比对
  - jsonpath：`JSONPath({path: userInput, json: JSON.parse(input)})` 结果与 `expected` 比对
  - 全部 testCase 通过即答题正确
