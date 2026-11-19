/**
 * 登录云函数
 * 入参：可选 nickname/avatarUrl
 * 返回：{ openid, nickname }
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const wxCtx = cloud.getWXContext()
  const openid = wxCtx.OPENID
  if (!openid) return { ok: false, error: '获取 openid 失败' }

  const { nickname = '', avatarUrl = '' } = event || {}
  const users = db.collection('users')

  // 查用户
  const found = await users.where({ _openid: openid }).get()
  if (found.data.length === 0) {
    await users.add({
      data: {
        _openid: openid,
        nickname,
        avatarUrl,
        createdAt: Date.now(),
      },
    })
  } else if (nickname || avatarUrl) {
    const update: Record<string, unknown> = {}
    if (nickname) update.nickname = nickname
    if (avatarUrl) update.avatarUrl = avatarUrl
    await users.where({ _openid: openid }).update({ data: update })
  }

  const user = found.data[0] || (await users.where({ _openid: openid }).get()).data[0]
  return {
    ok: true,
    data: { openid, nickname: user?.nickname || nickname, avatarUrl: user?.avatarUrl || avatarUrl },
  }
}
