/**
 * 云函数共享类型（与 miniprogram/shared/types.ts 保持同步）
 */
export type SkillId = 'regex' | 'jsonpath' | 'linux' | 'kubectl'
export type LevelId = 'low' | 'mid' | 'high' | 'top'
export type QuestionType = 'choice' | 'fill'
export type ExpectType = 'match' | 'nomatch' | 'equal'

export interface TestCase {
  input: string
  expected: string | string[]
  expectedType?: ExpectType
}

export interface Question {
  _id?: string
  id: string
  skill: SkillId
  level: LevelId
  type: QuestionType
  title: string
  content?: string
  options?: string[]
  answer?: number
  testCases?: TestCase[]
  hint?: string
  explanation: string
  referenceAnswer?: string
  tags?: string[]
  createdAt?: number
}

export interface CheckResult {
  pass: boolean
  details: { pass: boolean; got: string; expected: string }[]
  error?: string
}
