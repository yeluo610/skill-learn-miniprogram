/**
 * 做题页：选择题 / 填空题
 */
import { api } from '../../utils/api'

Page({
  data: {
    skill: '',
    level: '',
    questionId: '',
    idx: 0,
    question: null as any,
    loading: true,
    selected: -1,           // 选择题选中
    userInput: '',          // 填空题输入
    submitted: false,
    correct: false,
    checkResult: null as any,
    explanation: '',
    referenceAnswer: '',
    correctAnswer: -1,
  },

  onLoad(query: { skill?: string; level?: string; questionId?: string; idx?: string }) {
    this.setData({
      skill: query.skill || '',
      level: query.level || '',
      questionId: query.questionId || '',
      idx: Number(query.idx || 0),
    })
    this.loadQuestion()
  },

  async loadQuestion() {
    this.setData({ loading: true, submitted: false, selected: -1, userInput: '' })
    try {
      // 通过 getQuestions 取该题（简单起见拉首页题列表）
      const res = await api.getQuestions({ skill: this.data.skill, level: this.data.level, page: 1, pageSize: 200 })
      if (res.ok && res.data) {
        const q = res.data.list.find((x: any) => x.id === this.data.questionId)
        if (q) {
          wx.setNavigationBarTitle({ title: `第 ${this.data.idx + 1} 题` })
          this.setData({ question: q, loading: false })
          return
        }
      }
      wx.showToast({ title: '题目加载失败', icon: 'none' })
      this.setData({ loading: false })
    } catch (e) {
      console.warn(e)
      this.setData({ loading: false })
    }
  },

  onSelect(e: WechatMiniprogram.TouchEvent) {
    if (this.data.submitted) return
    this.setData({ selected: Number(e.currentTarget.dataset.idx) })
  },

  onInput(e: WechatMiniprogram.Input) {
    this.setData({ userInput: e.detail.value })
  },

  async onSubmit() {
    const q = this.data.question
    if (!q) return
    if (q.type === 'choice' && this.data.selected < 0) {
      wx.showToast({ title: '请选择一个答案', icon: 'none' })
      return
    }
    if (q.type === 'fill' && !this.data.userInput.trim()) {
      wx.showToast({ title: '请输入答案', icon: 'none' })
      return
    }

    const answer = q.type === 'choice' ? this.data.selected : this.data.userInput
    wx.showLoading({ title: '提交中' })
    try {
      const res = await api.submitAnswer({
        questionId: this.data.questionId,
        skill: this.data.skill,
        level: this.data.level,
        type: q.type,
        answer,
      })
      wx.hideLoading()
      if (res.ok && res.data) {
        const d = res.data
        this.setData({
          submitted: true,
          correct: d.correct,
          checkResult: d.checkResult,
          explanation: d.explanation,
          referenceAnswer: d.referenceAnswer,
          correctAnswer: d.correctAnswer,
        })
        if (d.correct) wx.showToast({ title: '回答正确！', icon: 'success' })
        else wx.showToast({ title: '回答错误', icon: 'none' })
      } else {
        wx.showToast({ title: res.error || '提交失败', icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '网络错误', icon: 'none' })
    }
  },

  goNext() {
    // 简化：返回关卡列表，由用户选下一题；后续可优化为自动翻页
    wx.navigateBack()
  },
})
