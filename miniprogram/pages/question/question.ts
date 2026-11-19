/**
 * 做题页：选择题 / 填空题
 * 加载整个阶段题目列表，支持上一题/下一题翻页
 */
import { api } from '../../utils/api'

Page({
  data: {
    skill: '',
    level: '',
    questionId: '',
    idx: 0,
    list: [] as any[],
    question: null as any,
    loading: true,
    selected: -1,
    userInput: '',
    submitted: false,
    correct: false,
    checkResult: null as any,
    explanation: '',
    referenceAnswer: '',
    correctAnswer: -1,
    // 每题作答状态缓存（id -> 已提交）
    answeredMap: {} as Record<string, boolean>,
  },

  onLoad(query: { skill?: string; level?: string; questionId?: string; idx?: string }) {
    this.setData({
      skill: query.skill || '',
      level: query.level || '',
      questionId: query.questionId || '',
      idx: Number(query.idx || 0),
    })
    this.loadList()
  },

  async loadList() {
    this.setData({ loading: true })
    try {
      const res = await api.getQuestions({ skill: this.data.skill, level: this.data.level, page: 1, pageSize: 200 })
      if (res.ok && res.data) {
        const list = res.data.list || []
        this.setData({ list })
        this.showQuestion(this.data.idx)
      } else {
        wx.showToast({ title: '题目加载失败', icon: 'none' })
        this.setData({ loading: false })
      }
    } catch (e) {
      console.warn(e)
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  /** 显示第 idx 题 */
  showQuestion(idx: number) {
    const list = this.data.list
    if (idx < 0 || idx >= list.length) {
      this.setData({ loading: false })
      return
    }
    const q = list[idx]
    wx.setNavigationBarTitle({ title: `第 ${idx + 1} / ${list.length} 题` })
    this.setData({
      idx,
      question: q,
      questionId: q.id,
      loading: false,
      // 重置作答状态
      selected: -1,
      userInput: '',
      submitted: false,
      correct: false,
      checkResult: null,
      explanation: '',
      referenceAnswer: '',
      correctAnswer: -1,
    })
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
        const answeredMap = { ...this.data.answeredMap, [this.data.questionId]: true }
        this.setData({
          submitted: true,
          correct: d.correct,
          checkResult: d.checkResult,
          explanation: d.explanation,
          referenceAnswer: d.referenceAnswer,
          correctAnswer: d.correctAnswer,
          answeredMap,
        })
        if (d.correct) wx.showToast({ title: '回答正确', icon: 'success' })
        else wx.showToast({ title: '回答错误', icon: 'none' })
      } else {
        wx.showToast({ title: res.error || '提交失败', icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '网络错误', icon: 'none' })
    }
  },

  /** 上一题 */
  prev() {
    if (this.data.idx > 0) this.showQuestion(this.data.idx - 1)
  },

  /** 下一题 */
  next() {
    if (this.data.idx < this.data.list.length - 1) {
      this.showQuestion(this.data.idx + 1)
    } else {
      wx.showToast({ title: '已是最后一题', icon: 'none' })
    }
  },

  /** 返回列表 */
  back() {
    wx.navigateBack()
  },
})
