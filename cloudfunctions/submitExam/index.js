/**
 * 提交考试
 * 入参：{ examId, answers: Record<questionId, string|number> }
 * 返回：{ score, total, details: [{questionId, correct, correctAnswer, explanation}] }
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

function buildResult(details, error) {
  return { pass: details.length > 0 && details.every((d) => d.pass), details, error }
}
function toExpectedArray(expected) {
  return Array.isArray(expected) ? expected : [expected]
}
function arraysEqualUnordered(a, b) {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((v, i) => v === sb[i])
}
function stringify(v) {
  if (v === null) return 'null'
  if (v === undefined) return 'undefined'
  if (typeof v === 'string') return v
  return JSON.stringify(v)
}
function regexChecker(userInput, testCases) {
  let re
  try { re = new RegExp(userInput, 'g') } catch (e) {
    return buildResult([], `正则语法错误：${e.message}`)
  }
  const details = testCases.map((tc) => {
    const expectedArr = toExpectedArray(tc.expected)
    const matches = []
    let m
    re.lastIndex = 0
    while ((m = re.exec(tc.input)) !== null) {
      matches.push(m[0])
      if (m.index === re.lastIndex) re.lastIndex++
    }
    const got = matches.join(', ')
    const expectedStr = expectedArr.join(', ')
    let pass = false
    switch (tc.expectedType) {
      case 'nomatch': pass = matches.length === 0; break
      case 'equal': pass = matches.length === 1 && matches[0] === expectedArr[0]; break
      default: pass = arraysEqualUnordered(matches, expectedArr); break
    }
    return { pass, got, expected: expectedStr }
  })
  return buildResult(details)
}
function jsonpathChecker(userInput, testCases) {
  let JSONPath
  try { JSONPath = require('jsonpath-plus').JSONPath } catch {
    return buildResult([], 'jsonpath-plus 未安装')
  }
  const details = testCases.map((tc) => {
    let json
    try { json = JSON.parse(tc.input) } catch {
      return { pass: false, got: 'JSON 解析失败', expected: tc.expected }
    }
    let result
    try { result = JSONPath({ path: userInput, json }) } catch (e) {
      return { pass: false, got: `执行错误：${e.message}`, expected: tc.expected }
    }
    const gotArr = (Array.isArray(result) ? result : [result]).map((v) =>
      typeof v === 'string' ? v : stringify(v)
    )
    const expectedArr = toExpectedArray(tc.expected)
    const pass = arraysEqualUnordered(gotArr, expectedArr)
    return { pass, got: gotArr.join(', '), expected: expectedArr.join(', ') }
  })
  return buildResult(details)
}

exports.main = async (event) => {
  const wxCtx = cloud.getWXContext()
  const openid = wxCtx.OPENID
  const { examId, answers } = event || {}
  if (!examId || !answers) return { ok: false, error: '参数缺失' }

  const recRes = await db.collection('exam_records').doc(examId).get()
  const rec = recRes.data
  if (!rec || rec._openid !== openid) return { ok: false, error: '考试记录不存在' }

  // 拉题目（按 questionId 一次拿）
  const idArr = rec.questionIds
  const qRes = await db.collection('questions').where({ id: _.in(idArr) }).limit(200).get()
  const qMap = new Map(qRes.data.map((q) => [q.id, q]))

  let score = 0
  const details = []
  const wrongNow = []
  for (const qid of idArr) {
    const q = qMap.get(qid)
    if (!q) continue
    const ua = answers[qid]
    let correct = false
    if (q.type === 'choice') {
      correct = Number(ua) === q.answer
    } else if (q.type === 'fill' && q.testCases) {
      const checker = q.skill === 'regex' ? regexChecker : q.skill === 'jsonpath' ? jsonpathChecker : null
      if (checker) correct = checker(String(ua), q.testCases).pass
    }
    if (correct) score++
    else wrongNow.push(q)
    details.push({
      questionId: qid,
      correct,
      correctAnswer: q.answer,
      referenceAnswer: q.referenceAnswer,
      explanation: q.explanation,
      question: q,
      userAnswer: ua,
    })
  }

  // 更新考试记录
  await db.collection('exam_records').doc(examId).update({
    data: { answers, score, total: idArr.length, finishedAt: Date.now() },
  })

  // 错题入错题本
  const now = Date.now()
  const wb = db.collection('wrong_questions')
  for (const q of wrongNow) {
    const exist = await wb.where({ _openid: openid, questionId: q.id }).limit(1).get()
    if (exist.data.length === 0) {
      await wb.add({
        data: { _openid: openid, skill: q.skill, questionId: q.id, source: 'exam', status: 'unreviewed', addedAt: now, updatedAt: now },
      })
    } else {
      await wb.doc(exist.data[0]._id).update({ data: { status: 'unreviewed', updatedAt: now } })
    }
  }

  return {
    ok: true,
    data: { score, total: idArr.length, details },
  }
}
