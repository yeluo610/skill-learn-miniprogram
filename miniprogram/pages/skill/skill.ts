/**
 * 板块页：阶段列表 + 考试入口 + 教程入口 + 错题入口
 */
import { api } from '../../utils/api'

Page({
  data: {
    skill: '',
    skillName: '',
    levels: [] as Array<{ id: string; name: string; desc: string; count: number; attempted: number; correct: number; total: number }>,
    loading: true,
  },

  onLoad(query: { skill?: string }) {
    const skill = query.skill || 'regex'
    const app = getApp() as any
    const skillDef = app.globalData.skills.find((s: any) => s.id === skill)
    this.setData({ skill, skillName: skillDef?.name || skill })
    wx.setNavigationBarTitle({ title: skillDef?.name || '' })
    this.loadProgress(skill)
  },

  onShow() {
    if (!this.data.loading) this.loadProgress(this.data.skill)
  },

  async loadProgress(skill: string) {
    try {
      const res = await api.getProgress({ skill })
      const levels = (this.getAppSkill().levels as any[]).map((lv) => ({
        id: lv.id, name: lv.name, desc: lv.desc, count: lv.count,
        attempted: 0, correct: 0, total: 0,
      }))
      if (res.ok && res.data) {
        const skProg = (res.data.skills || [])[0]
        if (skProg) {
          for (const lv of levels) {
            const found = (skProg.levels || []).find((x: any) => x.level === lv.id)
            if (found) {
              lv.attempted = found.attempted
              lv.correct = found.correct
              lv.total = found.total || lv.count
            }
          }
        }
      }
      this.setData({ levels, loading: false })
    } catch (e) {
      console.warn(e)
      this.setData({ loading: false })
    }
  },

  getAppSkill() {
    const app = getApp() as any
    return app.globalData.skills.find((s: any) => s.id === this.data.skill)
  },

  goLevel(e: WechatMiniprogram.TouchEvent) {
    const { level } = e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/level/level?skill=${this.data.skill}&level=${level}` })
  },

  goExam() {
    wx.navigateTo({ url: `/pages/exam/exam?skill=${this.data.skill}` })
  },

  goTutorial() {
    wx.navigateTo({ url: `/pages/tutorial/tutorial?skill=${this.data.skill}` })
  },
})
