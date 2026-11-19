/**
 * 错题本：列表 / 标记 / 移除
 * 入参：
 *   - action: 'list' | 'master' | 'remove'
 *   - list: { skill?, status?, page=1, pageSize=20 }
 *   - master/remove: { questionId }
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const wxCtx = cloud.getWXContext()
  const openid = wxCtx.OPENID
  const { action = 'list' } = event || {}
  const now = Date.now()

  if (action === 'list') {
    const { skill, status, page = 1, pageSize = 50 } = event || {}
    const where = { _openid: openid }
    if (skill) where.skill = skill
    if (status) where.status = status
    const countRes = await db.collection('wrong_questions').where(where).count()
    const total = countRes.total
    const skip = (page - 1) * pageSize
    const res = await db.collection('wrong_questions').where(where).skip(skip).limit(pageSize).orderBy('addedAt', 'desc').get()
    // 附带题目详情
    const ids = res.data.map((w) => w.questionId)
    let qMap = new Map()
    if (ids.length) {
      const qRes = await db.collection('questions').where({ id: _.in(ids) }).limit(100).get()
      qMap = new Map(qRes.data.map((q) => [q.id, q]))
    }
    const list = res.data.map((w) => ({ ...w, question: qMap.get(w.questionId) }))
    return { ok: true, data: { list, total, page, pageSize } }
  }

  if (action === 'master') {
    const { questionId } = event || {}
    if (!questionId) return { ok: false, error: '缺少 questionId' }
    await db.collection('wrong_questions').where({ _openid: openid, questionId }).update({
      data: { status: 'mastered', updatedAt: now },
    })
    return { ok: true, data: { questionId, status: 'mastered' } }
  }

  if (action === 'remove') {
    const { questionId } = event || {}
    if (!questionId) return { ok: false, error: '缺少 questionId' }
    await db.collection('wrong_questions').where({ _openid: openid, questionId }).remove()
    return { ok: true, data: { questionId, removed: true } }
  }

  return { ok: false, error: '未知 action' }
}
