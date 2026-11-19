/**
 * 共享类型定义
 * 前端与云函数共享
 */

/** 板块 ID */
export type SkillId = 'regex' | 'jsonpath' | 'linux' | 'kubectl'

/** 阶段 */
export type LevelId = 'low' | 'mid' | 'high' | 'top'

/** 题目类型 */
export type QuestionType = 'choice' | 'fill'

/** 题目测试用例期望类型 */
export type ExpectType = 'match' | 'nomatch' | 'equal'

/** 测试用例 */
export interface TestCase {
  /** 测试输入（regex: 待匹配字符串；jsonpath: JSON 字符串） */
  input: string
  /** 期望输出 */
  expected: string | string[]
  /** 匹配/不匹配/相等 */
  expectedType?: ExpectType
}

/** 题目 */
export interface Question {
  _id?: string
  id: string
  skill: SkillId
  level: LevelId
  type: QuestionType
  /** 题干 */
  title: string
  /** 补充说明 */
  content?: string

  /** 选择题选项 */
  options?: string[]
  /** 选择题正确答案索引 */
  answer?: number

  /** 填空题测试用例 */
  testCases?: TestCase[]
  /** 填空题提示 */
  hint?: string

  /** 详细答案解析（必填） */
  explanation: string
  /** 参考答案（填空题展示用） */
  referenceAnswer?: string
  /** 知识点标签 */
  tags?: string[]
  createdAt?: number
}

/** 用户作答状态 */
export type AnswerStatus = 'correct' | 'wrong' | 'unattempted'

/** 用户进度记录 */
export interface UserProgress {
  _id?: string
  _openid?: string
  skill: SkillId
  level: LevelId
  questionId: string
  status: AnswerStatus
  lastAnswer?: string | number
  attempts: number
  updatedAt: number
}

/** 错题来源 */
export type WrongSource = 'level' | 'exam'

/** 错题状态 */
export type WrongStatus = 'unreviewed' | 'mastered' | 'stillwrong'

/** 错题记录 */
export interface WrongQuestion {
  _id?: string
  _openid?: string
  skill: SkillId
  questionId: string
  source: WrongSource
  status: WrongStatus
  addedAt: number
  updatedAt: number
}

/** 考试记录 */
export interface ExamRecord {
  _id?: string
  _openid?: string
  skill: SkillId
  /** 第几套 1-20 */
  examSetId: number
  questionIds: string[]
  answers: Record<string, string | number>
  score: number
  total: number
  startedAt: number
  finishedAt: number
}

/** 板块阶段配置 */
export interface LevelConfig {
  id: LevelId
  name: string
  desc: string
  /** 题目总数 */
  count: number
}

/** 校验结果 */
export interface CheckResult {
  pass: boolean
  /** 每个 testCase 的通过情况 */
  details: { pass: boolean; got: string; expected: string }[]
  error?: string
}

/** 填空题校验器 */
export type Checker = (
  userInput: string,
  testCases: TestCase[]
) => CheckResult

/** 教程章节 */
export interface TutorialSection {
  id: string
  title: string
  /** markdown 内容 */
  content: string
  /** 配套练习（题目 id 列表） */
  exercises?: string[]
}

/** 板块定义 */
export interface Skill {
  id: SkillId
  name: string
  icon: string
  desc: string
  levels: LevelConfig[]
  checker: Checker
  tutorial: TutorialSection[]
  enabled: boolean
}

/** 板块汇总进度 */
export interface LevelProgress {
  level: LevelId
  total: number
  attempted: number
  correct: number
}

export interface SkillProgress {
  skill: SkillId
  levels: LevelProgress[]
}
