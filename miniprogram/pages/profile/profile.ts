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
    logging: false,
  },

  onLoad() {
    const app = getApp() as any
    if (app.globalData.openid) {
      this.setLoggedIn(app.globalData)
    } else {
      app.on('login', () => {
        this.setLoggedIn(app.globalData)
      })
    }
  },

  onShow() {
    if (this.data.loggedIn) this.loadProgress()
  },

  setLoggedIn(g: any) {
    this.setData({
      loggedIn: true,
      nickname: g.nickname || '已登录',
      avatarUrl: g.avatarUrl || '',
    })
    this.loadProgress()
  },

  /** 手动触发登录（静默：调 login 云函数拿 openid） */
  async login() {
    if (this.data.logging) return
    this.setData({ logging: true })
    const app = getApp() as any
    try {
      const res = await api.login({})
      if (res.ok && res.data?.openid) {
        app.globalData.openid = res.data.openid
        app.globalData.nickname = res.data.nickname || ''
        app.globalData.avatarUrl = res.data.avatarUrl || ''
        this.setLoggedIn(app.globalData)
        wx.showToast({ title: '登录成功', icon: 'success' })
      } else {
        wx.showToast({ title: res.error || '登录失败', icon: 'none' })
      }
    } catch (e) {
      wx.showToast({ title: (e as Error).message || '网络错误', icon: 'none', duration: 3000 })
    }
    this.setData({ logging: false })
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
