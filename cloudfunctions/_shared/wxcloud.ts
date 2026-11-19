/**
 * wx-cloud-sdk 的最小类型声明
 */
export interface Db {
  collection(name: string): Collection
}
export interface Collection {
  where(cond: Record<string, unknown>): Collection
  doc(id: string): Collection
  skip(n: number): Collection
  limit(n: number): Collection
  orderBy(field: string, order: 'asc' | 'desc'): Collection
  get(): Promise<{ data: any[] }>
  add(data: Record<string, unknown>): Promise<{ _id: string }>
  update(data: Record<string, unknown>): Promise<{ stats: { updated: number } }>
  remove(): Promise<{ stats: { removed: number } }>
  count(): Promise<{ total: number }>
}
export interface CloudContext {
  init(env?: string): void
  database(): Db
  getWXContext(): { OPENID: string; APPID: string; UNIONID?: string }
  callFunction(opt: { name: string; data?: unknown }): Promise<{ result: any }>
}
