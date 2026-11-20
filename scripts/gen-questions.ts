/**
 * 题库批量生成器
 *
 * 把 data/<skill>/<level>.json 中已有题目的 id 收集起来，
 * 按每阶段补足到 80 题，生成新题追加写入文件。
 *
 * 设计原则：
 * - 选择题有 4 个选项 + 解析
 * - 填空题有 testCases + referenceAnswer + 解析
 * - 题目围绕该阶段知识点的不同切面，避免重复
 *
 * 用法：npx tsx scripts/gen-questions.ts
 */
import * as fs from 'fs'
import * as path from 'path'

const TARGET_PER_LEVEL = 80

interface Q {
  id: string
  skill: string
  level: string
  type: 'choice' | 'fill'
  title: string
  content?: string
  options?: string[]
  answer?: number
  testCases?: any[]
  hint?: string
  explanation: string
  referenceAnswer?: string
  tags?: string[]
}

function load(file: string): Q[] {
  if (!fs.existsSync(file)) return []
  return JSON.parse(fs.readFileSync(file, 'utf-8'))
}

function save(file: string, arr: Q[]) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(arr, null, 2) + '\n', 'utf-8')
}

function nextId(existing: Q[], skill: string, level: string): string {
  let n = existing.length + 1
  let id = `${skill}-${level}-${String(n).padStart(3, '0')}`
  const ids = new Set(existing.map((q) => q.id))
  while (ids.has(id)) {
    n++
    id = `${skill}-${level}-${String(n).padStart(3, '0')}`
  }
  return id
}

// ============ 正则题生成 ============
const RE_TOPICS = {
  low: [
    { t: '字符类 \\d', exp: '\\d 等价于 [0-9]，匹配单个数字字符。\\D 匹配非数字。' },
    { t: '字符类 \\w', exp: '\\w 匹配单词字符 [A-Za-z0-9_]，\\W 匹配非单词字符。' },
    { t: '字符类 \\s', exp: '\\s 匹配空白字符（空格、制表、换行等），\\S 匹配非空白。' },
    { t: '点号 .', exp: '. 匹配除换行外的任意单个字符。' },
    { t: '锚点 ^', exp: '^ 匹配字符串开头位置。' },
    { t: '锚点 $', exp: '$ 匹配字符串结尾位置。' },
    { t: '量词 *', exp: '* 表示前面的元素出现 0 次或多次。' },
    { t: '量词 +', exp: '+ 表示前面的元素出现 1 次或多次，等价于 {1,}。' },
    { t: '量词 ?', exp: '? 表示前面的元素出现 0 次或 1 次。' },
    { t: '字符类 []', exp: '[abc] 匹配 a、b、c 中任意一个字符。' },
  ],
  mid: [
    { t: '分组 ()', exp: '() 创建捕获分组，可用反向引用 \\1 引用。' },
    { t: '非捕获分组', exp: '(?:...) 创建非捕获分组，不保存匹配结果。' },
    { t: '反向引用', exp: '\\1 引用第一个捕获分组匹配的内容。' },
    { t: '替换', exp: '替换中 $1 引用第一个捕获分组。' },
    { t: '量词 {n}', exp: '{n} 表示恰好 n 次。' },
    { t: '量词 {n,m}', exp: '{n,m} 表示 n 到 m 次。' },
    { t: '贪婪与惰性', exp: '默认贪婪，加 ? 变惰性（最少匹配）。' },
    { t: '字符类取反', exp: '[^abc] 匹配非 a、b、c 的任意字符。' },
  ],
  high: [
    { t: '顺序肯定环视', exp: '(?=...) 顺序肯定环视，匹配后面是 ... 的位置。' },
    { t: '顺序否定环视', exp: '(?!...) 顺序否定环视，匹配后面不是 ... 的位置。' },
    { t: '逆序肯定环视', exp: '(?<=...) 逆序肯定环视，匹配前面是 ... 的位置。' },
    { t: '逆序否定环视', exp: '(?<!...) 逆序否定环视，匹配前面不是 ... 的位置。' },
    { t: '命名分组', exp: '(?<name>...) 命名分组，用 \\k<name> 引用。' },
    { t: '回溯陷阱', exp: '贪婪量词 + 多个 .* 会导致大量回溯，性能差。' },
  ],
  top: [
    { t: '回溯灾难', exp: '嵌套量词 (a+)+ 在特定输入下会产生指数级回溯。' },
    { t: '原子分组', exp: '(?>...) 原子分组禁止回溯，提升性能但可能改变语义。' },
    { t: 'Unicode 属性', exp: '\\p{L} 匹配字母类，需 u 标志。' },
    { t: '条件表达式', exp: '(?(1)yes|no) 根据分组是否匹配选择分支。' },
    { t: '性能优化', exp: '用具体字符类替代 . ，减少回溯。' },
  ],
}

function genRegex(level: string): { choice: Q[]; fill: Q[] } {
  const choice: Q[] = []
  const fill: Q[] = []
  const topics = RE_TOPICS[level]

  // 选择题模板：每个 topic 生成若干变体
  topics.forEach((topic, ti) => {
    // 变体1：定义题
    choice.push({
      id: '',
      skill: 'regex',
      level,
      type: 'choice',
      title: `关于正则「${topic.t}」，下列说法正确的是？`,
      options: [
        topic.exp,
        '匹配固定字符串 abc',
        '只能用于 JavaScript',
        '必须配合 g 标志使用',
      ],
      answer: 0,
      explanation: topic.exp,
      tags: ['正则', topic.t],
    })
  })

  // 填空题：为每个 topic 生成 1-2 个填空题
  if (level === 'low') {
    fill.push({
      id: '', skill: 'regex', level, type: 'fill',
      title: '写一个正则，从 "abc123def456" 中匹配出所有数字片段。',
      hint: '用 \\d+ 匹配连续数字',
      testCases: [
        { input: 'abc123def456', expected: ['123', '456'] },
        { input: 'no digits here', expected: [], expectedType: 'nomatch' },
      ],
      referenceAnswer: '/\\d+/g',
      explanation: '\\d 匹配数字，+ 表示 1 次或多次，g 标志全局匹配。',
      tags: ['字符类', '量词'],
    })
    fill.push({
      id: '', skill: 'regex', level, type: 'fill',
      title: '写一个正则，匹配字符串 "hello world" 中的所有小写字母。',
      testCases: [
        { input: 'hello world', expected: ['h','e','l','l','o','w','o','r','l','d'] },
      ],
      referenceAnswer: '/[a-z]/g',
      explanation: '[a-z] 匹配任意小写字母，g 全局匹配。',
      tags: ['字符类'],
    })
    fill.push({
      id: '', skill: 'regex', level, type: 'fill',
      title: '写一个正则，判断字符串是否以 "Hello" 开头（匹配到即视为正确）。',
      testCases: [
        { input: 'Hello world', expected: 'Hello' },
        { input: 'Say Hello', expected: [], expectedType: 'nomatch' },
      ],
      referenceAnswer: '/^Hello/',
      explanation: '^ 锚定开头，Hello 匹配字面量。',
      tags: ['锚点'],
    })
    fill.push({
      id: '', skill: 'regex', level, type: 'fill',
      title: '写一个正则，从 "a1 b2 c3" 中匹配出字母+数字的组合。',
      testCases: [
        { input: 'a1 b2 c3', expected: ['a1', 'b2', 'c3'] },
      ],
      referenceAnswer: '/[a-z]\\d/g',
      explanation: '[a-z] 匹配字母，\\d 匹配数字，组合即字母+数字。',
      tags: ['字符类'],
    })
    fill.push({
      id: '', skill: 'regex', level, type: 'fill',
      title: '写一个正则，匹配 "color colour" 中的两种写法。',
      testCases: [
        { input: 'color colour', expected: ['color', 'colour'] },
      ],
      referenceAnswer: '/colou?r/g',
      explanation: 'u? 表示 u 出现 0 或 1 次，可匹配 color 和 colour。',
      tags: ['量词'],
    })
    fill.push({
      id: '', skill: 'regex', level, type: 'fill',
      title: '写一个正则，从 "100 200 300" 中匹配出所有数字。',
      testCases: [
        { input: '100 200 300', expected: ['100', '200', '300'] },
      ],
      referenceAnswer: '/\\d+/g',
      explanation: '\\d+ 匹配连续数字，g 全局匹配。',
      tags: ['量词'],
    })
  }

  if (level === 'mid') {
    fill.push({
      id: '', skill: 'regex', level, type: 'fill',
      title: '写一个正则，匹配 "hello hello world" 中重复的单词。',
      testCases: [
        { input: 'hello hello world', expected: ['hello hello'] },
        { input: 'no repeat here', expected: [], expectedType: 'nomatch' },
      ],
      referenceAnswer: '/(\\w+)\\s\\1/g',
      explanation: '(\\w+) 捕获单词，\\s 匹配空格，\\1 反向引用第一个分组。',
      tags: ['分组', '反向引用'],
    })
    fill.push({
      id: '', skill: 'regex', level, type: 'fill',
      title: '写一个正则，匹配 3 位数字。',
      testCases: [
        { input: 'a123b456', expected: ['123', '456'] },
        { input: '12', expected: [], expectedType: 'nomatch' },
      ],
      referenceAnswer: '/\\d{3}/g',
      explanation: '{3} 表示恰好 3 次。',
      tags: ['量词'],
    })
    fill.push({
      id: '', skill: 'regex', level, type: 'fill',
      title: '写一个正则，匹配 2 到 4 位数字。',
      testCases: [
        { input: 'a1 a22 a333 a4444 a55555', expected: ['22', '333', '4444', '5555'] },
      ],
      referenceAnswer: '/\\d{2,4}/g',
      explanation: '{2,4} 表示 2 到 4 次（贪婪，55555 会匹配前 4 位）。',
      tags: ['量词'],
    })
    fill.push({
      id: '', skill: 'regex', level, type: 'fill',
      title: '写一个正则，匹配 "2024-01-15" 形式的日期。',
      testCases: [
        { input: '2024-01-15', expected: '2024-01-15', expectedType: 'equal' },
        { input: 'not a date', expected: [], expectedType: 'nomatch' },
      ],
      referenceAnswer: '/\\d{4}-\\d{2}-\\d{2}/',
      explanation: '用 {n} 限定各段位数。',
      tags: ['量词'],
    })
    fill.push({
      id: '', skill: 'regex', level, type: 'fill',
      title: '写一个正则，匹配非数字字符（从 "a1b2" 中匹配 a、b）。',
      testCases: [
        { input: 'a1b2', expected: ['a', 'b'] },
      ],
      referenceAnswer: '/[^\\d]/g',
      explanation: '[^\\d] 取反，匹配非数字字符。',
      tags: ['字符类取反'],
    })
  }

  if (level === 'high') {
    fill.push({
      id: '', skill: 'regex', level, type: 'fill',
      title: '写一个正则，匹配后面跟着"元"的数字（如 "100元" 中的 100）。',
      testCases: [
        { input: '100元 200块 300元', expected: ['100', '300'] },
      ],
      referenceAnswer: '/\\d+(?=元)/g',
      explanation: '(?=元) 顺序肯定环视，匹配后面是"元"的位置。',
      tags: ['环视'],
    })
    fill.push({
      id: '', skill: 'regex', level, type: 'fill',
      title: '写一个正则，匹配不以数字开头的单词。',
      testCases: [
        { input: 'abc 1de f2g', expected: ['abc'] },
      ],
      referenceAnswer: '/^(?!\\d)\\w+/g',
      explanation: '(?!\\d) 顺序否定环视，后面不能是数字开头。',
      tags: ['环视'],
    })
    fill.push({
      id: '', skill: 'regex', level, type: 'fill',
      title: '写一个正则，匹配前面是 $ 符号的数字（如 "$100" 中的 100）。',
      testCases: [
        { input: '$100 and 200', expected: ['100'] },
      ],
      referenceAnswer: '/(?<=\\$)\\d+/g',
      explanation: '(?<=\\$) 逆序肯定环视，前面是 $。',
      tags: ['环视'],
    })
    fill.push({
      id: '', skill: 'regex', level, type: 'fill',
      title: '写一个正则，匹配前面不是空格的字母（从 "a b c" 中匹配 a，不匹配 b、c）。',
      testCases: [
        { input: 'a b c', expected: ['a'] },
      ],
      referenceAnswer: '/(?<!\\s)[a-z]/g',
      explanation: '(?<!\\s) 逆序否定环视，前面不是空白。',
      tags: ['环视'],
    })
  }

  if (level === 'top') {
    fill.push({
      id: '', skill: 'regex', level, type: 'fill',
      title: '写一个正则，优化版：用 [^,] 替代 . 匹配 CSV 中逗号间的字段。从 "a,b,c" 匹配字段。',
      testCases: [
        { input: 'a,b,c', expected: ['a', 'b', 'c'] },
      ],
      referenceAnswer: '/[^,]+/g',
      explanation: '用具体字符类 [^,] 替代 .，减少回溯，性能更好。',
      tags: ['性能'],
    })
    fill.push({
      id: '', skill: 'regex', level, type: 'fill',
      title: '写一个正则，匹配 Unicode 字母（如中文、英文）。从 "你好 world 123" 匹配字母。',
      testCases: [
        { input: '你好 world 123', expected: ['你好', 'world'] },
      ],
      referenceAnswer: '/\\p{L}+/gu',
      explanation: '\\p{L} 匹配任意 Unicode 字母，需 u 标志。',
      tags: ['Unicode'],
    })
  }

  return { choice, fill }
}

// ============ JSONPath 题生成 ============
function genJsonpath(level: string): { choice: Q[]; fill: Q[] } {
  const choice: Q[] = []
  const fill: Q[] = []

  const topics = {
    low: [
      { t: '根 $', exp: '$ 表示根对象。' },
      { t: '点号 .', exp: '. 访问子字段，如 $.a。' },
      { t: '下标 [n]', exp: '[n] 访问数组第 n 个元素。' },
      { t: '下标 [-1]', exp: '[-1] 访问数组最后一个元素。' },
      { t: '括号 [\'a\']', exp: "$['a'] 等价于 $.a，用于含特殊字符的字段名。" },
    ],
    mid: [
      { t: '通配符 [*]', exp: '[*] 选取数组所有元素。' },
      { t: '通配符 .*', exp: '.* 选取对象所有字段值。' },
      { t: '切片 [1:3]', exp: '[1:3] 选取下标 1、2 的元素。' },
      { t: '过滤 [?(...)]', exp: '[?(expr)] 按表达式过滤数组。' },
      { t: '当前元素 @', exp: '@ 在过滤表达式中代表当前元素。' },
    ],
    high: [
      { t: '递归 ..', exp: '.. 从当前位置递归查找所有层级。' },
      { t: '脚本表达式', exp: '部分实现支持 (script) 脚本表达式。' },
      { t: '多选 [a,b]', exp: "['a','b'] 同时选取多个字段。" },
      { t: '组合表达式', exp: '$..book[0].title 与 $..price 组合查询。' },
    ],
    top: [
      { t: '过滤陷阱', exp: '过滤表达式中 @ 与 $ 的区别。' },
      { t: '切片步长', exp: '[::2] 步长切片。' },
      { t: '空结果', exp: '不存在的字段返回空数组而非报错。' },
    ],
  }

  topics[level].forEach((topic) => {
    choice.push({
      id: '', skill: 'jsonpath', level, type: 'choice',
      title: `关于 JSONPath「${topic.t}」，下列正确的是？`,
      options: [topic.exp, '只能用于 XML', '必须大写', '不能嵌套'],
      answer: 0,
      explanation: topic.exp,
      tags: ['JSONPath', topic.t],
    })
  })

  const json1 = '{"a":1,"b":2,"c":3}'
  const json2 = '{"store":{"book":[{"title":"A","price":10},{"title":"B","price":20}]}}'
  const json3 = '{"list":[10,20,30,40,50]}'

  if (level === 'low') {
    fill.push({
      id: '', skill: 'jsonpath', level, type: 'fill',
      title: `写一个 JSONPath，取 ${json1} 中 a 字段的值。`,
      testCases: [{ input: json1, expected: ['1'] }],
      referenceAnswer: '$.a',
      explanation: '$.a 取根下 a 字段。',
      tags: ['基础访问'],
    })
    fill.push({
      id: '', skill: 'jsonpath', level, type: 'fill',
      title: `写一个 JSONPath，取 ${json3} 中第 0 个元素。`,
      testCases: [{ input: json3, expected: ['10'] }],
      referenceAnswer: '$.list[0]',
      explanation: '[0] 数组下标从 0 开始。',
      tags: ['下标'],
    })
    fill.push({
      id: '', skill: 'jsonpath', level, type: 'fill',
      title: `写一个 JSONPath，取 ${json3} 中最后一个元素。`,
      testCases: [{ input: json3, expected: ['50'] }],
      referenceAnswer: '$.list[-1]',
      explanation: '[-1] 表示最后一个元素。',
      tags: ['下标'],
    })
    fill.push({
      id: '', skill: 'jsonpath', level, type: 'fill',
      title: `写一个 JSONPath，取 ${json2} 中 store.book 的值。`,
      testCases: [{ input: json2, expected: ['[{"price":10,"title":"A"},{"price":20,"title":"B"}]'] }],
      referenceAnswer: '$.store.book',
      explanation: '点号链式访问嵌套字段。',
      tags: ['基础访问'],
    })
  }

  if (level === 'mid') {
    fill.push({
      id: '', skill: 'jsonpath', level, type: 'fill',
      title: `写一个 JSONPath，取 ${json3} 中所有元素。`,
      testCases: [{ input: json3, expected: ['10', '20', '30', '40', '50'] }],
      referenceAnswer: '$.list[*]',
      explanation: '[*] 选取数组所有元素。',
      tags: ['通配符'],
    })
    fill.push({
      id: '', skill: 'jsonpath', level, type: 'fill',
      title: `写一个 JSONPath，取 ${json3} 中下标 1、2 的元素。`,
      testCases: [{ input: json3, expected: ['20', '30'] }],
      referenceAnswer: '$.list[1:3]',
      explanation: '[1:3] 切片含头不含尾，取下标 1、2。',
      tags: ['切片'],
    })
    fill.push({
      id: '', skill: 'jsonpath', level, type: 'fill',
      title: `写一个 JSONPath，取 ${json2} 中 price 小于 15 的书的 title。`,
      testCases: [{ input: json2, expected: ['A'] }],
      referenceAnswer: '$.store.book[?(@.price<15)].title',
      explanation: '用 [?(@.price<15)] 过滤，再取 title。',
      tags: ['过滤'],
    })
  }

  if (level === 'high') {
    fill.push({
      id: '', skill: 'jsonpath', level, type: 'fill',
      title: `写一个 JSONPath，递归取 ${json2} 中所有 price。`,
      testCases: [{ input: json2, expected: ['10', '20'] }],
      referenceAnswer: '$..price',
      explanation: '.. 递归下降，找所有层级的 price。',
      tags: ['递归'],
    })
    fill.push({
      id: '', skill: 'jsonpath', level, type: 'fill',
      title: `写一个 JSONPath，递归取 ${json2} 中所有 title。`,
      testCases: [{ input: json2, expected: ['A', 'B'] }],
      referenceAnswer: '$..title',
      explanation: '.. 递归查找 title 字段。',
      tags: ['递归'],
    })
    fill.push({
      id: '', skill: 'jsonpath', level, type: 'fill',
      title: `写一个 JSONPath，同时取 ${json1} 中 a 和 b 的值。`,
      testCases: [{ input: json1, expected: ['1', '2'] }],
      referenceAnswer: "$['a','b']",
      explanation: "['a','b'] 多选字段。",
      tags: ['多选'],
    })
  }

  if (level === 'top') {
    fill.push({
      id: '', skill: 'jsonpath', level, type: 'fill',
      title: `写一个 JSONPath，取 ${json3} 中下标 0、2、4 的元素（步长切片）。`,
      testCases: [{ input: json3, expected: ['10', '30', '50'] }],
      referenceAnswer: '$.list[::2]',
      explanation: '[::2] 从头到尾步长 2。',
      tags: ['切片步长'],
    })
  }

  return { choice, fill }
}

// ============ Linux 题生成 ============
function genLinux(level: string): { choice: Q[]; fill: Q[] } {
  const choice: Q[] = []
  const fill: Q[] = []
  const topics = {
    low: [
      { q: '显示当前工作目录的命令是？', opts: ['pwd', 'cd', 'ls', 'dir'], a: 0, e: 'pwd (print working directory) 显示当前目录绝对路径。' },
      { q: '列出目录内容的命令是？', opts: ['ls', 'list', 'dir', 'show'], a: 0, e: 'ls 列出目录内容，-l 详细，-a 含隐藏文件。' },
      { q: '切换目录的命令是？', opts: ['cd', 'chdir', 'goto', 'move'], a: 0, e: 'cd (change directory) 切换工作目录。' },
      { q: '创建目录的命令是？', opts: ['mkdir', 'createdir', 'md', 'newdir'], a: 0, e: 'mkdir 创建目录，-p 递归创建父目录。' },
      { q: '创建空文件的命令是？', opts: ['touch', 'create', 'new', 'make'], a: 0, e: 'touch 创建空文件或更新文件时间戳。' },
      { q: '删除文件的命令是？', opts: ['rm', 'del', 'delete', 'remove'], a: 0, e: 'rm 删除文件，-r 递归，-f 强制。' },
      { q: '复制文件的命令是？', opts: ['cp', 'copy', 'duplicate', 'clone'], a: 0, e: 'cp 复制文件或目录，-r 递归复制目录。' },
      { q: '移动或重命名文件的命令是？', opts: ['mv', 'move', 'rename', 'cut'], a: 0, e: 'mv 移动或重命名文件。' },
      { q: '查看文件内容的命令是？', opts: ['cat', 'show', 'view', 'read'], a: 0, e: 'cat 输出文件全部内容，适合小文件。' },
      { q: '显示文件前几行的命令是？', opts: ['head', 'top', 'first', 'begin'], a: 0, e: 'head 默认显示前 10 行，-n N 指定行数。' },
      { q: '显示文件末尾几行的命令是？', opts: ['tail', 'bottom', 'last', 'end'], a: 0, e: 'tail 默认显示后 10 行，-f 实时跟踪。' },
      { q: 'ls -la 中 -l 的含义是？', opts: ['长格式', '链接', '本地', '列表'], a: 0, e: '-l 长格式，显示权限、所有者、大小等详细信息。' },
      { q: 'ls -a 中 -a 的含义是？', opts: ['所有文件', '追加', '归档', '绝对路径'], a: 0, e: '-a 显示包括 . 开头的隐藏文件。' },
      { q: 'cd ~ 的作用是？', opts: ['回到用户主目录', '上一级目录', '根目录', '当前目录'], a: 0, e: '~ 代表当前用户主目录。' },
      { q: 'cd - 的作用是？', opts: ['回到上一个工作目录', '后退一步', '根目录', '主目录'], a: 0, e: 'cd - 切换到上一个工作目录。' },
      { q: 'mkdir -p 的作用是？', opts: ['递归创建父目录', '打印', '权限', '粘贴'], a: 0, e: '-p 需要时创建父目录，已存在不报错。' },
      { q: 'rm -rf 中 -f 的含义是？', opts: ['强制', '递归', '文件', '快速'], a: 0, e: '-f 强制删除，不提示确认。' },
      { q: 'cp -r 的作用是？', opts: ['递归复制目录', '保留权限', '远程', '重命名'], a: 0, e: '-r 递归复制，用于复制目录。' },
      { q: '查看命令帮助的命令是？', opts: ['man', 'help', 'info', 'doc'], a: 0, e: 'man 显示命令手册页，如 man ls。' },
      { q: 'wc -l 的作用是？', opts: ['统计行数', '统计字数', '统计字符', '统计文件'], a: 0, e: 'wc -l 统计行数，-w 字数，-c 字符数。' },
    ],
    mid: [
      { q: '修改文件权限的命令是？', opts: ['chmod', 'chown', 'chperm', 'perm'], a: 0, e: 'chmod 修改权限，如 chmod 755 file。' },
      { q: '修改文件所有者的命令是？', opts: ['chown', 'chmod', 'chuser', 'owner'], a: 0, e: 'chown user:group file 修改所有者和组。' },
      { q: '权限 rwx 对应的数字是？', opts: ['7', '6', '5', '4'], a: 0, e: 'r=4, w=2, x=1，rwx=4+2+1=7。' },
      { q: '权限 r-x 对应的数字是？', opts: ['5', '7', '6', '4'], a: 0, e: 'r=4, x=1，r-x=5。' },
      { q: '搜索文本的命令是？', opts: ['grep', 'find', 'search', 'locate'], a: 0, e: 'grep 按内容搜索，如 grep "TODO" file。' },
      { q: '按文件名查找的命令是？', opts: ['find', 'grep', 'locate', 'search'], a: 0, e: 'find /path -name "*.txt" 按文件名查找。' },
      { q: '流编辑器替换文本的命令是？', opts: ['sed', 'awk', 'cut', 'tr'], a: 0, e: "sed 's/old/new/g' file 全局替换。" },
      { q: '列处理的命令是？', opts: ['awk', 'sed', 'grep', 'sort'], a: 0, e: "awk '{print $1}' file 按列处理。" },
      { q: '管道符 | 的作用是？', opts: ['前命令输出作后命令输入', '或运算', '重定向', '注释'], a: 0, e: '管道把前一个命令的标准输出连接到后一个命令的输入。' },
      { q: 'grep -i 的作用是？', opts: ['忽略大小写', '递归', '反向', '行号'], a: 0, e: '-i 忽略大小写。' },
      { q: 'grep -r 的作用是？', opts: ['递归搜索子目录', '反向', '行号', '正则'], a: 0, e: '-r 递归搜索目录下所有文件。' },
      { q: 'grep -v 的作用是？', opts: ['反向匹配', '递归', '忽略大小写', '行号'], a: 0, e: '-v 显示不匹配的行。' },
      { q: 'sort -u 的作用是？', opts: ['排序并去重', '升序', '降序', '唯一'], a: 0, e: '-u 排序后去重。' },
      { q: 'uniq 的作用是？', opts: ['去重相邻重复行', '唯一文件', '统计', '排序'], a: 0, e: 'uniq 去除相邻重复行，常与 sort 配合。' },
      { q: '输出重定向 > 的作用是？', opts: ['覆盖写入文件', '追加', '管道', '错误重定向'], a: 0, e: '> 覆盖写入文件，>> 追加。' },
      { q: '>> 的作用是？', opts: ['追加写入', '覆盖写入', '管道', '错误重定向'], a: 0, e: '>> 追加到文件末尾。' },
      { q: '2> 的作用是？', opts: ['重定向标准错误', '重定向标准输出', '追加', '管道'], a: 0, e: '2> 重定向标准错误（文件描述符 2）。' },
      { q: 'cut -d , -f 2 的作用是？', opts: ['以逗号分隔取第 2 段', '删除第 2 行', '复制第 2 列', '排序'], a: 0, e: '-d 指定分隔符，-f 指定字段。' },
      { q: 'tee 命令的作用是？', opts: ['同时输出到屏幕和文件', '排序', '过滤', '删除'], a: 0, e: 'tee 把 stdin 同时输出到文件和 stdout。' },
      { q: 'xargs 的作用是？', opts: ['把 stdin 作为参数传给命令', '执行多次', '等待', '排序'], a: 0, e: 'xargs 把标准输入转为命令参数。' },
    ],
    high: [
      { q: '查看所有进程的命令是？', opts: ['ps aux', 'ps', 'top', 'proc'], a: 0, e: 'ps aux 显示所有进程详细信息。' },
      { q: '实时查看进程的命令是？', opts: ['top', 'ps', 'proc', 'list'], a: 0, e: 'top 实时显示进程和资源占用。' },
      { q: '强制杀进程的信号是？', opts: ['kill -9', 'kill -1', 'kill -15', 'kill -2'], a: 0, e: '-9 SIGKILL 强制终止，不可被捕获。' },
      { q: '优雅终止进程的信号是？', opts: ['kill -15', 'kill -9', 'kill -19', 'kill -2'], a: 0, e: '-15 SIGTERM 优雅终止，可被程序捕获处理。' },
      { q: '查看磁盘使用情况的命令是？', opts: ['df -h', 'du', 'disk', 'free'], a: 0, e: 'df -h 查看文件系统磁盘使用，-h 人类可读。' },
      { q: '查看目录大小的命令是？', opts: ['du -sh', 'df', 'ls', 'size'], a: 0, e: 'du -sh dir 查看目录总大小。' },
      { q: '查看内存的命令是？', opts: ['free -h', 'mem', 'top', 'df'], a: 0, e: 'free -h 查看内存使用，-h 人类可读。' },
      { q: '查看系统信息的命令是？', opts: ['uname -a', 'sysinfo', 'info', 'os'], a: 0, e: 'uname -a 显示内核、主机名等系统信息。' },
      { q: '测试网络连通的命令是？', opts: ['ping', 'test', 'check', 'net'], a: 0, e: 'ping host 发送 ICMP 包测试连通性。' },
      { q: '发起 HTTP 请求的命令是？', opts: ['curl', 'http', 'request', 'get'], a: 0, e: 'curl URL 发起 HTTP 请求。' },
      { q: '下载文件的命令是？', opts: ['wget', 'get', 'download', 'fetch'], a: 0, e: 'wget URL 非交互式下载文件。' },
      { q: '查看端口监听的命令是？', opts: ['netstat -tlnp', 'ports', 'listen', 'sock'], a: 0, e: 'netstat -tlnp 查看 TCP 监听端口。' },
      { q: 'SSH 远程登录的命令是？', opts: ['ssh user@host', 'telnet', 'ftp', 'remote'], a: 0, e: 'ssh user@host 远程登录。' },
      { q: '安全复制文件的命令是？', opts: ['scp', 'cp', 'rcp', 'ftp'], a: 0, e: 'scp file user@host:/path 安全复制。' },
      { q: '查看网络接口的命令是？', opts: ['ip addr', 'netif', 'ifcfg', 'route'], a: 0, e: 'ip addr 查看网卡接口（新版）。' },
      { q: 'Shell 脚本第一行通常是？', opts: ['#!/bin/bash', '# bash', '//bin/bash', '/bin/bash'], a: 0, e: '#! 称为 shebang，指定解释器。' },
      { q: '脚本中变量引用用？', opts: ['$VAR', 'VAR', '&VAR', '*VAR'], a: 0, e: '$VAR 引用变量值，定义时不用 $。' },
      { q: '后台运行命令加？', opts: ['&', '@', '#', '*'], a: 0, e: '命令后加 & 放后台运行。' },
      { q: 'nohup 的作用是？', opts: ['忽略挂断信号', '不输出', '不暂停', '不占用'], a: 0, e: 'nohup 使命令在终端关闭后继续运行。' },
      { q: '查看命令历史用？', opts: ['history', 'hist', 'past', 'cmdlog'], a: 0, e: 'history 显示命令历史。' },
    ],
    top: [
      { q: '查看系统负载的命令是？', opts: ['uptime', 'load', 'top', 'free'], a: 0, e: 'uptime 显示运行时间和平均负载。' },
      { q: '查看打开文件的命令是？', opts: ['lsof', 'openfiles', 'files', 'fuser'], a: 0, e: 'lsof 列出打开的文件和进程。' },
      { q: '跟踪系统调用的命令是？', opts: ['strace', 'trace', 'sys', 'ptrace'], a: 0, e: 'strace 跟踪进程的系统调用。' },
      { q: '跟踪库调用的命令是？', opts: ['ltrace', 'libtrace', 'ldtrace', 'strace'], a: 0, e: 'ltrace 跟踪库函数调用。' },
      { q: '性能分析工具是？', opts: ['perf', 'prof', 'perfmon', 'bench'], a: 0, e: 'perf 是 Linux 性能分析工具。' },
      { q: '查看 IO 情况的命令是？', opts: ['iostat', 'iostat', 'io', 'diskstat'], a: 0, e: 'iostat 查看 IO 统计。' },
      { q: '查看 CPU 情况的命令是？', opts: ['mpstat', 'cpustat', 'cpu', 'top'], a: 0, e: 'mpstat 查看各 CPU 统计。' },
      { q: '查看进程资源用？', opts: ['pidstat', 'procstat', 'psstat', 'pstat'], a: 0, e: 'pidstat 查看进程资源使用。' },
      { q: '定时任务管理命令是？', opts: ['crontab', 'cron', 'schedule', 'timer'], a: 0, e: 'crontab -e 编辑定时任务。' },
      { q: 'crontab 中 * * * * * 含义？', opts: ['每分钟', '每小时', '每天', '每秒'], a: 0, e: '5 个字段：分 时 日 月 周，全 * 是每分钟。' },
      { q: 'systemctl 重启服务？', opts: ['systemctl restart svc', 'systemctl reload svc', 'systemctl start svc', 'systemctl stop svc'], a: 0, e: 'restart 重启服务。' },
      { q: '查看服务状态用？', opts: ['systemctl status svc', 'systemctl show svc', 'service svc', 'svc status'], a: 0, e: 'systemctl status 查看服务运行状态。' },
      { q: 'journalctl 查看日志用？', opts: ['journalctl -u svc', 'log svc', 'dmesg', 'syslog'], a: 0, e: 'journalctl -u 查看某服务日志。' },
      { q: 'tar 解压 .tar.gz？', opts: ['tar -xzf f.tar.gz', 'tar -czf f.tar.gz', 'tar -xf f.tar.gz', 'untar f.tar.gz'], a: 0, e: '-x 解压，-z gzip，-f 指定文件。' },
      { q: 'find 按大小查找？', opts: ['find . -size +1M', 'find . -big 1M', 'find . -s 1M', 'find . -1M'], a: 0, e: '-size +1M 找大于 1M 的文件。' },
      { q: 'find 按时间查找（修改）？', opts: ['find . -mtime -7', 'find . -time 7', 'find . -m 7', 'find . -age 7'], a: 0, e: '-mtime -7 表示 7 天内修改。' },
      { q: '环境变量 PATH 用？', opts: ['echo $PATH', 'echo PATH', 'print PATH', 'show PATH'], a: 0, e: '$PATH 引用环境变量。' },
      { q: 'export 的作用是？', opts: ['导出为环境变量', '导出文件', '退出', '执行'], a: 0, e: 'export 把变量设为环境变量，子进程可继承。' },
      { q: 'alias 的作用是？', opts: ['设置命令别名', '别名文件', '列表', '对齐'], a: 0, e: 'alias ll="ls -la" 设置别名。' },
      { q: '查看路由表用？', opts: ['ip route', 'route', 'routetable', 'paths'], a: 0, e: 'ip route 查看路由表（新版）。' },
    ],
  }

  topics[level].forEach((t) => {
    choice.push({
      id: '', skill: 'linux', level, type: 'choice',
      title: t.q, options: t.opts, answer: t.a, explanation: t.e, tags: ['Linux'],
    })
  })

  // 填空题
  if (level === 'low') {
    const fills = [
      { title: '写一条命令，显示当前工作目录。', ans: 'pwd', e: 'pwd 显示当前目录。' },
      { title: '写一条命令，列出当前目录所有文件（含隐藏文件）。', ans: 'ls -a', e: '-a 显示隐藏文件。' },
      { title: '写一条命令，以长格式列出目录内容。', ans: 'ls -l', e: '-l 长格式。' },
      { title: '写一条命令，回到用户主目录。', ans: 'cd ~', e: '~ 代表主目录。' },
      { title: '写一条命令，创建名为 test 的目录。', ans: 'mkdir test', e: 'mkdir 创建目录。' },
      { title: '写一条命令，创建空文件 a.txt。', ans: 'touch a.txt', e: 'touch 创建空文件。' },
      { title: '写一条命令，删除文件 a.txt。', ans: 'rm a.txt', e: 'rm 删除文件。' },
      { title: '写一条命令，递归删除目录 dir。', ans: 'rm -r dir', e: '-r 递归删除。' },
      { title: '写一条命令，复制文件 a.txt 为 b.txt。', ans: 'cp a.txt b.txt', e: 'cp 源 目标。' },
      { title: '写一条命令，重命名 a.txt 为 b.txt。', ans: 'mv a.txt b.txt', e: 'mv 移动/重命名。' },
      { title: '写一条命令，查看文件 a.txt 内容。', ans: 'cat a.txt', e: 'cat 输出文件内容。' },
      { title: '写一条命令，查看文件前 10 行。', ans: 'head -n 10 a.txt', e: 'head -n 指定行数。' },
    ]
    fills.forEach((f) => {
      fill.push({
        id: '', skill: 'linux', level, type: 'fill',
        title: f.title, testCases: [{ input: '', expected: f.ans }],
        referenceAnswer: f.ans, explanation: f.e, tags: ['Linux'],
      })
    })
  }
  if (level === 'mid') {
    const fills = [
      { title: '写一条命令，把文件权限改为 755。', ans: 'chmod 755 file', e: 'chmod 数字法改权限。' },
      { title: '写一条命令，给文件所有者加执行权限。', ans: 'chmod u+x file', e: 'u+x 符号法。' },
      { title: '写一条命令，把文件所有者改为 root。', ans: 'chown root file', e: 'chown 改所有者。' },
      { title: '写一条命令，在 file 中搜索 "TODO"。', ans: 'grep TODO file', e: 'grep 搜索文本。' },
      { title: '写一条命令，递归搜索目录中含 "TODO" 的行。', ans: 'grep -r TODO .', e: '-r 递归。' },
      { title: '写一条命令，忽略大小写搜索 "error"。', ans: 'grep -i error file', e: '-i 忽略大小写。' },
      { title: '写一条命令，把 file 中的 old 替换为 new。', ans: "sed 's/old/new/g' file", e: 'sed 替换。' },
      { title: '写一条命令，打印 file 的第 1 列。', ans: "awk '{print $1}' file", e: 'awk 列处理。' },
      { title: '写一条命令，对 file 排序并去重。', ans: 'sort file | uniq', e: 'sort 排序，uniq 去重。' },
      { title: '写一条命令，统计 file 的行数。', ans: 'wc -l file', e: 'wc -l 统计行数。' },
      { title: '写一条命令，把命令输出追加到 log.txt。', ans: 'cmd >> log.txt', e: '>> 追加重定向。' },
      { title: '写一条命令，把错误输出重定向到 err.txt。', ans: 'cmd 2> err.txt', e: '2> 重定向标准错误。' },
    ]
    fills.forEach((f) => {
      fill.push({
        id: '', skill: 'linux', level, type: 'fill',
        title: f.title, testCases: [{ input: '', expected: f.ans }],
        referenceAnswer: f.ans, explanation: f.e, tags: ['Linux'],
      })
    })
  }
  if (level === 'high') {
    const fills = [
      { title: '写一条命令，查看所有进程。', ans: 'ps aux', e: 'ps aux 查看所有进程。' },
      { title: '写一条命令，强制杀死 PID 1234。', ans: 'kill -9 1234', e: 'kill -9 强制终止。' },
      { title: '写一条命令，查看磁盘使用情况。', ans: 'df -h', e: 'df -h 磁盘使用。' },
      { title: '写一条命令，查看当前目录总大小。', ans: 'du -sh .', e: 'du -sh 目录大小。' },
      { title: '写一条命令，查看内存使用。', ans: 'free -h', e: 'free -h 内存。' },
      { title: '写一条命令，测试到 example.com 的连通。', ans: 'ping example.com', e: 'ping 测试连通。' },
      { title: '写一条命令，请求 http://example.com。', ans: 'curl http://example.com', e: 'curl 发起请求。' },
      { title: '写一条命令，远程登录 user@host。', ans: 'ssh user@host', e: 'ssh 远程登录。' },
      { title: '写一条命令，把本地 file 复制到远程 /tmp。', ans: 'scp file user@host:/tmp', e: 'scp 远程复制。' },
      { title: '写一条命令，查看 TCP 监听端口。', ans: 'netstat -tlnp', e: 'netstat -tlnp 查看端口。' },
      { title: '写一条命令，查看系统信息。', ans: 'uname -a', e: 'uname -a 系统信息。' },
      { title: '写一个 Shell 脚本第一行（指定 bash 解释器）。', ans: '#!/bin/bash', e: 'shebang 指定解释器。' },
    ]
    fills.forEach((f) => {
      fill.push({
        id: '', skill: 'linux', level, type: 'fill',
        title: f.title, testCases: [{ input: '', expected: f.ans }],
        referenceAnswer: f.ans, explanation: f.e, tags: ['Linux'],
      })
    })
  }
  if (level === 'top') {
    const fills = [
      { title: '写一条命令，查看系统负载。', ans: 'uptime', e: 'uptime 显示负载。' },
      { title: '写一条命令，编辑定时任务。', ans: 'crontab -e', e: 'crontab -e 编辑定时任务。' },
      { title: '写一条命令，重启 nginx 服务（systemd）。', ans: 'systemctl restart nginx', e: 'systemctl restart 重启。' },
      { title: '写一条命令，查看 nginx 服务状态。', ans: 'systemctl status nginx', e: 'systemctl status 状态。' },
      { title: '写一条命令，查看 nginx 服务日志。', ans: 'journalctl -u nginx', e: 'journalctl -u 服务日志。' },
      { title: '写一条命令，解压 f.tar.gz。', ans: 'tar -xzf f.tar.gz', e: 'tar -xzf 解压。' },
      { title: '写一条命令，查找大于 1M 的文件。', ans: 'find . -size +1M', e: 'find -size 按大小。' },
      { title: '写一条命令，查找 7 天内修改的文件。', ans: 'find . -mtime -7', e: 'find -mtime 按时间。' },
      { title: '写一条命令，查看当前 PATH 变量。', ans: 'echo $PATH', e: 'echo $PATH 查看 PATH。' },
      { title: '写一条命令，把 MYVAR 导出为环境变量。', ans: 'export MYVAR', e: 'export 导出环境变量。' },
      { title: '写一条命令，设置 ll 别名为 ls -la。', ans: 'alias ll="ls -la"', e: 'alias 设置别名。' },
      { title: '写一条命令，查看路由表。', ans: 'ip route', e: 'ip route 路由表。' },
    ]
    fills.forEach((f) => {
      fill.push({
        id: '', skill: 'linux', level, type: 'fill',
        title: f.title, testCases: [{ input: '', expected: f.ans }],
        referenceAnswer: f.ans, explanation: f.e, tags: ['Linux'],
      })
    })
  }

  return { choice, fill }
}

// ============ kubectl 题生成 ============
function genKubectl(level: string): { choice: Q[]; fill: Q[] } {
  const choice: Q[] = []
  const fill: Q[] = []
  const topics = {
    low: [
      { q: '列出 Pod 的命令是？', opts: ['kubectl get pods', 'kubectl pods', 'kubectl list pods', 'kubectl show pods'], a: 0, e: 'kubectl get pods 列出当前命名空间的 Pod。' },
      { q: '列出所有命名空间的 Pod 用？', opts: ['kubectl get pods -A', 'kubectl get pods --all', 'kubectl get pods -n all', 'kubectl get pods *'], a: 0, e: '-A 等价 --all-namespaces。' },
      { q: '查看 Pod 详情用？', opts: ['kubectl describe pod <name>', 'kubectl show pod <name>', 'kubectl inspect pod <name>', 'kubectl pod <name>'], a: 0, e: 'describe 显示资源详细事件和状态。' },
      { q: '以 YAML 查看资源用？', opts: ['kubectl get pod <name> -o yaml', 'kubectl yaml pod <name>', 'kubectl get pod <name> yaml', 'kubectl show yaml pod'], a: 0, e: '-o yaml 输出 YAML 格式。' },
      { q: '列出节点用？', opts: ['kubectl get nodes', 'kubectl nodes', 'kubectl get node', 'kubectl list nodes'], a: 0, e: 'kubectl get nodes 列出集群节点。' },
      { q: '列出 Deployment 用？', opts: ['kubectl get deploy', 'kubectl deployments', 'kubectl get deployments', 'kubectl list deploy'], a: 0, e: 'deploy 是 deployment 的简写。' },
      { q: '列出 Service 用？', opts: ['kubectl get svc', 'kubectl services', 'kubectl get services', 'kubectl list svc'], a: 0, e: 'svc 是 service 简写。' },
      { q: '查看宽格式信息用？', opts: ['-o wide', '-w', '--wide', '-W'], a: 0, e: '-o wide 显示节点、IP 等更多信息。' },
      { q: '指定命名空间用？', opts: ['-n <ns>', '--ns <ns>', '-N <ns>', '--namespace=<ns>'], a: 0, e: '-n 指定命名空间。' },
      { q: 'kubectl 命令格式是？', opts: ['kubectl <verb> <resource> [name] [flags]', 'kubectl <resource> <verb>', 'kubectl <name> <verb>', 'kubectl run <verb>'], a: 0, e: '动词 + 资源 + 名称 + 标志。' },
      { q: 'K8s 最小调度单元是？', opts: ['Pod', 'Container', 'Node', 'Deployment'], a: 0, e: 'Pod 是 K8s 最小调度单元，含一或多个容器。' },
      { q: '管理 Pod 副本的是？', opts: ['Deployment', 'Service', 'Node', 'ConfigMap'], a: 0, e: 'Deployment 管理 Pod 副本和滚动更新。' },
      { q: '提供稳定访问的是？', opts: ['Service', 'Pod', 'Volume', 'Label'], a: 0, e: 'Service 提供稳定的网络访问入口。' },
      { q: '逻辑隔离用？', opts: ['Namespace', 'Node', 'Pod', 'Volume'], a: 0, e: 'Namespace 用于逻辑隔离资源。' },
      { q: '查看集群信息用？', opts: ['kubectl cluster-info', 'kubectl info', 'kubectl cluster', 'kubectl status'], a: 0, e: 'kubectl cluster-info 显示控制平面地址。' },
      { q: '查看 K8s 版本用？', opts: ['kubectl version', 'kubectl ver', 'kubectl --version', 'kubectl k8s-version'], a: 0, e: 'kubectl version 显示客户端和服务端版本。' },
      { q: '查看节点资源用？', opts: ['kubectl top nodes', 'kubectl nodes top', 'kubectl stats nodes', 'kubectl node-stats'], a: 0, e: 'kubectl top nodes 查看 CPU/内存。' },
      { q: '查看 Pod 资源用？', opts: ['kubectl top pods', 'kubectl pods top', 'kubectl stats pods', 'kubectl pod-stats'], a: 0, e: 'kubectl top pods 查看 Pod 资源占用。' },
      { q: '获取所有资源简写帮助用？', opts: ['kubectl api-resources', 'kubectl resources', 'kubectl api', 'kubectl types'], a: 0, e: 'kubectl api-resources 列出资源及简写。' },
      { q: '查看事件用？', opts: ['kubectl get events', 'kubectl events', 'kubectl list events', 'kubectl show events'], a: 0, e: 'kubectl get events 查看集群事件。' },
    ],
    mid: [
      { q: '声明式应用配置用？', opts: ['kubectl apply -f f.yaml', 'kubectl create -f f.yaml', 'kubectl run -f f.yaml', 'kubectl set -f f.yaml'], a: 0, e: 'apply 声明式创建/更新，推荐。' },
      { q: '删除配置文件中的资源用？', opts: ['kubectl delete -f f.yaml', 'kubectl remove -f f.yaml', 'kubectl drop -f f.yaml', 'kubectl destroy -f f.yaml'], a: 0, e: 'delete -f 删除文件定义的资源。' },
      { q: '创建 Deployment 用？', opts: ['kubectl create deployment nginx --image=nginx', 'kubectl run deployment nginx', 'kubectl new deployment nginx', 'kubectl make deployment nginx'], a: 0, e: 'create deployment 命令式创建。' },
      { q: '扩缩容用？', opts: ['kubectl scale deployment nginx --replicas=3', 'kubectl resize deploy nginx 3', 'kubectl set deploy nginx 3', 'kubectl expand deploy nginx 3'], a: 0, e: 'scale --replicas 调整副本数。' },
      { q: '更新镜像用？', opts: ['kubectl set image deploy/nginx nginx=nginx:1.25', 'kubectl update image deploy nginx', 'kubectl change image nginx', 'kubectl image deploy/nginx nginx:1.25'], a: 0, e: 'set image 触发滚动更新。' },
      { q: '查看滚动状态用？', opts: ['kubectl rollout status deploy/nginx', 'kubectl rollout deploy nginx', 'kubectl status rollout nginx', 'kubectl rolling nginx'], a: 0, e: 'rollout status 查看发布进度。' },
      { q: '回滚用？', opts: ['kubectl rollout undo deploy/nginx', 'kubectl rollback deploy/nginx', 'kubectl undo deploy nginx', 'kubectl revert deploy/nginx'], a: 0, e: 'rollout undo 回滚到上一版本。' },
      { q: '查看发布历史用？', opts: ['kubectl rollout history deploy/nginx', 'kubectl history deploy nginx', 'kubectl rollout list nginx', 'kubectl revisions nginx'], a: 0, e: 'rollout history 查看历史版本。' },
      { q: '重启 Deployment 用？', opts: ['kubectl rollout restart deploy/nginx', 'kubectl restart deploy/nginx', 'kubectl reload deploy/nginx', 'kubectl reboot deploy/nginx'], a: 0, e: 'rollout restart 触发重启。' },
      { q: '查看 Pod 日志用？', opts: ['kubectl logs <pod>', 'kubectl cat <pod>', 'kubectl show logs <pod>', 'kubectl tail <pod>'], a: 0, e: 'kubectl logs 查看容器日志。' },
      { q: '跟踪日志用？', opts: ['kubectl logs -f <pod>', 'kubectl logs --tail <pod>', 'kubectl logs --follow <pod>', 'kubectl stream <pod>'], a: 0, e: '-f 跟踪日志输出。' },
      { q: '进入容器用？', opts: ['kubectl exec -it <pod> -- sh', 'kubectl ssh <pod>', 'kubectl enter <pod>', 'kubectl shell <pod>'], a: 0, e: 'exec -it 进入交互式终端。' },
      { q: '端口转发用？', opts: ['kubectl port-forward svc/web 8080:80', 'kubectl forward svc/web 8080', 'kubectl tunnel svc/web 8080:80', 'kubectl proxy svc/web 8080'], a: 0, e: 'port-forward 本地端口转发到 Pod。' },
      { q: '运行临时 Pod 用？', opts: ['kubectl run tmp --image=busybox --rm -it -- sh', 'kubectl pod tmp busybox', 'kubectl create tmp busybox', 'kubectl exec tmp busybox'], a: 0, e: 'run --rm -it 运行临时交互 Pod。' },
      { q: '暴露服务用？', opts: ['kubectl expose deployment nginx --port=80', 'kubectl service nginx 80', 'kubectl publish nginx 80', 'kubectl open nginx 80'], a: 0, e: 'expose 创建 Service 暴露 Deployment。' },
      { q: 'kubectl get 输出 JSON 用？', opts: ['-o json', '--json', '-j', '-O json'], a: 0, e: '-o json 输出 JSON 格式。' },
      { q: '查看 ConfigMap 用？', opts: ['kubectl get cm', 'kubectl get configmaps', 'kubectl get cfgmap', 'kubectl get configmap'], a: 0, e: 'cm 是 configmap 简写。' },
      { q: '查看 Secret 用？', opts: ['kubectl get secret', 'kubectl get secrets', 'kubectl get sec', 'kubectl get credentials'], a: 0, e: 'kubectl get secret 查看 Secret。' },
      { q: '查看标签用？', opts: ['kubectl get pods --show-labels', 'kubectl get pods -l', 'kubectl get pods labels', 'kubectl get pods --labels'], a: 0, e: '--show-labels 显示标签。' },
      { q: '按标签筛选用？', opts: ['kubectl get pods -l app=nginx', 'kubectl get pods --label app=nginx', 'kubectl get pods --filter app=nginx', 'kubectl get pods -L app=nginx'], a: 0, e: '-l 按标签选择器筛选。' },
    ],
    high: [
      { q: '给 Pod 打标签用？', opts: ['kubectl label pod <name> env=prod', 'kubectl tag pod <name> env=prod', 'kubectl setlabel pod <name> env=prod', 'kubectl mark pod <name> env=prod'], a: 0, e: 'label 命令打标签。' },
      { q: '添加注解用？', opts: ['kubectl annotate pod <name> x=y', 'kubectl note pod <name> x=y', 'kubectl comment pod <name> x=y', 'kubectl meta pod <name> x=y'], a: 0, e: 'annotate 添加注解。' },
      { q: '节点打污点用？', opts: ['kubectl taint node <n> key=value:NoSchedule', 'kubectl taint node <n> NoSchedule', 'kubectl node-taint <n> NoSchedule', 'kubectl mark node <n> NoSchedule'], a: 0, e: 'taint 给节点打污点。' },
      { q: '标记节点不可调度用？', opts: ['kubectl cordon <node>', 'kubectl unschedule <node>', 'kubectl block <node>', 'kubectl pause <node>'], a: 0, e: 'cordon 标记节点不可调度。' },
      { q: '驱逐节点 Pod 用？', opts: ['kubectl drain <node>', 'kubectl evict <node>', 'kubectl empty <node>', 'kubectl clear <node>'], a: 0, e: 'drain 安全驱逐节点上的 Pod。' },
      { q: '恢复节点调度用？', opts: ['kubectl uncordon <node>', 'kubectl resume <node>', 'kubectl enable <node>', 'kubectl schedule <node>'], a: 0, e: 'uncordon 恢复节点调度。' },
      { q: '查看 ConfigMap 内容用？', opts: ['kubectl get cm <name> -o yaml', 'kubectl cat cm <name>', 'kubectl show cm <name>', 'kubectl read cm <name>'], a: 0, e: 'get -o yaml 查看完整内容。' },
      { q: '编辑资源用？', opts: ['kubectl edit deploy/nginx', 'kubectl modify deploy/nginx', 'kubectl change deploy/nginx', 'kubectl update deploy/nginx'], a: 0, e: 'edit 打开编辑器修改并应用。' },
      { q: '强制删除 Pod 用？', opts: ['kubectl delete pod <name> --force --grace-period=0', 'kubectl delete pod <name> -f', 'kubectl delete pod <name> --now', 'kubectl remove pod <name> --force'], a: 0, e: '--force --grace-period=0 强制删除。' },
      { q: '查看 Ingress 用？', opts: ['kubectl get ingress', 'kubectl get ing', 'kubectl get ingresses', 'kubectl get routing'], a: 0, e: 'ing 是 ingress 简写。' },
      { q: '查看 PV 用？', opts: ['kubectl get pv', 'kubectl get persistentvolumes', 'kubectl get volumes', 'kubectl get disk'], a: 0, e: 'pv 是 persistentvolume 简写。' },
      { q: '查看 PVC 用？', opts: ['kubectl get pvc', 'kubectl get persistentvolumeclaims', 'kubectl get claims', 'kubectl get disk-claim'], a: 0, e: 'pvc 是 persistentvolumeclaim 简写。' },
      { q: '查看 RBAC 角色用？', opts: ['kubectl get roles', 'kubectl get rbac', 'kubectl get perms', 'kubectl get access'], a: 0, e: 'kubectl get roles 查看 Role。' },
      { q: '查看 ServiceAccount 用？', opts: ['kubectl get sa', 'kubectl get serviceaccounts', 'kubectl get accounts', 'kubectl get sa-list'], a: 0, e: 'sa 是 serviceaccount 简写。' },
      { q: '切换上下文用？', opts: ['kubectl config use-context <name>', 'kubectl switch <name>', 'kubectl context <name>', 'kubectl set-context <name>'], a: 0, e: 'config use-context 切换。' },
      { q: '查看当前上下文用？', opts: ['kubectl config current-context', 'kubectl context', 'kubectl current', 'kubectl where'], a: 0, e: 'config current-context 显示当前上下文。' },
      { q: '查看上下文列表用？', opts: ['kubectl config get-contexts', 'kubectl contexts', 'kubectl list contexts', 'kubectl show contexts'], a: 0, e: 'config get-contexts 列出所有上下文。' },
      { q: '导出资源为 YAML 用？', opts: ['kubectl get deploy nginx -o yaml --export', 'kubectl export deploy nginx', 'kubectl save deploy nginx', 'kubectl dump deploy nginx'], a: 0, e: 'get -o yaml 导出（--export 已废弃但可忽略）。' },
      { q: '查看 API 资源用？', opts: ['kubectl api-resources', 'kubectl resources', 'kubectl api', 'kubectl types'], a: 0, e: 'api-resources 列出所有资源类型。' },
      { q: '查看 API 版本用？', opts: ['kubectl api-versions', 'kubectl versions', 'kubectl api-ver', 'kubectl k8s-versions'], a: 0, e: 'api-versions 列出可用 API 版本。' },
    ],
    top: [
      { q: '查看 Pod 失败原因应先看？', opts: ['kubectl describe pod <name>', 'kubectl get pod <name>', 'kubectl logs <name>', 'kubectl status pod <name>'], a: 0, e: 'describe 看 Events 部分找失败原因。' },
      { q: 'Pod CrashLoopBackOff 应查看？', opts: ['kubectl logs <pod>', 'kubectl describe <pod>', 'kubectl get <pod>', 'kubectl status <pod>'], a: 0, e: 'CrashLoopBackOff 看日志找崩溃原因。' },
      { q: '查看节点资源压力用？', opts: ['kubectl describe node <n>', 'kubectl top node <n>', 'kubectl node <n>', 'kubectl stats node <n>'], a: 0, e: 'describe node 看 Capacity 和 Conditions。' },
      { q: '查看节点是否 Ready 用？', opts: ['kubectl get nodes', 'kubectl node-status', 'kubectl check nodes', 'kubectl nodes ready'], a: 0, e: 'kubectl get nodes 看 STATUS 列。' },
      { q: '查看 Pod 分配到哪个节点用？', opts: ['kubectl get pod -o wide', 'kubectl get pod --node', 'kubectl get pod -n', 'kubectl get pod --where'], a: 0, e: '-o wide 显示 NODE 列。' },
      { q: '查看 Pod 事件用？', opts: ['kubectl get events --field-selector involvedObject.name=<pod>', 'kubectl pod-events <pod>', 'kubectl events <pod>', 'kubectl get pod-events <pod>'], a: 0, e: '按 field-selector 过滤该 Pod 的事件。' },
      { q: '查看 HPA（自动扩缩）用？', opts: ['kubectl get hpa', 'kubectl get autoscalers', 'kubectl get scales', 'kubectl get hpa-list'], a: 0, e: 'hpa 是 horizontalpodautoscaler 简写。' },
      { q: '查看 PDB（中断预算）用？', opts: ['kubectl get pdb', 'kubectl get disruptionbudgets', 'kubectl get budgets', 'kubectl get pdb-list'], a: 0, e: 'pdb 是 poddisruptionbudget 简写。' },
      { q: '查看 NetworkPolicy 用？', opts: ['kubectl get networkpolicy', 'kubectl get netpol', 'kubectl get np', 'kubectl get firewall'], a: 0, e: 'kubectl get networkpolicy（netpol 简写）。' },
      { q: '查看节点污点用？', opts: ['kubectl describe node <n>', 'kubectl get taints <n>', 'kubectl node-taints <n>', 'kubectl taints <n>'], a: 0, e: 'describe node 看 Taints 字段。' },
      { q: '查看资源配额用？', opts: ['kubectl get quota', 'kubectl get resourcequotas', 'kubectl get limits', 'kubectl get rq'], a: 0, e: 'quota 是 resourcequota 简写。' },
      { q: '查看 LimitRange 用？', opts: ['kubectl get limitrange', 'kubectl get limits', 'kubectl get lr', 'kubectl get limitranges'], a: 0, e: 'limitrange 限制资源范围。' },
      { q: '查看 CronJob 用？', opts: ['kubectl get cronjob', 'kubectl get cj', 'kubectl get cronjobs', 'kubectl get scheduled-jobs'], a: 0, e: 'cj 是 cronjob 简写。' },
      { q: '查看 Job 用？', opts: ['kubectl get job', 'kubectl get jobs', 'kubectl get batch', 'kubectl get task'], a: 0, e: 'kubectl get job 查看 Job。' },
      { q: '查看 DaemonSet 用？', opts: ['kubectl get ds', 'kubectl get daemonsets', 'kubectl get daemon', 'kubectl get daemons'], a: 0, e: 'ds 是 daemonset 简写。' },
      { q: '查看 StatefulSet 用？', opts: ['kubectl get sts', 'kubectl get statefulsets', 'kubectl get stateful', 'kubectl get sfs'], a: 0, e: 'sts 是 statefulset 简写。' },
      { q: '查看 ReplicaSet 用？', opts: ['kubectl get rs', 'kubectl get replicasets', 'kubectl get replica', 'kubectl get replicas'], a: 0, e: 'rs 是 replicaset 简写。' },
      { q: '查看 Endpoint 用？', opts: ['kubectl get endpoints', 'kubectl get ep', 'kubectl get endpoint', 'kubectl get eps'], a: 0, e: 'ep 是 endpoints 简写。' },
      { q: '查看节点组件版本用？', opts: ['kubectl version --short', 'kubectl version', 'kubectl components', 'kubectl node-version'], a: 0, e: 'kubectl version 显示客户端和服务端版本。' },
      { q: '查看集群证书到期用？', opts: ['kubectl get cs', 'kubectl certs', 'kubectl get certificates', 'kubectl expiration'], a: 0, e: 'kubectl get cs 查看 componentstatus（已逐步废弃）。' },
    ],
  }

  topics[level].forEach((t) => {
    choice.push({
      id: '', skill: 'kubectl', level, type: 'choice',
      title: t.q, options: t.opts, answer: t.a, explanation: t.e, tags: ['kubectl'],
    })
  })

  if (level === 'low') {
    const fills = [
      { title: '写一条命令，列出当前命名空间的所有 Pod。', ans: 'kubectl get pods', e: 'kubectl get pods 列出 Pod。' },
      { title: '写一条命令，列出所有命名空间的 Pod。', ans: 'kubectl get pods -A', e: '-A 所有命名空间。' },
      { title: '写一条命令，查看 Pod nginx 的详情。', ans: 'kubectl describe pod nginx', e: 'describe 查看详情。' },
      { title: '写一条命令，以 YAML 格式查看 Pod nginx。', ans: 'kubectl get pod nginx -o yaml', e: '-o yaml 输出 YAML。' },
      { title: '写一条命令，列出所有节点。', ans: 'kubectl get nodes', e: 'kubectl get nodes 节点。' },
      { title: '写一条命令，以宽格式列出 Pod。', ans: 'kubectl get pods -o wide', e: '-o wide 宽格式。' },
      { title: '写一条命令，列出 default 命名空间的 Deployment。', ans: 'kubectl get deploy -n default', e: '-n 指定命名空间。' },
      { title: '写一条命令，查看集群信息。', ans: 'kubectl cluster-info', e: 'cluster-info 集群信息。' },
      { title: '写一条命令，查看 K8s 版本。', ans: 'kubectl version', e: 'version 查看版本。' },
      { title: '写一条命令，查看节点资源使用。', ans: 'kubectl top nodes', e: 'top nodes 节点资源。' },
      { title: '写一条命令，查看 Pod 资源使用。', ans: 'kubectl top pods', e: 'top pods Pod 资源。' },
      { title: '写一条命令，列出所有 Service。', ans: 'kubectl get svc', e: 'get svc 列出 Service。' },
    ]
    fills.forEach((f) => {
      fill.push({
        id: '', skill: 'kubectl', level, type: 'fill',
        title: f.title, testCases: [{ input: '', expected: f.ans }],
        referenceAnswer: f.ans, explanation: f.e, tags: ['kubectl'],
      })
    })
  }
  if (level === 'mid') {
    const fills = [
      { title: '写一条命令，声明式应用 deploy.yaml。', ans: 'kubectl apply -f deploy.yaml', e: 'apply -f 声明式应用。' },
      { title: '写一条命令，删除 deploy.yaml 中的资源。', ans: 'kubectl delete -f deploy.yaml', e: 'delete -f 删除。' },
      { title: '写一条命令，创建 nginx Deployment（镜像 nginx）。', ans: 'kubectl create deployment nginx --image=nginx', e: 'create deployment 命令式创建。' },
      { title: '写一条命令，把 nginx Deployment 扩到 3 副本。', ans: 'kubectl scale deployment nginx --replicas=3', e: 'scale --replicas 扩缩容。' },
      { title: '写一条命令，把 deploy/nginx 的 nginx 容器镜像改为 nginx:1.25。', ans: 'kubectl set image deploy/nginx nginx=nginx:1.25', e: 'set image 更新镜像。' },
      { title: '写一条命令，查看 deploy/nginx 的发布状态。', ans: 'kubectl rollout status deploy/nginx', e: 'rollout status 发布状态。' },
      { title: '写一条命令，回滚 deploy/nginx。', ans: 'kubectl rollout undo deploy/nginx', e: 'rollout undo 回滚。' },
      { title: '写一条命令，查看 Pod nginx 的日志。', ans: 'kubectl logs nginx', e: 'logs 查看日志。' },
      { title: '写一条命令，跟踪 Pod nginx 的日志。', ans: 'kubectl logs -f nginx', e: '-f 跟踪日志。' },
      { title: '写一条命令，进入 Pod nginx 的交互终端。', ans: 'kubectl exec -it nginx -- sh', e: 'exec -it 进入容器。' },
      { title: '写一条命令，把本地 8080 转发到 svc/web 的 80。', ans: 'kubectl port-forward svc/web 8080:80', e: 'port-forward 端口转发。' },
      { title: '写一条命令，按标签 app=nginx 筛选 Pod。', ans: 'kubectl get pods -l app=nginx', e: '-l 标签选择器。' },
    ]
    fills.forEach((f) => {
      fill.push({
        id: '', skill: 'kubectl', level, type: 'fill',
        title: f.title, testCases: [{ input: '', expected: f.ans }],
        referenceAnswer: f.ans, explanation: f.e, tags: ['kubectl'],
      })
    })
  }
  if (level === 'high') {
    const fills = [
      { title: '写一条命令，给 Pod nginx 打标签 env=prod。', ans: 'kubectl label pod nginx env=prod', e: 'label 打标签。' },
      { title: '写一条命令，给 Pod nginx 加注解 x=y。', ans: 'kubectl annotate pod nginx x=y', e: 'annotate 加注解。' },
      { title: '写一条命令，给节点 node1 打污点 key=value:NoSchedule。', ans: 'kubectl taint node node1 key=value:NoSchedule', e: 'taint 打污点。' },
      { title: '写一条命令，标记 node1 不可调度。', ans: 'kubectl cordon node1', e: 'cordon 不可调度。' },
      { title: '写一条命令，驱逐 node1 上的 Pod。', ans: 'kubectl drain node1', e: 'drain 驱逐。' },
      { title: '写一条命令，恢复 node1 调度。', ans: 'kubectl uncordon node1', e: 'uncordon 恢复调度。' },
      { title: '写一条命令，编辑 deploy/nginx。', ans: 'kubectl edit deploy/nginx', e: 'edit 编辑资源。' },
      { title: '写一条命令，强制删除 Pod nginx。', ans: 'kubectl delete pod nginx --force --grace-period=0', e: '--force --grace-period=0 强制。' },
      { title: '写一条命令，切换到上下文 prod。', ans: 'kubectl config use-context prod', e: 'config use-context 切换。' },
      { title: '写一条命令，查看当前上下文。', ans: 'kubectl config current-context', e: 'config current-context 当前上下文。' },
      { title: '写一条命令，查看 ConfigMap 名为 cfg。', ans: 'kubectl get cm cfg', e: 'get cm 查看 ConfigMap。' },
      { title: '写一条命令，查看所有 Ingress。', ans: 'kubectl get ingress', e: 'get ingress 查看。' },
    ]
    fills.forEach((f) => {
      fill.push({
        id: '', skill: 'kubectl', level, type: 'fill',
        title: f.title, testCases: [{ input: '', expected: f.ans }],
        referenceAnswer: f.ans, explanation: f.e, tags: ['kubectl'],
      })
    })
  }
  if (level === 'top') {
    const fills = [
      { title: '写一条命令，查看 Pod nginx 的失败事件。', ans: 'kubectl describe pod nginx', e: 'describe 看 Events。' },
      { title: '写一条命令，查看 HPA。', ans: 'kubectl get hpa', e: 'get hpa 自动扩缩。' },
      { title: '写一条命令，查看 CronJob。', ans: 'kubectl get cronjob', e: 'get cronjob 定时任务。' },
      { title: '写一条命令，查看 DaemonSet。', ans: 'kubectl get ds', e: 'get ds DaemonSet。' },
      { title: '写一条命令，查看 StatefulSet。', ans: 'kubectl get sts', e: 'get sts StatefulSet。' },
      { title: '写一条命令，查看 NetworkPolicy。', ans: 'kubectl get networkpolicy', e: 'get networkpolicy 网络策略。' },
      { title: '写一条命令，查看节点配额。', ans: 'kubectl get quota', e: 'get quota 资源配额。' },
      { title: '写一条命令，查看 ReplicaSet。', ans: 'kubectl get rs', e: 'get rs ReplicaSet。' },
      { title: '写一条命令，查看 ServiceAccount。', ans: 'kubectl get sa', e: 'get sa ServiceAccount。' },
      { title: '写一条命令，查看 PV。', ans: 'kubectl get pv', e: 'get pv 持久卷。' },
      { title: '写一条命令，查看 PVC。', ans: 'kubectl get pvc', e: 'get pvc 持久卷声明。' },
      { title: '写一条命令，按 field-selector 查某 Pod 事件。', ans: 'kubectl get events --field-selector involvedObject.name=nginx', e: 'field-selector 过滤事件。' },
    ]
    fills.forEach((f) => {
      fill.push({
        id: '', skill: 'kubectl', level, type: 'fill',
        title: f.title, testCases: [{ input: '', expected: f.ans }],
        referenceAnswer: f.ans, explanation: f.e, tags: ['kubectl'],
      })
    })
  }

  return { choice, fill }
}

// ============ 主流程 ============
function fillTo(skill: string, level: string, gen: (lv: string) => { choice: Q[]; fill: Q[] }) {
  const file = path.join(__dirname, '..', 'data', skill, `${level}.json`)
  const existing = load(file)
  const need = TARGET_PER_LEVEL - existing.length
  if (need <= 0) {
    console.log(`${skill}/${level}: 已有 ${existing.length} 题，跳过`)
    return
  }
  const { choice, fill } = gen(level)
  const pool = [...choice, ...fill]
  const newQs: Q[] = []
  for (const q of pool) {
    if (newQs.length >= need) break
    const id = nextId([...existing, ...newQs], skill, level)
    newQs.push({ ...q, id })
  }
  if (newQs.length < need) {
    console.warn(`${skill}/${level}: 生成器只产出 ${newQs.length} 题，仍缺 ${need - newQs.length} 题`)
  }
  save(file, [...existing, ...newQs])
  console.log(`${skill}/${level}: 已有 ${existing.length} 题，补充 ${newQs.length} 题，共 ${existing.length + newQs.length} 题`)
}

const skills = [
  { id: 'regex', gen: genRegex },
  { id: 'jsonpath', gen: genJsonpath },
  { id: 'linux', gen: genLinux },
  { id: 'kubectl', gen: genKubectl },
]
const levels = ['low', 'mid', 'high', 'top']

for (const sk of skills) {
  for (const lv of levels) {
    fillTo(sk.id, lv, sk.gen)
  }
}

console.log('\n题库生成完成。请运行：npx tsx scripts/validate-questions.ts 校验')
