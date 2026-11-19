/**
 * 错题本
 */
import { api } from '../../utils/api'

Page({
  data: {
    skill: '',
    filterSkill: '',
    filterStatus: '',
    list: [] as any[],
    total: 0,
    page: 1,
    pageSize: 50,
    loading: true,
    statusOptions: [
      { value: '', label: '全部' },
      { value: 'unreviewed', label: '待复习' },
      { value: 'stillwrong', label: '仍错' },
      { value: 'mastered', label: '已掌握' },
    ],
    skillOptions: [] as Array<{ value: string; label: string }>,
  },

  onLoad(query: { skill?: string }) {
    const app = getApp() as any
    const skills = app.globalData.skills.map((s: any) => ({ value: s.id, label: s.name }))
    this.setData({
      skill: query.skill || '',
      filterSkill: query.skill || '',
      skillOptions: [{ value: '', label: '全部板块' }, ...skills],
    })
    this.loadFirst()
  },

  onShow() {
    if (!this.data.loading) this.loadFirst()
  },

  async loadFirst() {
    this.setData({ page: 1, list: [], loading: true })
    await this.loadMore()
  },

  async loadMore() {
    this.setData({ loading: true })
    try {
      const res = await api.wrongbook({
        action: 'list',
        skill: this.data.filterSkill || undefined,
        status: this.data.filterStatus || undefined,
        page: this.data.page,
        pageSize: this.data.pageSize,
      })
      if (res.ok && res.data) {
        this.setData({
          list: [...this.data.list, ...res.data.list],
          total: res.data.total,
          page: this.data.page + 1,
          loading: false,
        })
      } else {
        this.setData({ loading: false })
      }
    } catch (e) {
      console.warn(e)
      this.setData({ loading: false })
    }
  },

  onSkillChange(e: WechatMiniprogram.PickerChange) {
    this.setData({ filterSkill: String(e.detail.value) })
    this.loadFirst()
  },

  onStatusChange(e: WechatMiniprogram.PickerChange) {
    this.setData({ filterStatus: String(e.detail.value) })
    this.loadFirst()
  },

  onReachBottom() {
    this.loadMore()
  },

  goQuestion(e: WechatMiniprogram.TouchEvent) {
    const { id, skill, level } = e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/question/question?skill=${skill}&level=${level}&questionId=${id}` })
  },

  async markMastered(e: WechatMiniprogram.TouchEvent) {
    const { id, idx } = e.currentTarget.dataset
    try {
      const res = await api.wrongbook({ action: 'master', questionId: id })
      if (res.ok) {
        const list = [...this.data.list]
        list[idx] = { ...list[idx], status: 'mastered' }
        this.setData({ list })
        wx.showToast({ title: '已标记掌握', icon: 'success' })
      }
    } catch (e) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  async remove(e: WechatMiniprogram.TouchEvent) {
    const { id, idx } = e.currentTarget.dataset
    const ok = await new Promise<boolean>((resolve) => {
      wx.showModal({
        title: '提示', content: '确定从错题本移除？',
        success: (r) => resolve(r.confirm),
      })
    })
    if (!ok) return
    try {
      const res = await api.wrongbook({ action: 'remove', questionId: id })
      if (res.ok) {
        const list = this.data.list.filter((_, i) => i !== idx)
        this.setData({ list, total: this.data.total - 1 })
        wx.showToast({ title: '已移除', icon: 'success' })
      }
    } catch (e) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },
})
