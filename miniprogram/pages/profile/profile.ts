/**
 * 个人中心
 */
import { api } from '../../utils/api'

Page({
  data: {
    loggedIn: false,
    nickname: '',
    avatarUrl: '',
    skills: [] as Array<{ id: string; name: string; attempted: number; correct: number; total: number }>,
  },

  onLoad() {
    const app = getApp() as any
    if (app.globalData.openid) {
      this.setData({
        loggedIn: true,
        nickname: app.globalData.nickname,
        avatarUrl: app.globalData.avatarUrl,
      })
      this.loadProgress()
    } else {
      app.on('login', () => {
        this.setData({
          loggedIn: true,
          nickname: app.globalData.nickname,
          avatarUrl: app.globalData.avatarUrl,
        })
        this.loadProgress()
      })
    }
  },

  onShow() {
    if (this.data.loggedIn) this.loadProgress()
  },

  async login() {
    const app = getApp() as any
    try {
      const userInfo = await new Promise<WechatMiniprogram.UserInfoSuccessCallbackResult>((resolve, reject) => {
        wx.getUserProfile({ desc: '用于展示昵称头像', success: resolve, fail: reject })
      }).catch(() => null as any)
      const data = userInfo ? { nickname: userInfo.userInfo.nickName, avatarUrl: userInfo.userInfo.avatarUrl } : {}
      const res = await api.login(data)
      if (res.ok && res.data) {
        app.globalData.openid = res.data.openid
        app.globalData.nickname = res.data.nickname
        app.globalData.avatarUrl = res.data.avatarUrl
        this.setData({ loggedIn: true, nickname: res.data.nickname, avatarUrl: res.data.avatarUrl })
        this.loadProgress()
      } else {
        wx.showToast({ title: res.error || '登录失败', icon: 'none' })
      }
    } catch (e) {
      wx.showToast({ title: '登录取消', icon: 'none' })
    }
  },

  async loadProgress() {
    try {
      const res = await api.getProgress()
      if (!res.ok || !res.data) return
      const app = getApp() as any
      const skillsDef = app.globalData.skills
      const skills = (res.data.skills || [])
        .filter((sk: any) => skillsDef.some((s: any) => s.id === sk.skill))
        .map((sk: any) => {
          const def = skillsDef.find((s: any) => s.id === sk.skill)
          let attempted = 0, correct = 0, total = 0
          for (const lv of sk.levels) {
            attempted += lv.attempted
            correct += lv.correct
            total += lv.total
          }
          return { id: sk.skill, name: def?.name || sk.skill, attempted, correct, total }
        })
      this.setData({ skills })
    } catch (e) {
      console.warn(e)
    }
  },
})
