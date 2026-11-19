/**
 * 考试做题页
 */
import { api } from '../../utils/api'

Page({
  data: {
    skill: '',
    examSetId: 0,
    examId: '',
    questions: [] as any[],
    current: 0,
    answers: {} as Record<string, string | number>,
    answeredCount: 0,
    loading: true,
    submitted: false,
  },

  onLoad(query: { skill?: string; examSetId?: string }) {
    this.setData({
      skill: query.skill || 'regex',
      examSetId: Number(query.examSetId || 1),
    })
    this.startExam()
  },

  async startExam() {
    wx.showLoading({ title: '出卷中...' })
    try {
      const res = await api.generateExam({ skill: this.data.skill, examSetId: this.data.examSetId })
      wx.hideLoading()
      if (res.ok && res.data) {
        this.setData({
          examId: res.data.examId,
          questions: res.data.questions,
          loading: false,
        })
      } else {
        wx.showToast({ title: res.error || '出卷失败', icon: 'none' })
        this.setData({ loading: false })
      }
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '网络错误', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  onSelect(e: WechatMiniprogram.TouchEvent) {
    if (this.data.submitted) return
    const q = this.data.questions[this.data.current]
    const answers = { ...this.data.answers, [q.id]: Number(e.currentTarget.dataset.idx) }
    this.setData({ answers, answeredCount: Object.keys(answers).length })
  },

  onInput(e: WechatMiniprogram.Input) {
    const q = this.data.questions[this.data.current]
    const answers = { ...this.data.answers, [q.id]: e.detail.value }
    this.setData({ answers, answeredCount: Object.keys(answers).filter((k) => answers[k] !== '' && answers[k] !== undefined).length })
  },

  prev() {
    if (this.data.current > 0) this.setData({ current: this.data.current - 1 })
  },

  next() {
    if (this.data.current < this.data.questions.length - 1) {
      this.setData({ current: this.data.current + 1 })
    }
  },

  goJump(e: WechatMiniprogram.TouchEvent) {
    this.setData({ current: Number(e.currentTarget.dataset.idx) })
  },

  async submit() {
    const answered = Object.keys(this.data.answers).length
    if (answered < this.data.questions.length) {
      const ok = await new Promise<boolean>((resolve) => {
        wx.showModal({
          title: '提示',
          content: `还有 ${this.data.questions.length - answered} 题未作答，确定交卷？`,
          success: (r) => resolve(r.confirm),
        })
      })
      if (!ok) return
    }
    wx.showLoading({ title: '评分中...' })
    try {
      const res = await api.submitExam({ examId: this.data.examId, answers: this.data.answers })
      wx.hideLoading()
      if (res.ok && res.data) {
        const app = getApp() as any
        // 通过全局缓存传递结果（大数据不适合通过 URL）
        app.globalData._lastExamResult = { ...res.data, skill: this.data.skill, examSetId: this.data.examSetId }
        wx.redirectTo({ url: `/pages/exam-result/exam-result?skill=${this.data.skill}&examSetId=${this.data.examSetId}` })
      } else {
        wx.showToast({ title: res.error || '提交失败', icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '网络错误', icon: 'none' })
    }
  },
})
