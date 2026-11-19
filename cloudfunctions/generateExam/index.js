/**
 * 生成考试卷
 * 入参：{ skill, examSetId? }
 * 返回：{ examSetId, questionIds, questions }
 * 从题库随机抽 50 题（每阶段按比例：低20/中15/高10/顶5，题库不足时降级补充）
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

async function pickFromLevel(skill, level, count) {
  if (count <= 0) return []
  const res = await db.collection('questions').where({ skill, level }).limit(200).get()
  return shuffle(res.data).slice(0, count)
}

exports.main = async (event) => {
  const wxCtx = cloud.getWXContext()
  const openid = wxCtx.OPENID
  const { skill, examSetId } = event || {}
  if (!skill) return { ok: false, error: '缺少 skill' }

  // 默认每阶段配额，可调整
  const quota = { low: 20, mid: 15, high: 10, top: 5 }
  const total = Object.values(quota).reduce((a, b) => a + b, 0)

  let picked = []
  for (const lv of ['low', 'mid', 'high', 'top']) {
    const got = await pickFromLevel(skill, lv, quota[lv])
    picked = picked.concat(got)
  }
  // 若不足 total，从全部题库补
  if (picked.length < total) {
    const more = await db.collection('questions').where({ skill }).limit(300).get()
    const existIds = new Set(picked.map((q) => q._id))
    const extras = shuffle(more.data.filter((q) => !existIds.has(q._id))).slice(0, total - picked.length)
    picked = picked.concat(extras)
  }

  const questionIds = picked.map((q) => q.id)
  const setId = examSetId || Math.floor(Math.random() * 20) + 1
  const now = Date.now()

  // 记录考试记录
  const examRec = await db.collection('exam_records').add({
    data: {
      _openid: openid,
      skill,
      examSetId: setId,
      questionIds,
      answers: {},
      score: 0,
      total: picked.length,
      startedAt: now,
      finishedAt: 0,
    },
  })

  return {
    ok: true,
    data: {
      examId: examRec._id,
      examSetId: setId,
      questions: picked,
      total: picked.length,
    },
  }
}
