/**
 * 获取关卡题目
 * 入参：{ skill, level, page=1, pageSize=20 }
 * 返回：{ list: Question[], total }
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { skill, level, page = 1, pageSize = 20 } = event || {}
  if (!skill || !level) return { ok: false, error: '缺少 skill/level' }

  const where = { skill, level }
  const countRes = await db.collection('questions').where(where).count()
  const total = countRes.total

  const skip = (page - 1) * pageSize
  const res = await db
    .collection('questions')
    .where(where)
    .skip(skip)
    .limit(pageSize)
    .get()

  return { ok: true, data: { list: res.data, total, page, pageSize } }
}
