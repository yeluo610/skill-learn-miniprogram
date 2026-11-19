/**
 * 提交单题答案
 * 入参：{ questionId, skill, level, type, answer }
 *   - 选择题: answer = number (选项索引)
 *   - 填空题: answer = string (用户输入)
 * 返回：{ correct, checkResult? (填空题校验详情), correctAnswer, explanation }
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

function buildResult(details, error) {
  return {
    pass: details.length > 0 && details.every((d) => d.pass),
    details,
    error,
  }
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
  try {
    // 支持用户输入 /pattern/flags 形式（如 /\d/g），自动剥离斜杠和标志
    let pattern = userInput
    let flags = 'g'
    const m = /^\/(.+)\/([gimsuy]*)$/.exec(userInput.trim())
    if (m) {
      pattern = m[1]
      // 若用户指定了 flags 则用用户的，但强制加 g（确保全局匹配）
      flags = m[2].includes('g') ? m[2] : 'g' + m[2]
    }
    re = new RegExp(pattern, flags)
  } catch (e) {
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
  try {
    JSONPath = require('jsonpath-plus').JSONPath
  } catch {
    return buildResult([], 'jsonpath-plus 未安装')
  }
  const details = testCases.map((tc) => {
    let json
    try {
      json = JSON.parse(tc.input)
    } catch {
      return { pass: false, got: 'JSON 解析失败', expected: tc.expected }
    }
    let result
    try {
      result = JSONPath({ path: userInput, json })
    } catch (e) {
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
  const { questionId, skill, level, type, answer } = event || {}
  if (!questionId || !skill || !level || !type) {
    return { ok: false, error: '参数缺失' }
  }

  const qRes = await db.collection('questions').where({ id: questionId }).limit(1).get()
  if (qRes.data.length === 0) return { ok: false, error: '题目不存在' }
  const q = qRes.data[0]

  let correct = false
  let checkResult = null

  if (type === 'choice') {
    correct = Number(answer) === q.answer
  } else if (type === 'fill') {
    if (!q.testCases || q.testCases.length === 0) {
      return { ok: false, error: '填空题缺少测试用例' }
    }
    const checker = skill === 'regex' ? regexChecker : skill === 'jsonpath' ? jsonpathChecker : null
    if (!checker) return { ok: false, error: `板块 ${skill} 暂不支持填空题` }
    checkResult = checker(String(answer), q.testCases)
    correct = checkResult.pass
  } else {
    return { ok: false, error: '未知题型' }
  }

  // 写进度
  const prog = db.collection('user_progress')
  const exist = await prog.where({ _openid: openid, questionId }).limit(1).get()
  const status = correct ? 'correct' : 'wrong'
  const now = Date.now()
  if (exist.data.length === 0) {
    await prog.add({
      data: { _openid: openid, skill, level, questionId, status, lastAnswer: answer, attempts: 1, updatedAt: now },
    })
  } else {
    const id = exist.data[0]._id
    await prog.doc(id).update({
      data: { status, lastAnswer: answer, attempts: _.inc(1), updatedAt: now },
    })
  }

  // 错题入错题本
  const wb = db.collection('wrong_questions')
  if (!correct) {
    const wexist = await wb.where({ _openid: openid, questionId }).limit(1).get()
    if (wexist.data.length === 0) {
      await wb.add({
        data: { _openid: openid, skill, questionId, source: 'level', status: 'unreviewed', addedAt: now, updatedAt: now },
      })
    } else {
      await wb.doc(wexist.data[0]._id).update({
        data: { status: 'unreviewed', updatedAt: now },
      })
    }
  } else {
    // 答对：若错题本存在该题，标记 mastered
    const wexist = await wb.where({ _openid: openid, questionId }).limit(1).get()
    if (wexist.data.length > 0 && wexist.data[0].status !== 'mastered') {
      await wb.doc(wexist.data[0]._id).update({ data: { status: 'mastered', updatedAt: now } })
    }
  }

  return {
    ok: true,
    data: {
      correct,
      checkResult,
      correctAnswer: q.answer,
      referenceAnswer: q.referenceAnswer,
      explanation: q.explanation,
    },
  }
}
