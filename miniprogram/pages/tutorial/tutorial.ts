/**
 * 交互式教程
 */
Page({
  data: {
    skill: '',
    sections: [] as any[],
    currentIdx: 0,
    current: null as any,
  },

  onLoad(query: { skill?: string }) {
    const skill = query.skill || 'regex'
    const app = getApp() as any
    const skillDef = app.globalData.skills.find((s: any) => s.id === skill)
    const sections = skillDef?.tutorial || []
    this.setData({
      skill,
      sections,
      currentIdx: 0,
      current: sections[0] || null,
    })
    wx.setNavigationBarTitle({ title: `${skillDef?.name || ''}教程` })
  },

  selectSection(e: WechatMiniprogram.TouchEvent) {
    const idx = Number(e.currentTarget.dataset.idx)
    this.setData({ currentIdx: idx, current: this.data.sections[idx] })
  },

  prev() {
    if (this.data.currentIdx > 0) {
      const idx = this.data.currentIdx - 1
      this.setData({ currentIdx: idx, current: this.data.sections[idx] })
    }
  },

  next() {
    if (this.data.currentIdx < this.data.sections.length - 1) {
      const idx = this.data.currentIdx + 1
      this.setData({ currentIdx: idx, current: this.data.sections[idx] })
    }
  },
})
