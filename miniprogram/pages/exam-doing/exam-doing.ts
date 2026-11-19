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
    // 自定义确认弹层
    showConfirm: false,
    unansweredCount: 0,
    submitting: false,
    // 错误提示
    showError: false,
    errorMsg: '',
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
        this.showError(res.error || '出卷失败')
        this.setData({ loading: false })
      }
    } catch (e) {
      wx.hideLoading()
      this.showError('网络错误，请检查云函数是否部署')
      this.setData({ loading: false })
    }
  },

  /** 统计真实已答数（非空） */
  countAnswered(): number {
    const a = this.data.answers
    return Object.keys(a).filter((k) => a[k] !== '' && a[k] !== undefined && a[k] !== null).length
  },

  onSelect(e: WechatMiniprogram.TouchEvent) {
    if (this.data.submitted) return
    const q = this.data.questions[this.data.current]
    const answers = { ...this.data.answers, [q.id]: Number(e.currentTarget.dataset.idx) }
    this.setData({ answers, answeredCount: this.countAnswered.call({ data: { answers } }) })
    // 重新计算
    const cnt = Object.keys(answers).filter((k) => answers[k] !== '' && answers[k] !== undefined && answers[k] !== null).length
    this.setData({ answeredCount: cnt })
  },

  onInput(e: WechatMiniprogram.Input) {
    const q = this.data.questions[this.data.current]
    const answers = { ...this.data.answers, [q.id]: e.detail.value }
    const cnt = Object.keys(answers).filter((k) => answers[k] !== '' && answers[k] !== undefined && answers[k] !== null).length
    this.setData({ answers, answeredCount: cnt })
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

  /** 点交卷按钮 */
  onSubmitTap() {
    const answered = this.data.answeredCount
    const unanswered = this.data.questions.length - answered
    if (unanswered > 0) {
      this.setData({ showConfirm: true, unansweredCount: unanswered })
    } else {
      this.doSubmit()
    }
  },

  /** 确认交卷 */
  confirmSubmit() {
    this.setData({ showConfirm: false })
    this.doSubmit()
  },

  cancelSubmit() {
    this.setData({ showConfirm: false })
  },

  async doSubmit() {
    if (this.data.submitting) return
    this.setData({ submitting: true })
    wx.showLoading({ title: '评分中...' })
    try {
      const res = await api.submitExam({ examId: this.data.examId, answers: this.data.answers })
      wx.hideLoading()
      this.setData({ submitting: false })
      if (res.ok && res.data) {
        const app = getApp() as any
        app.globalData._lastExamResult = { ...res.data, skill: this.data.skill, examSetId: this.data.examSetId }
        wx.redirectTo({ url: `/pages/exam-result/exam-result?skill=${this.data.skill}&examSetId=${this.data.examSetId}` })
      } else {
        this.showError(res.error || '提交失败，请重试')
      }
    } catch (e) {
      wx.hideLoading()
      this.setData({ submitting: false })
      this.showError('网络错误，请检查 submitExam 云函数是否部署')
    }
  },

  showError(msg: string) {
    this.setData({ showError: true, errorMsg: msg })
  },

  closeError() {
    this.setData({ showError: false })
  },
})
