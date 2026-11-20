/**
 * Linux 板块（单文件：checker + tutorial + 元数据）
 *
 * 填空题校验说明：
 * 由于小程序无法真正执行 Linux 命令，采用「命令归一化匹配」——
 * 把用户输入与标准答案都做 trim、合并多余空白、统一大小写后比较。
 * 支持多个等价答案：testCases[i].expected 可为数组，任一匹配即通过。
 */
import type { Skill, CheckResult, TestCase, TutorialSection } from '../shared/types'
import { buildResult, toExpectedArray } from '../shared/utils'

/** 归一化命令字符串：trim、合并连续空白、统一为单空格 */
function normalize(cmd: string): string {
  return cmd.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function linuxChecker(
  userInput: string,
  testCases: TestCase[]
): CheckResult {
  const details = testCases.map((tc) => {
    const expArr = toExpectedArray(tc.expected)
    const got = normalize(userInput)
    const expList = expArr.map(normalize)
    const pass = expList.includes(got)
    return {
      pass,
      got: userInput.trim(),
      expected: expArr.join(' | '),
    }
  })
  return buildResult(details)
}

export const linuxTutorial: TutorialSection[] = [
  {
    id: 'linux-intro',
    title: 'Linux 命令行简介',
    content: `# Linux 命令行

Linux 命令行（Shell）是与操作系统交互的主要方式。命令通常形如：

\`\`\`
命令 [选项] [参数]
\`\`\`

例如 \`ls -la /home\`：
- \`ls\` 命令
- \`-la\` 选项（长格式 + 显示隐藏文件）
- \`/home\` 参数（目标目录）

## 常用快捷键
- \`Ctrl+C\` 终止当前命令
- \`Tab\` 自动补全
- \`↑/↓\` 翻历史命令`,
  },
  {
    id: 'linux-file',
    title: '文件与目录',
    content: `# 文件与目录操作

| 命令 | 作用 |
|---|---|
| \`ls\` | 列出目录 |
| \`cd\` | 切换目录 |
| \`pwd\` | 显示当前目录 |
| \`mkdir\` | 创建目录 |
| \`rm\` | 删除 |
| \`cp\` | 复制 |
| \`mv\` | 移动/重命名 |
| \`touch\` | 创建空文件 |
| \`cat\` | 查看文件内容 |

\`rm -rf dir\` 递归强制删除（危险！）。`,
  },
  {
    id: 'linux-permission',
    title: '权限与所有者',
    content: `# 权限

权限分三组：所有者(u)、组(g)、其他(o)，每组 rwx。

\`\`\`
-rwxr-xr--  → 754
\`\`\`

- \`chmod 755 file\` 数字法
- \`chmod u+x file\` 符号法
- \`chown user:group file\` 改所有者

r=4, w=2, x=1，相加得数字。`,
  },
  {
    id: 'linux-text',
    title: '文本处理',
    content: `# 文本处理三剑客

- \`grep\` 搜索：\`grep -rn "TODO" .\`
- \`sed\` 替换：\`sed 's/old/new/g' file\`
- \`awk\` 列处理：\`awk '{print $1}' file\`

其他：
- \`head -n 10 file\` 前 10 行
- \`tail -f log\` 实时跟踪
- \`wc -l file\` 统计行数
- \`sort | uniq -c\` 排序去重计数`,
  },
  {
    id: 'linux-process',
    title: '进程与系统',
    content: `# 进程与系统

| 命令 | 作用 |
|---|---|
| \`ps aux\` | 查看所有进程 |
| \`top\` / \`htop\` | 实时进程 |
| \`kill -9 PID\` | 强制杀进程 |
| \`df -h\` | 磁盘使用 |
| \`du -sh .\` | 目录大小 |
| \`free -h\` | 内存 |
| \`uname -a\` | 系统信息 |

管道 \`|\` 把前一个命令的输出作为后一个的输入。`,
  },
  {
    id: 'linux-network',
    title: '网络',
    content: `# 网络

- \`ping host\` 测试连通
- \`curl URL\` 请求
- \`wget URL\` 下载
- \`netstat -tlnp\` 查看端口
- \`ss -tlnp\` 新版端口查看
- \`ifconfig\` / \`ip addr\` 网卡
- \`scp file user@host:/path\` 远程复制
- \`ssh user@host\` 远程登录`,
  },
]

export const linuxSkill: Skill = {
  id: 'linux',
  name: 'Linux 命令',
  icon: '/assets/icons/linux.svg',
  desc: '从文件操作到进程管理，掌握 Linux 命令行',
  levels: [
    { id: 'low', name: '初级', desc: '文件、目录、基础命令', count: 80 },
    { id: 'mid', name: '中级', desc: '权限、文本处理、管道', count: 80 },
    { id: 'high', name: '高级', desc: '进程、网络、Shell 脚本', count: 80 },
    { id: 'top', name: '顶级', desc: '系统管理、排障、性能', count: 80 },
  ],
  checker: linuxChecker,
  tutorial: linuxTutorial,
  enabled: true,
}
