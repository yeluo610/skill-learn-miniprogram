/**
 * 通用校验工具
 */
import type { CheckResult, TestCase } from './types'

/**
 * 把任意值转成可读字符串
 */
export function stringify(v: unknown): string {
  if (v === null) return 'null'
  if (v === undefined) return 'undefined'
  if (typeof v === 'string') return v
  return JSON.stringify(v)
}

/**
 * 比对两个字符串数组是否内容一致（忽略顺序）
 */
export function arraysEqualUnordered(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((v, i) => v === sb[i])
}

/**
 * 把 expected 统一成数组
 */
export function toExpectedArray(expected: string | string[]): string[] {
  return Array.isArray(expected) ? expected : [expected]
}

/**
 * 运行 checker 并构造 CheckResult
 */
export function buildResult(
  details: { pass: boolean; got: string; expected: string }[],
  error?: string
): CheckResult {
  return {
    pass: details.length > 0 && details.every((d) => d.pass),
    details,
    error,
  }
}
