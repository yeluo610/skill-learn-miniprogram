/**
 * 获取用户进度汇总
 * 入参：{ skill? }
 * 返回：{ skills: [{ skill, levels: [{ level, total, attempted, correct }] }] }
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const wxCtx = cloud.getWXContext()
  const openid = wxCtx.OPENID
  const { skill } = event || {}

  const skills = skill ? [skill] : ['regex', 'jsonpath', 'linux', 'kubectl']
  const result = []

  for (const sk of skills) {
    const levels = []
    for (const lv of ['low', 'mid', 'high', 'top']) {
      const totalRes = await db.collection('questions').where({ skill: sk, level: lv }).count()
      const total = totalRes.total
      if (total === 0) {
        levels.push({ level: lv, total: 0, attempted: 0, correct: 0 })
        continue
      }
      // 统计 attempted 与 correct
      const progRes = await db
        .collection('user_progress')
        .where({ _openid: openid, skill: sk, level: lv })
        .limit(1000)
        .get()
      const prog = progRes.data
      const attempted = prog.length
      const correct = prog.filter((p) => p.status === 'correct').length
      levels.push({ level: lv, total, attempted, correct })
    }
    result.push({ skill: sk, levels })
  }

  return { ok: true, data: { skills: result } }
}
