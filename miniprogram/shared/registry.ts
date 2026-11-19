/**
 * 板块注册中心
 * 新增板块只需在此注册，前端自动出现入口
 */
import type { Skill, SkillId } from './types'
import { regexSkill } from '../skills/regex'
import { jsonpathSkill } from '../skills/jsonpath'
// 二期
// import { linuxSkill } from '../skills/linux'
// import { kubectlSkill } from '../skills/kubectl'

const registry: Record<SkillId, Skill> = {
  regex: regexSkill,
  jsonpath: jsonpathSkill,
  // linux: linuxSkill,
  // kubectl: kubectlSkill,
}

/** 获取已启用的板块列表（首页展示） */
export function listSkills(): Skill[] {
  return Object.values(registry).filter((s) => s.enabled)
}

/** 获取单个板块 */
export function getSkill(id: SkillId): Skill | undefined {
  return registry[id]
}

export { registry }
