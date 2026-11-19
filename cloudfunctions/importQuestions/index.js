/**
 * 批量导入题库到云数据库
 * 入参：{ questions: Question[] }  或 { file: 'regex/low' }（从云存储读取）
 * 返回：{ inserted, failed }
 *
 * 注意：单次云函数数据量有限，建议分批传入（每批 50 条）。
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const wxCtx = cloud.getWXContext()
  const openid = wxCtx.OPENID
  const { questions } = event || {}

  if (!Array.isArray(questions)) {
    return { ok: false, error: 'questions 必须是数组' }
  }

  const col = db.collection('questions')
  let inserted = 0
  let failed = 0
  const errors = []

  for (const q of questions) {
    try {
      await col.add({
        data: {
          ...q,
          _openid: openid, // 标记导入者
          createdAt: Date.now(),
        },
      })
      inserted++
    } catch (e) {
      failed++
      errors.push({ id: q.id, error: e.message })
    }
  }

  return {
    ok: true,
    data: { inserted, failed, errors: errors.slice(0, 20) },
  }
}
