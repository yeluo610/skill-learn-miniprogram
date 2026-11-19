/**
 * 简易 Markdown 解析器（小程序版）
 * 支持：标题 #、代码块 ```、行内代码 `、粗体 **、列表 - 、表格 | |、分隔线 ---
 * 返回 rich-text 可用的 nodes 结构，或分块 wxml 数据
 *
 * 这里采用"分块"方案：返回块数组，wxml 用 wx:for 渲染不同类型块，
 * 比 rich-text 更可控、样式更好。
 */

export type MdBlock =
  | { type: 'h1'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'p'; text: string }
  | { type: 'code'; lang: string; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'table'; header: string[]; rows: string[][] }
  | { type: 'hr' }

/** 解析行内：粗体 + 行内代码 */
function parseInline(text: string): string {
  // 粗体 **xxx** → 直接保留文本（小程序暂不支持富文本，保留内容即可）
  // 行内代码 `xxx` → 保留内容
  return text
}

export function parseMarkdown(md: string): MdBlock[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const blocks: MdBlock[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // 代码块
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim()
      const code: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        code.push(lines[i])
        i++
      }
      i++ // 跳过结束 ```
      blocks.push({ type: 'code', lang, text: code.join('\n') })
      continue
    }

    // 空行
    if (line.trim() === '') {
      i++
      continue
    }

    // 标题
    const h = /^(#{1,6})\s+(.*)$/.exec(line)
    if (h) {
      const level = h[1].length
      const text = parseInline(h[2])
      if (level === 1) blocks.push({ type: 'h1', text })
      else if (level === 2) blocks.push({ type: 'h2', text })
      else blocks.push({ type: 'h3', text })
      i++
      continue
    }

    // 分隔线
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      blocks.push({ type: 'hr' })
      i++
      continue
    }

    // 表格（下一行是分隔行 |---|）
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[\s\-:|]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const header = line.split('|').map((s) => s.trim()).filter((s) => s !== '')
      i += 2 // 跳过分隔行
      const rows: string[][] = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        const cells = lines[i].split('|').map((s) => s.trim()).filter((s) => s !== '')
        rows.push(cells)
        i++
      }
      blocks.push({ type: 'table', header, rows })
      continue
    }

    // 无序列表
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(parseInline(lines[i].replace(/^\s*[-*]\s+/, '')))
        i++
      }
      blocks.push({ type: 'ul', items })
      continue
    }

    // 有序列表
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(parseInline(lines[i].replace(/^\s*\d+\.\s+/, '')))
        i++
      }
      blocks.push({ type: 'ol', items })
      continue
    }

    // 普通段落
    blocks.push({ type: 'p', text: parseInline(line) })
    i++
  }
  return blocks
}
