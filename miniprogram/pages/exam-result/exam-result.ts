/**
 * 考试结果页
 */
Page({
  data: {
    skill: '',
    examSetId: 0,
    score: 0,
    total: 0,
    details: [] as any[],
    expanded: -1,
  },

  onLoad(query: { skill?: string; examSetId?: string }) {
    const app = getApp() as any
    const result = app.globalData._lastExamResult
    if (!result) {
      wx.showToast({ title: '结果已过期', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 800)
      return
    }
    this.setData({
      skill: query.skill || result.skill || '',
      examSetId: Number(query.examSetId || result.examSetId || 0),
      score: result.score,
      total: result.total,
      details: result.details,
    })
    wx.setNavigationBarTitle({ title: '考试结果' })
    delete app.globalData._lastExamResult
  },

  toggle(e: WechatMiniprogram.TouchEvent) {
    const idx = Number(e.currentTarget.dataset.idx)
    this.setData({ expanded: this.data.expanded === idx ? -1 : idx })
  },
})
