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

Linux 命令行（Shell）是**用文字与操作系统交互**的方式。比起图形界面，它能批量操作、远程管理、自动化脚本，是后端开发和运维的必备技能。

## 命令格式

一条命令通常形如：

\`\`\`
命令 [选项] [参数]
\`\`\`

以 \`ls -la /home\` 为例：
- \`ls\` **命令**：列出目录
- \`-la\` **选项**：修饰行为（-l 长格式，-a 显示隐藏文件）
- \`/home\` **参数**：操作对象（要列哪个目录）

## 选项的两种写法

- 短选项：\`-l\`、\`-a\`，可合并 \`-la\`
- 长选项：\`--all\`、\`--human-readable\`，更易读

很多命令两者都支持，如 \`ls -a\` 和 \`ls --all\` 等价。

## 常用快捷键

| 快捷键 | 作用 |
|---|---|
| \`Ctrl+C\` | 终止当前命令 |
| \`Ctrl+D\` | 发送 EOF（退出 shell） |
| \`Tab\` | 自动补全命令/路径 |
| \`↑\` \`↓\` | 翻历史命令 |
| \`Ctrl+R\` | 反向搜索历史 |
| \`Ctrl+L\` | 清屏 |

## 如何学命令

- \`man 命令\` 看完整手册，如 \`man ls\`
- \`命令 --help\` 看简要帮助
- 实操最重要——每个命令都试一试，看输出

本板块从文件操作讲到进程管理、网络、Shell 脚本，每个知识点都有练习题。`,
  },
  {
    id: 'linux-file',
    title: '文件与目录',
    content: `# 文件与目录操作

文件操作是 Linux 最基础也最常用的部分。掌握下面这几个命令能完成 90% 的日常工作。

## 核心命令

| 命令 | 作用 | 常用选项 |
|---|---|---|
| \`pwd\` | 显示当前目录绝对路径 | |
| \`ls\` | 列出目录内容 | \`-l\` 长格式，\`-a\` 含隐藏，\`-h\` 人类可读大小 |
| \`cd\` | 切换目录 | \`cd ~\` 主目录，\`cd -\` 上次目录，\`cd ..\` 上一级 |
| \`mkdir\` | 创建目录 | \`-p\` 递归创建父目录 |
| \`rmdir\` | 删除空目录 | |
| \`rm\` | 删除 | \`-r\` 递归，\`-f\` 强制（危险！） |
| \`cp\` | 复制 | \`-r\` 递归复制目录，\`-i\` 确认 |
| \`mv\` | 移动/重命名 | 同一目录下就是重命名 |
| \`touch\` | 创建空文件 | 也用于更新时间戳 |
| \`cat\` | 查看文件内容 | 适合小文件 |
| \`head\` / \`tail\` | 查看前/后几行 | \`-n N\` 指定行数，\`tail -f\` 实时跟踪 |

## 关键概念

- **隐藏文件**：以 \`.\` 开头的文件，\`ls\` 默认不显示，需 \`-a\`
- **路径**：\`/\` 开头是绝对路径，否则是相对路径；\`.\` 当前目录，\`..\` 上一级
- **\`~\`**：当前用户主目录的简写，\`cd ~\` = \`cd /home/用户名\`

## 危险命令警告

\`rm -rf /\` 会递归强制删除整个文件系统，**绝对不能在生产环境跑**。删之前一定确认路径，重要操作用 \`-i\` 让它每次确认。

## 常用组合

\`\`\`
ls -lah            # 详细列表 + 隐藏文件 + 人类可读
mkdir -p a/b/c     # 一次创建多层目录
cp -r src/ dst/    # 复制整个目录
tail -f log.txt    # 实时看日志（运维必备）
\`\`\``,
  },
  {
    id: 'linux-permission',
    title: '权限与所有者',
    content: `# 权限与所有者

Linux 是多用户系统，每个文件都有**权限**和**所有者**，控制谁能读、写、执行。

## 权限三组

每个文件分三组权限：
- **u**（user）：所有者
- **g**（group）：所属组
- **o**（other）：其他人

每组又有三种权限：
- **r**（read）= 4
- **w**（write）= 2
- **x**（execute）= 1

## 数字法

把每组 rwx 相加得到一个 0-7 的数字，三个数字组合：

\`\`\`
-rwxr-xr--  →  7 5 4
\`\`\`

- 7 = r+w+x = 4+2+1
- 5 = r+x = 4+1
- 4 = r = 4

常用组合：
- \`755\`：所有者全权，其他人可读可执行（脚本/目录常用）
- \`644\`：所有者可写，其他人只读（普通文件常用）
- \`600\`：仅所有者可读写（密钥文件）
- \`777\`：所有人全权（**极不安全**，慎用）

## 修改命令

| 命令 | 作用 | 例子 |
|---|---|---|
| \`chmod 755 file\` | 数字法改权限 | 一次设全三组 |
| \`chmod u+x file\` | 符号法 | 给所有者加执行权 |
| \`chmod g-w file\` | 符号法 | 去掉组的写权限 |
| \`chmod -R 755 dir\` | 递归改目录 | 含子文件 |
| \`chown user file\` | 改所有者 | |
| \`chown user:group file\` | 改所有者和组 | |

## 目录的 x 权限

目录的 x 不是"执行"，而是"**能否进入**"。没有 x 即使有 r 也不能 \`cd\` 进去，只能列出名字。

## 易错点

- 755 不是"七百五十五"，是三个独立数字 7、5、5
- 改权限用 chmod，改所有者用 chown，别混淆
- \`chmod 777\` 是安全大忌，几乎总有更合适的权限`,
  },
  {
    id: 'linux-text',
    title: '文本处理',
    content: `# 文本处理

Linux 文本处理能力极强，"三剑客" grep、sed、awk 配合管道能完成复杂的数据提取和转换。

## 三剑客

### grep —— 搜索

\`grep\` 按模式搜索文本，输出匹配的行。

\`\`\`
grep "TODO" file              # 找含 TODO 的行
grep -i error log.txt         # 忽略大小写
grep -rn "TODO" .             # 递归 + 行号，全目录搜
grep -v "^#" config           # 反向：不含 # 开头的行
grep -E "a|b" file            # 扩展正则，支持 | (...)
\`\`\`

### sed —— 流编辑

\`sed\` 对文本做替换、删除、插入，常用于批量改文件。

\`\`\`
sed 's/old/new/' file         # 每行替换第一个
sed 's/old/new/g' file        # 全局替换
sed -i 's/a/b/g' file         # 直接改文件（-i 原地）
sed '/^$/d' file              # 删除空行
\`\`\`

### awk —— 列处理

\`awk\` 按列处理文本，每行按分隔符拆分，\`$1\` \`$2\` 是各列。

\`\`\`
awk '{print $1}' file          # 打印第 1 列
awk -F, '{print $2}' csv       # 用逗号分隔
awk '$3 > 100' file            # 第 3 列大于 100 的行
awk '{sum += $1} END {print sum}' file   # 求和
\`\`\`

## 管道 |

\`|\` 把前一个命令的输出作为后一个的输入：

\`\`\`
cat log | grep ERROR | wc -l       # 统计错误行数
ps aux | grep nginx                # 找 nginx 进程
\`\`\`

## 其他常用

- \`head -n 10\` / \`tail -n 10\`：取前/后 N 行
- \`tail -f log\`：实时跟踪日志（运维神器）
- \`wc -l\`：统计行数；\`wc -w\` 词数；\`wc -c\` 字符数
- \`sort\`：排序，\`-n\` 数字序，\`-r\` 降序
- \`uniq\`：去重相邻重复行，常配合 sort：\`sort | uniq -c\` 排序去重计数
- \`cut -d, -f2\`：按分隔符取列
- \`tr 'a-z' 'A-Z'\`：转换字符

## 重定向

| 符号 | 作用 |
|---|---|
| \`>\` | 覆盖写入文件 |
| \`>>\` | 追加写入 |
| \`2>\` | 重定向错误 |
| \`2>&1\` | 错误合并到标准输出 |
| \`<\` | 从文件读入 |

\`cmd > out.log 2>&1\` 把正常输出和错误都写进日志，排查问题常用。`,
  },
  {
    id: 'linux-process',
    title: '进程与系统',
    content: `# 进程与系统

掌握进程和系统信息命令，才能定位"程序为什么卡""磁盘为什么满"这类问题。

## 查看进程

| 命令 | 作用 |
|---|---|
| \`ps aux\` | 所有进程快照（最常用） |
| \`ps -ef\` | 类似，显示父进程 |
| \`top\` / \`htop\` | 实时进程监控（按 q 退出） |
| \`pstree\` | 树状显示进程关系 |
| \`pgrep nginx\` | 按名查 PID |

\`ps aux | grep nginx\` 是日常找进程的标准操作。

## 终止进程

\`\`\`
kill PID             # 默认发 SIGTERM，优雅退出
kill -15 PID         # 同上（15 = SIGTERM）
kill -9 PID          # SIGKILL，强制杀（不可捕获，可能丢数据）
killall nginx        # 按名杀
pkill -f "python"    # 按命令行匹配杀
\`\`\`

**优先用 -15**，让程序自己清理；-9 是最后手段。

## 系统资源

| 命令 | 作用 |
|---|---|
| \`df -h\` | 磁盘使用（按文件系统） |
| \`du -sh .\` | 当前目录总大小 |
| \`du -sh *\` | 各子目录大小（找占用大户） |
| \`free -h\` | 内存使用 |
| \`top\` | CPU/内存综合 |
| \`uptime\` | 运行时间和平均负载 |
| \`uname -a\` | 内核版本等信息 |
| \`who\` / \`w\` | 谁登录了 |

## 负载是什么

\`uptime\` 显示的 load average 是**运行队列的平均长度**：
- 单核 CPU，1.0 表示满载；>1 表示有等待
- 4 核 CPU，4.0 才算满载
- 看是否超过"CPU 核数"判断是否过载

## 常见排查思路

1. 程序卡住 → \`ps\` 看进程，\`top\` 看 CPU/内存
2. 磁盘满 → \`df -h\` 看分区，\`du -sh *\` 找大户
3. 内存爆 → \`free -h\` 看剩余，\`top\` 找占用多的进程
4. 程序没启动 → \`ps\` 确认进程，\`journalctl\` 或日志看报错`,
  },
  {
    id: 'linux-network',
    title: '网络',
    content: `# 网络

网络命令用来测试连通、调试接口、排查端口占用，后端和运维天天用。

## 连通性测试

| 命令 | 作用 |
|---|---|
| \`ping host\` | 测试到目标是否通（ICMP） |
| \`traceroute host\` | 路由跟踪，看每一跳 |
| \`curl URL\` | 发 HTTP 请求 |
| \`wget URL\` | 下载文件 |
| \`telnet host port\` | 测试端口是否通 |
| \`nc -zv host port\` | 端口连通测试（新版） |

\`ping\` 不通不一定是网络断了——很多服务器禁 ICMP，得用 \`telnet\`/\`nc\` 测端口。

## HTTP 调试 curl

\`\`\`
curl URL                    # GET
curl -X POST URL -d 'a=1'   # POST
curl -H "Content-Type: application/json" -d '{"a":1}' URL
curl -i URL                 # 显示响应头
curl -v URL                 # 详细（含请求/响应全过程）
curl -o file URL            # 保存到文件
\`\`\`

curl 是接口调试神器，比 Postman 更轻量、可脚本化。

## 端口与连接

| 命令 | 作用 |
|---|---|
| \`netstat -tlnp\` | 查看监听端口（旧版） |
| \`ss -tlnp\` | 同上，新版更快 |
| \`lsof -i:8080\` | 谁占用了 8080 |

排查"端口被占用"：\`lsof -i:8080\` 或 \`ss -tlnp | grep 8080\`。

## 网络接口

- \`ip addr\` / \`ip a\`：查看网卡和 IP（新版）
- \`ifconfig\`：同上（旧版，部分系统已无）
- \`ip route\`：路由表
- \`hostname -I\`：本机 IP

## 远程操作

| 命令 | 作用 |
|---|---|
| \`ssh user@host\` | 远程登录 |
| \`ssh -p 2222 user@host\` | 指定端口 |
| \`scp file user@host:/path\` | 远程复制 |
| \`rsync -av src/ user@host:dst/\` | 增量同步（大文件快） |
| \`scp -r dir user@host:/path\` | 递归复制目录 |

## 易错点

- \`scp\` 源和目标顺序：\`scp 本地 远程\`，别搞反
- ssh 默认端口 22，改了要 \`-p\`
- curl 默认 GET，发 JSON 要加 \`-H "Content-Type: application/json"\``,
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
