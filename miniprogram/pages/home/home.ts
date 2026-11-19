/**
 * 首页：板块入口 + 总进度
 */
import { api } from '../../utils/api'

interface ProgressItem {
  skill: string
  levels: { level: string; total: number; attempted: number; correct: number }[]
}

Page({
  data: {
    skills: [] as Array<{ id: string; name: string; desc: string; icon: string; enabled: boolean }>,
    progress: {} as Record<string, { attempted: number; correct: number; total: number }>,
    loadingProgress: true,
  },

  onLoad() {
    const app = getApp() as any
    this.setData({ skills: app.globalData.skills })
    this.loadProgress()
    app.on('login', () => this.loadProgress())
  },

  onShow() {
    if (!this.data.loadingProgress) this.loadProgress()
  },

  async loadProgress() {
    try {
      const res = await api.getProgress()
      if (res.ok && res.data) {
        const map: Record<string, { attempted: number; correct: number; total: number }> = {}
        for (const sk of res.data.skills || []) {
          let attempted = 0, correct = 0, total = 0
          for (const lv of sk.levels) {
            attempted += lv.attempted
            correct += lv.correct
            total += lv.total
          }
          map[sk.skill] = { attempted, correct, total }
        }
        this.setData({ progress: map, loadingProgress: false })
      }
    } catch (e) {
      console.warn('loadProgress', e)
      this.setData({ loadingProgress: false })
    }
  },

  goSkill(e: WechatMiniprogram.TouchEvent) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/skill/skill?skill=${id}` })
  },
})
