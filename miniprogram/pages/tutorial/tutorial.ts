/**
 * 交互式教程
 */
import { parseMarkdown, MdBlock } from '../../utils/markdown'

Page({
  data: {
    skill: '',
    sections: [] as any[],
    currentIdx: 0,
    current: null as any,
    blocks: [] as MdBlock[],
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
    })
    this.showSection(0)
    wx.setNavigationBarTitle({ title: `${skillDef?.name || ''}教程` })
  },

  showSection(idx: number) {
    const current = this.data.sections[idx]
    if (!current) return
    const blocks = parseMarkdown(current.content || '')
    this.setData({ currentIdx: idx, current, blocks })
  },

  selectSection(e: WechatMiniprogram.TouchEvent) {
    const idx = Number(e.currentTarget.dataset.idx)
    this.showSection(idx)
  },

  prev() {
    if (this.data.currentIdx > 0) this.showSection(this.data.currentIdx - 1)
  },

  next() {
    if (this.data.currentIdx < this.data.sections.length - 1) this.showSection(this.data.currentIdx + 1)
  },
})
