/**
 * 关卡题目列表
 */
import { api } from '../../utils/api'

const LEVEL_NAMES: Record<string, string> = {
  low: '初级', mid: '中级', high: '高级', top: '顶级',
}

Page({
  data: {
    skill: '',
    level: '',
    levelName: '',
    list: [] as any[],
    total: 0,
    page: 1,
    pageSize: 20,
    loading: true,
    progress: {} as Record<string, string>, // questionId -> status
  },

  onLoad(query: { skill?: string; level?: string }) {
    const skill = query.skill || 'regex'
    const level = query.level || 'low'
    this.setData({ skill, level, levelName: LEVEL_NAMES[level] || level })
    wx.setNavigationBarTitle({ title: `${LEVEL_NAMES[level] || level} 关卡` })
    this.loadFirst()
  },

  async loadFirst() {
    this.setData({ page: 1, list: [], loading: true })
    await this.loadMore()
  },

  async loadMore() {
    if (this.data.loading === false && this.data.list.length >= this.data.total) return
    this.setData({ loading: true })
    try {
      const res = await api.getQuestions({
        skill: this.data.skill,
        level: this.data.level,
        page: this.data.page,
        pageSize: this.data.pageSize,
      })
      if (res.ok && res.data) {
        const newList = [...this.data.list, ...res.data.list]
        this.setData({
          list: newList,
          total: res.data.total,
          page: this.data.page + 1,
          loading: false,
        })
        this.loadProgress(newList.map((q: any) => q.id))
      } else {
        this.setData({ loading: false })
      }
    } catch (e) {
      console.warn(e)
      this.setData({ loading: false })
    }
  },

  async loadProgress(ids: string[]) {
    if (!ids.length) return
    const app = getApp() as any
    // 简化：直接拉全部进度（题量不大）
    try {
      const res = await api.getProgress({ skill: this.data.skill })
      if (!res.ok || !res.data) return
      const map: Record<string, string> = {}
      const skProg = (res.data.skills || [])[0]
      if (skProg) {
        // user_progress 没直接返回逐题，这里通过 wrongbook 反推：简化做法——打开题页时才查
      }
      this.setData({ progress: map })
    } catch (e) {
      console.warn(e)
    }
  },

  onReachBottom() {
    this.loadMore()
  },

  goQuestion(e: WechatMiniprogram.TouchEvent) {
    const { id, idx } = e.currentTarget.dataset
    const q = this.data.list[idx]
    wx.navigateTo({
      url: `/pages/question/question?skill=${this.data.skill}&level=${this.data.level}&questionId=${q.id}&idx=${idx}`,
    })
  },
})
