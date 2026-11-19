/**
 * 云函数返回统一格式
 */
export interface CloudResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

export function ok<T>(data: T): CloudResult<T> {
  return { ok: true, data }
}

export function fail(error: string): CloudResult<never> {
  return { ok: false, error }
}
