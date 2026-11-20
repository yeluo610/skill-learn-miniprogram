/**
 * 小程序入口
 *
 * 板块定义直接内联在此，避免跨目录 import 导致的运行时模块解析问题。
 * 新增板块：在 SKILLS 数组里加一项，并在 data/skills 下加 checker（云函数端）。
 */
import type { Skill, SkillId, LevelConfig, TutorialSection } from './shared/types'
import { regexSkill } from './skills/regex'
import { jsonpathSkill } from './skills/jsonpath'
import { linuxSkill } from './skills/linux'
import { kubectlSkill } from './skills/kubectl'

/** ⚠️ 替换为你的云环境 ID */
const CLOUD_ENV = 'cloud1-d4gdcfzgf76bf95e7'

/** 已启用板块列表 */
const SKILLS: Skill[] = [regexSkill, jsonpathSkill, linuxSkill, kubectlSkill]

App({
  globalData: {
    cloudEnv: CLOUD_ENV,
    openid: '' as string,
    nickname: '' as string,
    avatarUrl: '' as string,
    skills: SKILLS,
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      return
    }
    wx.cloud.init({
      env: CLOUD_ENV,
      traceUser: true,
    })
    // 尝试静默登录
    this.silentLogin()
  },

  /** 静默登录：拿 openid，不强制弹窗 */
  silentLogin() {
    wx.cloud.callFunction({
      name: 'login',
      data: {},
      success: (res) => {
        const r = res.result as { openid?: string; nickname?: string }
        if (r?.openid) {
          this.globalData.openid = r.openid
          this.globalData.nickname = r.nickname || ''
          this.emit('login', r)
        }
      },
      fail: (err) => {
        console.warn('静默登录失败', err)
      },
    })
  },

  // 简易事件总线
  _listeners: {} as Record<string, Array<(data: unknown) => void>>,
  on(evt: string, cb: (data: unknown) => void) {
    ;(this._listeners[evt] ||= []).push(cb)
  },
  off(evt: string, cb: (data: unknown) => void) {
    const arr = this._listeners[evt]
    if (arr) this._listeners[evt] = arr.filter((c) => c !== cb)
  },
  emit(evt: string, data: unknown) {
    ;(this._listeners[evt] || []).forEach((cb) => cb(data))
  },
})

export {}
