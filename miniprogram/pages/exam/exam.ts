/**
 * 考试列表页
 */
Page({
  data: {
    skill: '',
    skillName: '',
    examSets: [] as number[],
  },

  onLoad(query: { skill?: string }) {
    const skill = query.skill || 'regex'
    const app = getApp() as any
    const skillDef = app.globalData.skills.find((s: any) => s.id === skill)
    this.setData({
      skill,
      skillName: skillDef?.name || skill,
      examSets: Array.from({ length: 20 }, (_, i) => i + 1),
    })
    wx.setNavigationBarTitle({ title: `${skillDef?.name || ''}考试` })
  },

  goExam(e: WechatMiniprogram.TouchEvent) {
    const setId = Number(e.currentTarget.dataset.id)
    wx.navigateTo({ url: `/pages/exam-doing/exam-doing?skill=${this.data.skill}&examSetId=${setId}` })
  },
})
