/**
 * 通用数据库助手
 */
import type { Db } from './wxcloud'

/** 分页查询 */
export async function findMany<T>(
  db: Db,
  collection: string,
  where: Record<string, unknown>,
  { limit = 100, skip = 0 }: { limit?: number; skip?: number } = {}
): Promise<T[]> {
  const res = await db
    .collection(collection)
    .where(where)
    .skip(skip)
    .limit(limit)
    .get()
  return res.data as T[]
}

/** 取openid */
export function getOpenid(): string {
  // @ts-ignore 微信云函数注入
  return (typeof wxServer === 'object' && wxServer.OPENID) || ''
}
