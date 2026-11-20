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
    { t: '字符类范围', exp: '[a-z] 匹配任意小写字母，[A-Za-z0-9] 可组合范围。' },
    { t: '字符类取反', exp: '[^abc] 匹配不是 a、b、c 的任意字符。' },
    { t: '单词边界 \\b', exp: '\\b 匹配单词字符与非单词字符之间的位置。' },
    { t: '转义 \\', exp: '用 \\ 转义特殊字符，如 \\. 匹配字面点号。' },
    { t: '大小写敏感', exp: '正则默认大小写敏感，加 i 标志忽略大小写。' },
    { t: '全局标志 g', exp: 'g 标志表示全局匹配，找全部而非第一个。' },
  ],
  mid: [
    { t: '分组 ()', exp: '() 创建捕获分组，可用反向引用 \\1 引用。' },
    { t: '非捕获分组', exp: '(?:...) 创建非捕获分组，不保存匹配结果，性能更好。' },
    { t: '反向引用', exp: '\\1 引用第一个捕获分组匹配的内容。' },
    { t: '替换 $1', exp: '替换中 $1 引用第一个捕获分组。' },
    { t: '量词 {n}', exp: '{n} 表示恰好 n 次。' },
    { t: '量词 {n,m}', exp: '{n,m} 表示 n 到 m 次。' },
    { t: '量词 {n,}', exp: '{n,} 表示至少 n 次。' },
    { t: '贪婪与惰性', exp: '默认贪婪，加 ? 变惰性（最少匹配）。' },
    { t: '字符类取反', exp: '[^abc] 匹配非 a、b、c 的任意字符。' },
    { t: '或 |', exp: '| 表示或，匹配左边或右边，如 cat|dog。' },
    { t: '命名分组', exp: '(?<name>...) 命名分组，用 \\k<name> 引用。' },
    { t: '多行模式 m', exp: 'm 标志让 ^ $ 匹配每行而非整个字符串的开头结尾。' },
    { t: '点号通配 s', exp: 's 标志让 . 也匹配换行符。' },
    { t: '重复单词', exp: '(\\w+)\\s\\1 可匹配重复单词。' },
    { t: '邮箱格式', exp: '邮箱大致形如 [\\w.]+@[\\w.]+\\.\\w+。' },
    { t: '手机号', exp: '中国大陆手机号可写作 1[3-9]\\d{9}。' },
  ],
  high: [
    { t: '顺序肯定环视', exp: '(?=...) 顺序肯定环视，匹配后面是 ... 的位置。' },
    { t: '顺序否定环视', exp: '(?!...) 顺序否定环视，匹配后面不是 ... 的位置。' },
    { t: '逆序肯定环视', exp: '(?<=...) 逆序肯定环视，匹配前面是 ... 的位置。' },
    { t: '逆序否定环视', exp: '(?<!...) 逆序否定环视，匹配前面不是 ... 的位置。' },
    { t: '命名分组', exp: '(?<name>...) 命名分组，用 \\k<name> 引用。' },
    { t: '回溯陷阱', exp: '贪婪量词 + 多个 .* 会导致大量回溯，性能差。' },
    { t: '惰性量词', exp: '.*? 在 HTML/标签匹配中常用，避免贪婪吞过多。' },
    { t: '原子分组', exp: '(?>...) 原子分组禁止回溯，提升性能但可能改变语义。' },
    { t: '环视组合', exp: '多个环视可叠加在同一位置，全部满足才匹配。' },
    { t: '密码强度', exp: '用环视确保密码含大小写、数字、符号等多类。' },
    { t: 'IP 匹配', exp: 'IP 可用 (\\d{1,3}\\.){3}\\d{1,3} 粗略匹配。' },
    { t: 'URL 提取', exp: 'https?://[\\w./?=&-]+ 可粗略提取 URL。' },
    { t: '数字千分位', exp: '(?<=\\d)(?=(\\d{3})+$) 在数字间插入千分位的位置。' },
    { t: '驼峰转下划线', exp: '用环视或 replace 在大写字母前插入 _。' },
    { t: '非捕获优化', exp: '不需要引用时用 (?:) 替代 ()，提升性能。' },
    { t: '定长逆序', exp: '逆序环视内模式必须定长（多数实现）。' },
  ],
  top: [
    { t: '回溯灾难', exp: '嵌套量词 (a+)+ 在特定输入下会产生指数级回溯。' },
    { t: '原子分组', exp: '(?>...) 原子分组禁止回溯，提升性能但可能改变语义。' },
    { t: 'Unicode 属性', exp: '\\p{L} 匹配字母类，需 u 标志。' },
    { t: '条件表达式', exp: '(?(1)yes|no) 根据分组是否匹配选择分支。' },
    { t: '性能优化', exp: '用具体字符类替代 . ，减少回溯。' },
    { t: '占有量词', exp: 'a++ 是占有量词，不回溯，性能最佳。' },
    { t: 'ReDoS 防御', exp: '避免嵌套量词与重叠分支，限制输入长度。' },
    { t: 'u 标志', exp: 'u 标志启用 Unicode 模式，正确处理 surrogate pair。' },
    { t: 'y 标志', exp: 'y 粘连标志从 lastIndex 开始必须匹配，做词法分析。' },
    { t: '命名反向引用', exp: '\\k<name> 引用命名分组。' },
    { t: 'Unicode 范围', exp: '\\u{1F600} 匹配 emoji，需 u 标志。' },
    { t: '回溯原理', exp: '回溯是正则在分支失败后退回尝试其他路径的机制。' },
    { t: 'NFA vs DFA', exp: 'JS/Python 用 NFA 支持反向引用，DFA 不支持但快。' },
    { t: '量词等价', exp: 'a+ 等价 a{1,}，a* 等价 a{0,}，a? 等价 a{0,1}。' },
    { t: '锚点组合', exp: '^...$ 整体匹配校验常用组合。' },
    { t: '环视性能', exp: '环视不消耗字符但仍有回溯成本，避免过深嵌套。' },
  ],
}

function genRegex(level: string): { choice: Q[]; fill: Q[] } {
  const choice: Q[] = []
  const fill: Q[] = []
  const topics = RE_TOPICS[level]

  // 选择题：每个 topic 生成 2-3 个变体
  topics.forEach((topic, ti) => {
    // 变体1：定义题
    choice.push({
      id: '', skill: 'regex', level, type: 'choice',
      title: `关于正则「${topic.t}」，下列说法正确的是？`,
      options: [topic.exp, '匹配固定字符串 abc', '只能用于 JavaScript', '必须配合 g 标志使用'],
      answer: 0,
      explanation: topic.exp,
      tags: ['正则', topic.t],
    })
    // 变体2：辨析题（打乱选项顺序）
    const wrongs = ['表示取反操作', '只匹配字符串开头', '等价于空匹配', '必须转义才能使用']
    choice.push({
      id: '', skill: 'regex', level, type: 'choice',
      title: `下列关于「${topic.t}」的描述，错误的是？`,
      options: [topic.exp, wrongs[ti % wrongs.length], wrongs[(ti+1) % wrongs.length], wrongs[(ti+2) % wrongs.length]],
      answer: 0,
      explanation: `正确描述是：${topic.exp}。其余选项均不正确。`,
      tags: ['正则', topic.t],
    })
  })

  // 填空题：按阶段设计
  if (level === 'low') {
    const fills = [
      { title: '从 "abc123def456" 中匹配出所有数字片段。', ans: '/\\d+/g', exp: '\\d+ 匹配连续数字，g 全局。', tc: [{ input: 'abc123def456', expected: ['123','456'] }] },
      { title: '匹配 "hello world" 中的所有小写字母。', ans: '/[a-z]/g', exp: '[a-z] 小写字母。', tc: [{ input: 'hello world', expected: ['h','e','l','l','o','w','o','r','l','d'] }] },
      { title: '判断字符串是否以 "Hello" 开头。', ans: '/^Hello/', exp: '^ 锚定开头。', tc: [{ input: 'Hello world', expected: 'Hello' }, { input: 'Say Hello', expected: [], expectedType: 'nomatch' }] },
      { title: '从 "a1 b2 c3" 匹配字母+数字组合。', ans: '/[a-z]\\d/g', exp: '字母后接数字。', tc: [{ input: 'a1 b2 c3', expected: ['a1','b2','c3'] }] },
      { title: '匹配 "color colour" 两种写法。', ans: '/colou?r/g', exp: 'u? 可选。', tc: [{ input: 'color colour', expected: ['color','colour'] }] },
      { title: '从 "100 200 300" 匹配所有数字。', ans: '/\\d+/g', exp: '连续数字。', tc: [{ input: '100 200 300', expected: ['100','200','300'] }] },
      { title: '匹配 "a.b.c" 中的点号。', ans: '/\\./g', exp: '转义点号。', tc: [{ input: 'a.b.c', expected: ['.','.','.'] }] },
      { title: '从 "cat bat rat" 匹配 c/b/r 开头的 3 字母词。', ans: '/[cbr]at/g', exp: '字符类+字面。', tc: [{ input: 'cat bat rat', expected: ['cat','bat','rat'] }] },
      { title: '判断字符串是否以 "end" 结尾。', ans: '/end$/', exp: '$ 锚定结尾。', tc: [{ input: 'the end', expected: 'end' }, { input: 'ending', expected: [], expectedType: 'nomatch' }] },
      { title: '匹配 "abc" 字面量。', ans: '/abc/', exp: '字面量匹配。', tc: [{ input: 'xabcy', expected: 'abc' }] },
      { title: '从 "a1 2b c3" 匹配单个数字。', ans: '/\\d/g', exp: '单个数字。', tc: [{ input: 'a1 2b c3', expected: ['1','2','3'] }] },
      { title: '匹配 "foo bar baz" 中的单词。', ans: '/\\w+/g', exp: '单词字符。', tc: [{ input: 'foo bar baz', expected: ['foo','bar','baz'] }] },
      { title: '匹配 "a b  c" 中的空白。', ans: '/\\s/g', exp: '空白字符。', tc: [{ input: 'a b  c', expected: [' ',' ',' '] }] },
      { title: '判断是否包含数字。', ans: '/\\d/', exp: '有数字即可。', tc: [{ input: 'abc123', expected: ['1'] }, { input: 'abc', expected: [], expectedType: 'nomatch' }] },
      { title: '匹配 "2024" 这样的 4 位数字。', ans: '/\\d{4}/', exp: '恰好 4 位。', tc: [{ input: 'year 2024 ok', expected: '2024' }] },
      { title: '匹配非空白字符。', ans: '/\\S/g', exp: '非空白。', tc: [{ input: 'a b', expected: ['a','b'] }] },
      { title: '匹配 "aA bB" 中的字母（不分大小写）。', ans: '/[a-zA-Z]/g', exp: '大小写字母。', tc: [{ input: 'aA bB', expected: ['a','A','b','B'] }] },
      { title: '匹配 "x1, x2, x3" 中的 x 加数字。', ans: '/x\\d/g', exp: '组合匹配。', tc: [{ input: 'x1, x2, x3', expected: ['x1','x2','x3'] }] },
    ]
    fills.forEach((f) => fill.push({
      id: '', skill: 'regex', level, type: 'fill',
      title: f.title, testCases: f.tc, referenceAnswer: f.ans,
      explanation: f.exp, tags: ['正则'],
    }))
  }

  if (level === 'mid') {
    const fills = [
      { title: '匹配 "hello hello world" 中重复的单词。', ans: '/(\\w+)\\s\\1/g', exp: '反向引用。', tc: [{ input: 'hello hello world', expected: ['hello hello'] }] },
      { title: '匹配 3 位数字。', ans: '/\\d{3}/g', exp: '{3} 恰好。', tc: [{ input: 'a123b456', expected: ['123','456'] }, { input: '12', expected: [], expectedType: 'nomatch' }] },
      { title: '匹配 2 到 4 位数字。', ans: '/\\d{2,4}/g', exp: '{2,4} 区间。', tc: [{ input: 'a1 a22 a333 a4444', expected: ['22','333','4444'] }] },
      { title: '匹配 "2024-01-15" 形式日期。', ans: '/\\d{4}-\\d{2}-\\d{2}/', exp: '日期格式。', tc: [{ input: '2024-01-15', expected: '2024-01-15', expectedType: 'equal' }, { input: 'not date', expected: [], expectedType: 'nomatch' }] },
      { title: '匹配 "a1b2" 中的非数字。', ans: '/[^\\d]/g', exp: '取反。', tc: [{ input: 'a1b2', expected: ['a','b'] }] },
      { title: '匹配 cat 或 dog。', ans: '/cat|dog/g', exp: '或 |。', tc: [{ input: 'cat and dog', expected: ['cat','dog'] }] },
      { title: '匹配 "a.b.c" 的点号。', ans: '/\\./g', exp: '转义点号。', tc: [{ input: 'a.b.c', expected: ['.', '.'] }] },
      { title: '匹配 "a.b.c" 整个点号串（贪婪合并）。', ans: '/\\.+/g', exp: '贪婪量词。', tc: [{ input: 'a.b.c', expected: ['.', '.'] }] },
      { title: '从 "1a2b3c" 提取字母。', ans: '/[a-z]/g', exp: '字母。', tc: [{ input: '1a2b3c', expected: ['a','b','c'] }] },
      { title: '匹配 "abcABC" 中所有字符（含大小写）。', ans: '/[a-zA-Z]+/g', exp: '大小写。', tc: [{ input: 'abcABC', expected: ['abcABC'] }] },
      { title: '匹配 11 位手机号。', ans: '/1\\d{10}/', exp: '手机号。', tc: [{ input: 'call 13912345678 ok', expected: '13912345678' }] },
      { title: '匹配邮箱（粗略）。', ans: '/[\\w.]+@[\\w.]+\\.\\w+/', exp: '邮箱。', tc: [{ input: 'mail a@b.com ok', expected: 'a@b.com' }] },
      { title: '匹配连续空格（2 个及以上）。', ans: '/ {2,}/g', exp: '至少 2 空格。', tc: [{ input: 'a  b   c', expected: ['  ','   '] }] },
      { title: '匹配 4 个字母的单词。', ans: '/\\b\\w{4}\\b/g', exp: '4 字母词。', tc: [{ input: 'foo bar test abcd', expected: ['test','abcd'] }] },
      { title: '匹配 "2024/01/15" 日期。', ans: '/\\d{4}\\/\\d{2}\\/\\d{2}/', exp: '转义斜杠。', tc: [{ input: '2024/01/15', expected: '2024/01/15', expectedType: 'equal' }] },
      { title: '匹配 "He said hello hello" 中的重复词。', ans: '/(\\w+)\\s\\1/g', exp: '反向引用。', tc: [{ input: 'He said hello hello', expected: ['hello hello'] }] },
    ]
    fills.forEach((f) => fill.push({
      id: '', skill: 'regex', level, type: 'fill',
      title: f.title, testCases: f.tc, referenceAnswer: f.ans,
      explanation: f.exp, tags: ['正则'],
    }))
  }

  if (level === 'high') {
    const fills = [
      { title: '匹配后面跟着"元"的数字（"100元 200块" 中的 100）。', ans: '/\\d+(?=元)/g', exp: '顺序肯定环视。', tc: [{ input: '100元 200块 300元', expected: ['100','300'] }] },
      { title: '匹配不以数字开头的单词。', ans: '/^(?!\\d)\\w+/g', exp: '顺序否定。', tc: [{ input: 'abc 1de', expected: ['abc'] }] },
      { title: '匹配前面是 $ 的数字（"$100 and 200" 中的 100）。', ans: '/(?<=\\$)\\d+/g', exp: '逆序肯定。', tc: [{ input: '$100 and 200', expected: ['100'] }] },
      { title: '匹配前面不是空格的字母（"a b c" 中只匹配 a）。', ans: '/(?<!\\s)[a-z]/g', exp: '逆序否定。', tc: [{ input: 'a b c', expected: ['a'] }] },
      { title: '匹配 4-6 位数字。', ans: '/\\d{4,6}/g', exp: '区间量词。', tc: [{ input: 'a1 a22 a3333 a444444', expected: ['3333','444444'] }] },
      { title: '匹配 "a.b.c" 的点号（非捕获分组）。', ans: '/(?:\\.)+/g', exp: '非捕获分组（贪婪）。', tc: [{ input: 'a.b.c', expected: ['.', '.'] }] },
      { title: '匹配 100-999 范围的数字。', ans: '/[1-9]\\d{2}/g', exp: '范围。', tc: [{ input: 'a100 b999 c50', expected: ['100','999'] }] },
      { title: '匹配 HTML 起始标签（惰性）。', ans: '/<.+?>/', exp: '惰性匹配标签。', tc: [{ input: '<a>txt', expected: ['<a>'] }] },
      { title: '匹配 "key=value" 中的 key。', ans: '/\\w+(?==)/g', exp: '顺序肯定。', tc: [{ input: 'a=1 b=2', expected: ['a','b'] }] },
      { title: '匹配 "a:b:c" 中的字母（前面是 : 或开头）。', ans: '/(?<=:|^)[a-z]/g', exp: '逆序肯定+或。', tc: [{ input: 'a:b:c', expected: ['a','b','c'] }] },
      { title: '匹配不在引号内的数字。', ans: '/(?<!")\\d+(?!")/', exp: '逆序否定+顺序否定。', tc: [{ input: 'abc123def', expected: '123' }] },
      { title: '匹配连续两个相同数字。', ans: '/(\\d)\\1/g', exp: '反向引用。', tc: [{ input: 'aa 112233', expected: ['11','22','33'] }] },
      { title: '匹配 "1.2.3.4" IP 形式。', ans: '/(\\d{1,3}\\.){3}\\d{1,3}/', exp: '分组重复。', tc: [{ input: 'ip 192.168.1.1 ok', expected: '192.168.1.1' }] },
      { title: '匹配 "a.b.c" 中的字母（点号分隔）。', ans: '/[^.]+/g', exp: '非点号。', tc: [{ input: 'a.b.c', expected: ['a','b','c'] }] },
      { title: '匹配 "2024-01" 年月。', ans: '/\\d{4}-\\d{2}/', exp: '年月。', tc: [{ input: 'date 2024-01 ok', expected: '2024-01' }] },
      { title: '匹配 2 到 5 位字母。', ans: '/[a-z]{2,5}/g', exp: '字母区间。', tc: [{ input: 'a ab abc abcd abcde', expected: ['ab','abc','abcd','abcde'] }] },
      { title: '匹配 "a1b2" 中的字母和数字成对。', ans: '/[a-z]\\d/g', exp: '成对。', tc: [{ input: 'a1b2', expected: ['a1','b2'] }] },
      { title: '匹配连续 3 个相同字符。', ans: '/(.)\\1\\1/g', exp: '反向引用两次。', tc: [{ input: 'aaa bbb cc', expected: ['aaa','bbb'] }] },
      { title: '匹配 "1a2b3c" 中的数字（用 \\d）。', ans: '/\\d/g', exp: '数字。', tc: [{ input: '1a2b3c', expected: ['1','2','3'] }] },
      { title: '匹配 "a,b,c" 中的字母（非逗号）。', ans: '/[^,]/g', exp: '非逗号。', tc: [{ input: 'a,b,c', expected: ['a','b','c'] }] },
    ]
    fills.forEach((f) => fill.push({
      id: '', skill: 'regex', level, type: 'fill',
      title: f.title, testCases: f.tc, referenceAnswer: f.ans,
      explanation: f.exp, tags: ['正则'],
    }))
  }

  if (level === 'top') {
    const fills = [
      { title: '优化版：用 [^,] 替代 . 匹配 CSV 字段（"a,b,c"）。', ans: '/[^,]+/g', exp: '具体字符类。', tc: [{ input: 'a,b,c', expected: ['a','b','c'] }] },
      { title: '匹配 Unicode 字母（"你好 world 123" 中的字母）。', ans: '/\\p{L}+/gu', exp: 'Unicode 属性。', tc: [{ input: '你好 world 123', expected: ['你好','world'] }] },
      { title: '匹配 emoji。', ans: '/\\u{1F600}/u', exp: 'Unicode 码点。', tc: [{ input: '😀 ok', expected: '😀' }] },
      { title: '优化匹配数字（用 + 量词）。', ans: '/\\d+/g', exp: '贪婪量词匹配数字。', tc: [{ input: 'abc123', expected: ['123'] }] },
      { title: '匹配 "a, a, a" 中重复的 ", a"。', ans: '/(?:, a)+/g', exp: '非捕获分组。', tc: [{ input: 'a, a, a', expected: [', a, a'] }] },
      { title: '匹配定长 6 位数字（不回溯版）。', ans: '/\\d{6}/', exp: '定长无回溯。', tc: [{ input: 'code 123456 ok', expected: '123456' }] },
      { title: '匹配 "2024年01月15日" 日期。', ans: '/\\d{4}年\\d{2}月\\d{2}日/', exp: '中文日期。', tc: [{ input: '2024年01月15日', expected: '2024年01月15日', expectedType: 'equal' }] },
      { title: '匹配千分位数字（"1,234,567"）。', ans: '/\\d{1,3}(?:,\\d{3})+/', exp: '千分位。', tc: [{ input: '1,234,567 ok', expected: '1,234,567' }] },
      { title: '匹配 16 进制数。', ans: '/[0-9a-fA-F]+/g', exp: '16 进制。', tc: [{ input: 'ff 1a2B', expected: ['ff','1a2B'] }] },
      { title: '匹配 UUID（粗略）。', ans: '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i', exp: 'UUID。', tc: [{ input: 'id 12345678-1234-1234-1234-1234567890ab ok', expected: '12345678-1234-1234-1234-1234567890ab' }] },
      { title: '匹配 8 位数字。', ans: '/\\d{8}/', exp: '定长。', tc: [{ input: 'id 12345678 ok', expected: '12345678' }] },
      { title: '匹配 "a1b2" 中的数字。', ans: '/\\d/g', exp: '数字。', tc: [{ input: 'a1b2', expected: ['1','2'] }] },
      { title: '匹配 "key:value" 中的 value（用逆序）。', ans: '/(?<=:)[^,]+/g', exp: '逆序肯定。', tc: [{ input: 'a:1,b:2', expected: ['1','2'] }] },
      { title: '匹配 "abc-def-ghi" 中的字母段。', ans: '/[^-]+/g', exp: '非分隔符。', tc: [{ input: 'abc-def-ghi', expected: ['abc','def','ghi'] }] },
      { title: '匹配连续 3 位数字。', ans: '/\\d{3}/g', exp: '3 位数字。', tc: [{ input: 'a123b456', expected: ['123','456'] }] },
      { title: '匹配 "1-2-3" 中的数字。', ans: '/\\d/g', exp: '数字。', tc: [{ input: '1-2-3', expected: ['1','2','3'] }] },
      { title: '匹配 "a.b.c.d" 中的字母。', ans: '/[^.]/g', exp: '非点号。', tc: [{ input: 'a.b.c.d', expected: ['a','b','c','d'] }] },
      { title: '匹配 4 到 8 位数字。', ans: '/\\d{4,8}/g', exp: '区间。', tc: [{ input: 'a12 a1234 a12345678', expected: ['1234','12345678'] }] },
    ]
    fills.forEach((f) => fill.push({
      id: '', skill: 'regex', level, type: 'fill',
      title: f.title, testCases: f.tc, referenceAnswer: f.ans,
      explanation: f.exp, tags: ['正则'],
    }))
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
      { t: '下标 [n]', exp: '[n] 访问数组第 n 个元素（从 0 开始）。' },
      { t: '下标 [-1]', exp: '[-1] 访问数组最后一个元素。' },
      { t: "括号 ['a']", exp: "$['a'] 等价于 $.a，用于含特殊字符的字段名。" },
      { t: '链式访问', exp: '$.a.b.c 链式访问嵌套字段。' },
      { t: 'JSON 解析', exp: 'JSONPath 表达式作用于一个 JSON 对象。' },
      { t: '返回类型', exp: '查询结果通常是数组（即使只匹配一个）。' },
      { t: '空结果', exp: '查不到的字段返回空数组，不报错。' },
      { t: '字段名规范', exp: '合法标识符可用 .a，含特殊字符必须用 [\'a\']。' },
    ],
    mid: [
      { t: '通配符 [*]', exp: '[*] 选取数组所有元素。' },
      { t: '通配符 .*', exp: '.* 选取对象所有字段值。' },
      { t: '切片 [1:3]', exp: '[1:3] 选取下标 1、2 的元素（含头不含尾）。' },
      { t: '切片 [:2]', exp: '[:2] 省略 start 默认 0，取下标 0、1。' },
      { t: '切片 [::-1]', exp: '[::-1] 步长 -1，反转数组。' },
      { t: '过滤 [?(...)]', exp: '[?(expr)] 按表达式过滤数组。' },
      { t: '当前元素 @', exp: '@ 在过滤表达式中代表当前元素。' },
      { t: '比较 ==', exp: "@.field == 'value' 等值比较。" },
      { t: '比较 < >', exp: '@.price < 10 数值比较。' },
      { t: '逻辑 && ||', exp: '过滤条件可用 && || 组合。' },
      { t: '存在性', exp: '条件用 @.field 判断字段是否存在。' },
      { t: '否定 !', exp: '!@.field 表示字段不存在。' },
    ],
    high: [
      { t: '递归 ..', exp: '.. 从当前位置递归查找所有层级。' },
      { t: '脚本表达式', exp: '部分实现支持 (script) 脚本表达式。' },
      { t: '多选 [a,b]', exp: "['a','b'] 同时选取多个字段。" },
      { t: '组合表达式', exp: '$..book[0].title 与 $..price 组合查询。' },
      { t: '递归+过滤', exp: '$..book[?(@.price<10)] 递归后过滤。' },
      { t: '递归+切片', exp: '$..list[0:2] 递归找 list 再切片。' },
      { t: '@ 与 $ 区别', exp: '@ 是当前元素，$ 是根。' },
      { t: '嵌套过滤', exp: '过滤条件里可再嵌套 JSONPath。' },
      { t: '字段存在检查', exp: '用 @.field 过滤出有该字段的元素。' },
      { t: '正则匹配', exp: '部分实现支持 =~ /pattern/ 正则匹配。' },
    ],
    top: [
      { t: '过滤陷阱', exp: '过滤表达式中 @ 与 $ 的区别。' },
      { t: '切片步长', exp: '[::2] 步长切片。' },
      { t: '空结果', exp: '不存在的字段返回空数组而非报错。' },
      { t: '实现差异', exp: 'jsonpath-plus 与 Goessner 语法略有不同。' },
      { t: '性能', exp: '递归 .. 较慢，能用具体路径就用。' },
      { t: '结果顺序', exp: '递归结果顺序与实现有关，不保证固定。' },
      { t: '根对象返回', exp: '$ 返回整个根对象。' },
      { t: '负步长', exp: '[::-1] 反转，[5:0:-1] 倒序取一段。' },
      { t: '多下标', exp: '$[0,2,4] 一次取多个下标。' },
      { t: '过滤嵌套', exp: '可在过滤条件里用 @.a.b 访问子字段。' },
    ],
  }

  topics[level].forEach((topic, ti) => {
    choice.push({
      id: '', skill: 'jsonpath', level, type: 'choice',
      title: `关于 JSONPath「${topic.t}」，下列正确的是？`,
      options: [topic.exp, '只能用于 XML', '必须大写', '不能嵌套'],
      answer: 0,
      explanation: topic.exp,
      tags: ['JSONPath', topic.t],
    })
    // 变体
    const wrongs = ['会修改原数据', '仅支持整数下标', '不能用于数组', '必须配合 SQL']
    choice.push({
      id: '', skill: 'jsonpath', level, type: 'choice',
      title: `下列关于「${topic.t}」错误的是？`,
      options: [topic.exp, wrongs[ti % wrongs.length], wrongs[(ti+1)%wrongs.length], wrongs[(ti+2)%wrongs.length]],
      answer: 0,
      explanation: `正确：${topic.exp}。JSONPath 是只读查询，不修改原数据。`,
      tags: ['JSONPath', topic.t],
    })
  })

  const json1 = '{"a":1,"b":2,"c":3}'
  const json2 = '{"store":{"book":[{"title":"A","price":10},{"title":"B","price":20}]}}'
  const json3 = '{"list":[10,20,30,40,50]}'
  const json4 = '{"users":[{"name":"Tom","age":20},{"name":"Jerry","age":25}]}'
  const json5 = '{"x":{"y":{"z":1}}}'

  if (level === 'low') {
    const fills = [
      { title: `取 ${json1} 中 a 字段。`, ans: '$.a', exp: '基础访问。', tc: [{ input: json1, expected: ['1'] }] },
      { title: `取 ${json1} 中 b 字段。`, ans: '$.b', exp: '基础访问。', tc: [{ input: json1, expected: ['2'] }] },
      { title: `取 ${json1} 中 c 字段。`, ans: '$.c', exp: '基础访问。', tc: [{ input: json1, expected: ['3'] }] },
      { title: `取 ${json3} 中第 0 个元素。`, ans: '$.list[0]', exp: '下标。', tc: [{ input: json3, expected: ['10'] }] },
      { title: `取 ${json3} 中第 2 个元素。`, ans: '$.list[2]', exp: '下标。', tc: [{ input: json3, expected: ['30'] }] },
      { title: `取 ${json3} 中第 3 个元素。`, ans: '$.list[3]', exp: '下标。', tc: [{ input: json3, expected: ['40'] }] },
      { title: `取 ${json3} 中最后一个元素。`, ans: '$.list[-1]', exp: '负下标。', tc: [{ input: json3, expected: ['50'] }] },
      { title: `取 ${json3} 中倒数第 2 个。`, ans: '$.list[-2]', exp: '负下标。', tc: [{ input: json3, expected: ['40'] }] },
      { title: `取 ${json2} 中 store.book。`, ans: '$.store.book', exp: '链式。', tc: [{ input: json2, expected: ['[{"price":10,"title":"A"},{"price":20,"title":"B"}]'] }] },
      { title: `取 ${json5} 中 z 的值。`, ans: '$.x.y.z', exp: '链式。', tc: [{ input: json5, expected: ['1'] }] },
      { title: `取 ${json5} 中 y 的值。`, ans: '$.x.y', exp: '链式。', tc: [{ input: json5, expected: ['{"z":1}'] }] },
      { title: `取 ${json1} 中 c 字段（用括号写法）。`, ans: "$['c']", exp: '括号。', tc: [{ input: json1, expected: ['3'] }] },
      { title: `取 ${json1} 中 a 字段（用括号写法）。`, ans: "$['a']", exp: '括号。', tc: [{ input: json1, expected: ['1'] }] },
      { title: `取 ${json2} 中 store。`, ans: '$.store', exp: '基础。', tc: [{ input: json2, expected: ['{"book":[{"price":10,"title":"A"},{"price":20,"title":"B"}]}'] }] },
      { title: `取 ${json4} 中第 0 个用户。`, ans: '$.users[0]', exp: '下标。', tc: [{ input: json4, expected: ['{"age":20,"name":"Tom"}'] }] },
      { title: `取 ${json4} 中第 1 个用户。`, ans: '$.users[1]', exp: '下标。', tc: [{ input: json4, expected: ['{"age":25,"name":"Jerry"}'] }] },
      { title: `取 ${json4} 中第 1 个用户的 name。`, ans: '$.users[1].name', exp: '链式。', tc: [{ input: json4, expected: ['Jerry'] }] },
      { title: `取 ${json4} 中第 0 个用户的 age。`, ans: '$.users[0].age', exp: '链式。', tc: [{ input: json4, expected: ['20'] }] },
      { title: `取 ${json3} 中 list 字段。`, ans: '$.list', exp: '基础。', tc: [{ input: json3, expected: ['[10,20,30,40,50]'] }] },
      { title: `取 ${json2} 中 store.book 的第 0 个。`, ans: '$.store.book[0]', exp: '链式+下标。', tc: [{ input: json2, expected: ['{"price":10,"title":"A"}'] }] },
    ]
    fills.forEach((f) => fill.push({
      id: '', skill: 'jsonpath', level, type: 'fill',
      title: f.title, testCases: f.tc, referenceAnswer: f.ans,
      explanation: f.exp, tags: ['JSONPath'],
    }))
  }

  if (level === 'mid') {
    const fills = [
      { title: `取 ${json3} 中所有元素。`, ans: '$.list[*]', exp: '通配符。', tc: [{ input: json3, expected: ['10','20','30','40','50'] }] },
      { title: `取 ${json1} 中所有字段值。`, ans: '$.*', exp: '对象通配。', tc: [{ input: json1, expected: ['1','2','3'] }] },
      { title: `取 ${json3} 中下标 1、2 的元素。`, ans: '$.list[1:3]', exp: '切片含头不含尾。', tc: [{ input: json3, expected: ['20','30'] }] },
      { title: `取 ${json3} 中前 2 个元素。`, ans: '$.list[:2]', exp: '省略 start。', tc: [{ input: json3, expected: ['10','20'] }] },
      { title: `取 ${json3} 中后 2 个元素。`, ans: '$.list[-2:]', exp: '后 N 个。', tc: [{ input: json3, expected: ['40','50'] }] },
      { title: `取 ${json3} 中下标 2、3。`, ans: '$.list[2:4]', exp: '切片。', tc: [{ input: json3, expected: ['30','40'] }] },
      { title: `取 ${json2} 中 price < 15 的书的 title。`, ans: '$.store.book[?(@.price<15)].title', exp: '过滤。', tc: [{ input: json2, expected: ['A'] }] },
      { title: `取 ${json2} 中 price >= 20 的书。`, ans: '$.store.book[?(@.price>=20)]', exp: '过滤。', tc: [{ input: json2, expected: ['{"price":20,"title":"B"}'] }] },
      { title: `取 ${json4} 中 age > 22 的用户。`, ans: '$.users[?(@.age>22)]', exp: '过滤。', tc: [{ input: json4, expected: ['{"age":25,"name":"Jerry"}'] }] },
      { title: `取 ${json4} 中 age >= 25 的用户。`, ans: '$.users[?(@.age>=25)]', exp: '过滤。', tc: [{ input: json4, expected: ['{"age":25,"name":"Jerry"}'] }] },
      { title: `取 ${json4} 中 name 为 Tom 的用户。`, ans: "$.users[?(@.name=='Tom')]", exp: '等值过滤。', tc: [{ input: json4, expected: ['{"age":20,"name":"Tom"}'] }] },
      { title: `取 ${json2} 中所有书的 price。`, ans: '$.store.book[*].price', exp: '通配+链式。', tc: [{ input: json2, expected: ['10','20'] }] },
      { title: `取 ${json3} 中下标 0、2、4 的元素。`, ans: '$.list[::2]', exp: '步长。', tc: [{ input: json3, expected: ['10','30','50'] }] },
      { title: `取 ${json4} 中所有用户的 name。`, ans: '$.users[*].name', exp: '通配。', tc: [{ input: json4, expected: ['Tom','Jerry'] }] },
      { title: `取 ${json4} 中所有用户的 age。`, ans: '$.users[*].age', exp: '通配。', tc: [{ input: json4, expected: ['20','25'] }] },
      { title: `取 ${json2} 中所有书的 title。`, ans: '$.store.book[*].title', exp: '通配+链式。', tc: [{ input: json2, expected: ['A','B'] }] },
      { title: `取 ${json1} 中所有字段值（用 *）。`, ans: '$.*', exp: '通配。', tc: [{ input: json1, expected: ['1','2','3'] }] },
      { title: `取 ${json3} 中下标 0 到 3。`, ans: '$.list[0:4]', exp: '切片。', tc: [{ input: json3, expected: ['10','20','30','40'] }] },
      { title: `取 ${json4} 中 name 不是 Tom 的用户。`, ans: "$.users[?(@.name!='Tom')]", exp: '不等于。', tc: [{ input: json4, expected: ['{"age":25,"name":"Jerry"}'] }] },
    ]
    fills.forEach((f) => fill.push({
      id: '', skill: 'jsonpath', level, type: 'fill',
      title: f.title, testCases: f.tc, referenceAnswer: f.ans,
      explanation: f.exp, tags: ['JSONPath'],
    }))
  }

  if (level === 'high') {
    const fills = [
      { title: `递归取 ${json2} 中所有 price。`, ans: '$..price', exp: '递归。', tc: [{ input: json2, expected: ['10','20'] }] },
      { title: `递归取 ${json2} 中所有 title。`, ans: '$..title', exp: '递归。', tc: [{ input: json2, expected: ['A','B'] }] },
      { title: `同时取 ${json1} 中 a 和 b。`, ans: "$['a','b']", exp: '多选。', tc: [{ input: json1, expected: ['1','2'] }] },
      { title: `同时取 ${json1} 中 a 和 c。`, ans: "$['a','c']", exp: '多选。', tc: [{ input: json1, expected: ['1','3'] }] },
      { title: `同时取 ${json1} 中 b 和 c。`, ans: "$['b','c']", exp: '多选。', tc: [{ input: json1, expected: ['2','3'] }] },
      { title: `递归取 ${json5} 中 z。`, ans: '$..z', exp: '递归。', tc: [{ input: json5, expected: ['1'] }] },
      { title: `递归取 ${json4} 中所有 name。`, ans: '$..name', exp: '递归。', tc: [{ input: json4, expected: ['Tom','Jerry'] }] },
      { title: `递归取 ${json4} 中所有 age。`, ans: '$..age', exp: '递归。', tc: [{ input: json4, expected: ['20','25'] }] },
      { title: `递归取 ${json2} 中所有 book 数组第 0 个的 title。`, ans: '$..book[0].title', exp: '递归+下标。', tc: [{ input: json2, expected: ['A'] }] },
      { title: `递归后过滤：取 ${json2} 中 price<20 的 title。`, ans: '$..book[?(@.price<20)].title', exp: '递归+过滤。', tc: [{ input: json2, expected: ['A'] }] },
      { title: `取 ${json3} 中下标 0、2 的元素。`, ans: '$.list[0,2]', exp: '多下标。', tc: [{ input: json3, expected: ['10','30'] }] },
      { title: `取 ${json3} 中下标 1、3 的元素。`, ans: '$.list[1,3]', exp: '多下标。', tc: [{ input: json3, expected: ['20','40'] }] },
      { title: `取 ${json4} 中有 age 字段的用户。`, ans: '$.users[?(@.age)]', exp: '存在性。', tc: [{ input: json4, expected: ['{"age":20,"name":"Tom"}','{"age":25,"name":"Jerry"}'] }] },
      { title: `取 ${json4} 中有 name 字段的用户。`, ans: '$.users[?(@.name)]', exp: '存在性。', tc: [{ input: json4, expected: ['{"age":20,"name":"Tom"}','{"age":25,"name":"Jerry"}'] }] },
      { title: `递归取 ${json2} 中所有 book。`, ans: '$..book', exp: '递归。', tc: [{ input: json2, expected: ['[{"price":10,"title":"A"},{"price":20,"title":"B"}]'] }] },
      { title: `递归取 ${json3} 中所有数字（递归 list）。`, ans: '$..list', exp: '递归。', tc: [{ input: json3, expected: ['[10,20,30,40,50]'] }] },
    ]
    fills.forEach((f) => fill.push({
      id: '', skill: 'jsonpath', level, type: 'fill',
      title: f.title, testCases: f.tc, referenceAnswer: f.ans,
      explanation: f.exp, tags: ['JSONPath'],
    }))
  }

  if (level === 'top') {
    const fills = [
      { title: `取 ${json3} 中下标 0、2、4 的元素。`, ans: '$.list[::2]', exp: '步长切片。', tc: [{ input: json3, expected: ['10','30','50'] }] },
      { title: `取 ${json3} 反转数组。`, ans: '$.list[::-1]', exp: '负步长。', tc: [{ input: json3, expected: ['50','40','30','20','10'] }] },
      { title: `取 ${json3} 中下标 4 到 1 倒序。`, ans: '$.list[4:0:-1]', exp: '负步长切片。', tc: [{ input: json3, expected: ['50','40','30'] }] },
      { title: `取 ${json1} 中所有字段值。`, ans: '$.*', exp: '通配。', tc: [{ input: json1, expected: ['1','2','3'] }] },
      { title: `取 ${json2} 根对象。`, ans: '$', exp: '根。', tc: [{ input: json2, expected: ['{"store":{"book":[{"price":10,"title":"A"},{"price":20,"title":"B"}]}}'] }] },
      { title: `递归取 ${json4} 中所有 age。`, ans: '$..age', exp: '递归。', tc: [{ input: json4, expected: ['20','25'] }] },
      { title: `取 ${json3} 中下标 1、3。`, ans: '$.list[1,3]', exp: '多下标。', tc: [{ input: json3, expected: ['20','40'] }] },
      { title: `取 ${json3} 中下标 0、4。`, ans: '$.list[0,4]', exp: '多下标。', tc: [{ input: json3, expected: ['10','50'] }] },
      { title: `过滤嵌套：取 ${json2} 中 book 的 price<15 的 title。`, ans: '$.store.book[?(@.price<15)].title', exp: '过滤嵌套。', tc: [{ input: json2, expected: ['A'] }] },
      { title: `取 ${json3} 中下标 0、1、2、3、4 全部（用切片）。`, ans: '$.list[0:5]', exp: '切片全取。', tc: [{ input: json3, expected: ['10','20','30','40','50'] }] },
      { title: `取 ${json3} 中步长 3 的元素。`, ans: '$.list[::3]', exp: '步长 3。', tc: [{ input: json3, expected: ['10','40'] }] },
      { title: `取 ${json3} 中前 3 个。`, ans: '$.list[:3]', exp: '前 N。', tc: [{ input: json3, expected: ['10','20','30'] }] },
      { title: `取 ${json3} 中下标 1 之后所有。`, ans: '$.list[1:]', exp: '省略 end。', tc: [{ input: json3, expected: ['20','30','40','50'] }] },
      { title: `取 ${json4} 中 age 在 21-24 之间的用户（空结果）。`, ans: '$.users[?(@.age>20 && @.age<25)]', exp: '区间过滤。', tc: [{ input: json4, expected: [] }] },
      { title: `取 ${json4} 中 age >= 20 的用户。`, ans: '$.users[?(@.age>=20)]', exp: '过滤。', tc: [{ input: json4, expected: ['{"age":20,"name":"Tom"}','{"age":25,"name":"Jerry"}'] }] },
      { title: `取 ${json4} 中 age 不等于 20 的用户。`, ans: '$.users[?(@.age!=20)]', exp: '不等于过滤。', tc: [{ input: json4, expected: ['{"age":25,"name":"Jerry"}'] }] },
    ]
    fills.forEach((f) => fill.push({
      id: '', skill: 'jsonpath', level, type: 'fill',
      title: f.title, testCases: f.tc, referenceAnswer: f.ans,
      explanation: f.exp, tags: ['JSONPath'],
    }))
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
      { q: 'cd .. 的作用是？', opts: ['上一级目录', '主目录', '根目录', '后退一步'], a: 0, e: '.. 表示上一级目录。' },
      { q: 'mkdir -p 的作用是？', opts: ['递归创建父目录', '打印', '权限', '粘贴'], a: 0, e: '-p 需要时创建父目录，已存在不报错。' },
      { q: 'rm -rf 中 -f 的含义是？', opts: ['强制', '递归', '文件', '快速'], a: 0, e: '-f 强制删除，不提示确认。' },
      { q: 'rm -r 中 -r 的含义是？', opts: ['递归', '强制', '只读', '快速'], a: 0, e: '-r 递归删除，用于删目录。' },
      { q: 'cp -r 的作用是？', opts: ['递归复制目录', '保留权限', '远程', '重命名'], a: 0, e: '-r 递归复制，用于复制目录。' },
      { q: '查看命令帮助的命令是？', opts: ['man', 'help', 'info', 'doc'], a: 0, e: 'man 显示命令手册页，如 man ls。' },
      { q: 'wc -l 的作用是？', opts: ['统计行数', '统计字数', '统计字符', '统计文件'], a: 0, e: 'wc -l 统计行数，-w 字数，-c 字符数。' },
      { q: 'wc -w 的作用是？', opts: ['统计字数', '统计行数', '统计字符', '统计文件'], a: 0, e: 'wc -w 统计字数。' },
      { q: '隐藏文件的特征是？', opts: ['以 . 开头', '以 _ 开头', '以 - 开头', '没有扩展名'], a: 0, e: 'Linux 隐藏文件以 . 开头，ls -a 可见。' },
      { q: '绝对路径的特征是？', opts: ['以 / 开头', '以 . 开头', '以 ~ 开头', '没有 .. '], a: 0, e: '绝对路径以 / 开头，从根开始。' },
      { q: '相对路径 . 表示？', opts: ['当前目录', '上一级', '主目录', '根目录'], a: 0, e: '. 表示当前目录。' },
      { q: '相对路径 .. 表示？', opts: ['上一级目录', '当前目录', '主目录', '根目录'], a: 0, e: '.. 表示上一级目录。' },
      { q: 'ls -lh 中 -h 的含义是？', opts: ['人类可读大小', '硬链接', '主机', '高亮'], a: 0, e: '-h 人类可读（K/M/G）。' },
      { q: 'clear 命令的作用？', opts: ['清屏', '清除文件', '清空目录', '退出'], a: 0, e: 'clear 清空终端屏幕。' },
      { q: 'history 命令的作用？', opts: ['查看命令历史', '删除历史', '重置', '时间'], a: 0, e: 'history 显示命令历史。' },
      { q: 'Ctrl+C 的作用是？', opts: ['终止当前命令', '复制', '清屏', '退出登录'], a: 0, e: 'Ctrl+C 发送中断信号，终止前台命令。' },
      { q: 'Tab 键的作用是？', opts: ['自动补全', '换行', '确认', '删除'], a: 0, e: 'Tab 自动补全命令/路径。' },
      { q: 'touch 已存在文件的作用？', opts: ['更新时间戳', '删除', '清空', '报错'], a: 0, e: 'touch 已存在文件会更新其访问/修改时间。' },
      { q: 'rmdir 只能删除？', opts: ['空目录', '文件', '任意目录', '隐藏文件'], a: 0, e: 'rmdir 只能删空目录，非空用 rm -r。' },
      { q: 'cp 的源和目标顺序？', opts: ['cp 源 目标', 'cp 目标 源', 'cp 源;目标', 'cp 目标;源'], a: 0, e: 'cp 源 目标，源在前目标在后。' },
      { q: 'mv 同目录下重命名相当于？', opts: ['重命名', '复制', '删除', '链接'], a: 0, e: 'mv 同目录相当于重命名。' },
      { q: 'cat 多个文件会？', opts: ['依次连接输出', '只输出第一个', '报错', '合并为新文件'], a: 0, e: 'cat a b 依次输出 a 和 b 的内容。' },
      { q: 'head -n 5 显示？', opts: ['前 5 行', '后 5 行', '第 5 行', '5 个文件'], a: 0, e: 'head -n 5 显示前 5 行。' },
      { q: 'tail -f 的作用？', opts: ['实时跟踪文件末尾', '前几行', '排序', '过滤'], a: 0, e: 'tail -f 持续输出新增内容，看日志神器。' },
    ],
    mid: [
      { q: '修改文件权限的命令是？', opts: ['chmod', 'chown', 'chperm', 'perm'], a: 0, e: 'chmod 修改权限，如 chmod 755 file。' },
      { q: '修改文件所有者的命令是？', opts: ['chown', 'chmod', 'chuser', 'owner'], a: 0, e: 'chown user:group file 修改所有者和组。' },
      { q: '权限 rwx 对应的数字是？', opts: ['7', '6', '5', '4'], a: 0, e: 'r=4, w=2, x=1，rwx=4+2+1=7。' },
      { q: '权限 r-x 对应的数字是？', opts: ['5', '7', '6', '4'], a: 0, e: 'r=4, x=1，r-x=5。' },
      { q: '权限 rw- 对应的数字是？', opts: ['6', '7', '5', '4'], a: 0, e: 'r=4, w=2，rw-=6。' },
      { q: '搜索文本的命令是？', opts: ['grep', 'find', 'search', 'locate'], a: 0, e: 'grep 按内容搜索，如 grep "TODO" file。' },
      { q: '按文件名查找的命令是？', opts: ['find', 'grep', 'locate', 'search'], a: 0, e: 'find /path -name "*.txt" 按文件名查找。' },
      { q: '流编辑器替换文本的命令是？', opts: ['sed', 'awk', 'cut', 'tr'], a: 0, e: "sed 's/old/new/g' file 全局替换。" },
      { q: '列处理的命令是？', opts: ['awk', 'sed', 'grep', 'sort'], a: 0, e: "awk '{print $1}' file 按列处理。" },
      { q: '管道符 | 的作用是？', opts: ['前命令输出作后命令输入', '或运算', '重定向', '注释'], a: 0, e: '管道把前一个命令的标准输出连接到后一个命令的输入。' },
      { q: 'grep -i 的作用是？', opts: ['忽略大小写', '递归', '反向', '行号'], a: 0, e: '-i 忽略大小写。' },
      { q: 'grep -r 的作用是？', opts: ['递归搜索子目录', '反向', '行号', '正则'], a: 0, e: '-r 递归搜索目录下所有文件。' },
      { q: 'grep -v 的作用是？', opts: ['反向匹配', '递归', '忽略大小写', '行号'], a: 0, e: '-v 显示不匹配的行。' },
      { q: 'grep -n 的作用是？', opts: ['显示行号', '递归', '反向', '忽略大小写'], a: 0, e: '-n 显示匹配行的行号。' },
      { q: 'sort -u 的作用是？', opts: ['排序并去重', '升序', '降序', '唯一'], a: 0, e: '-u 排序后去重。' },
      { q: 'uniq 的作用是？', opts: ['去重相邻重复行', '唯一文件', '统计', '排序'], a: 0, e: 'uniq 去除相邻重复行，常与 sort 配合。' },
      { q: '输出重定向 > 的作用是？', opts: ['覆盖写入文件', '追加', '管道', '错误重定向'], a: 0, e: '> 覆盖写入文件，>> 追加。' },
      { q: '>> 的作用是？', opts: ['追加写入', '覆盖写入', '管道', '错误重定向'], a: 0, e: '>> 追加到文件末尾。' },
      { q: '2> 的作用是？', opts: ['重定向标准错误', '重定向标准输出', '追加', '管道'], a: 0, e: '2> 重定向标准错误（文件描述符 2）。' },
      { q: '2>&1 的作用是？', opts: ['错误合并到标准输出', '输出合并到错误', '关闭错误', '关闭输出'], a: 0, e: '2>&1 把标准错误重定向到标准输出。' },
      { q: 'cut -d , -f 2 的作用是？', opts: ['以逗号分隔取第 2 段', '删除第 2 行', '复制第 2 列', '排序'], a: 0, e: '-d 指定分隔符，-f 指定字段。' },
      { q: 'tee 命令的作用是？', opts: ['同时输出到屏幕和文件', '排序', '过滤', '删除'], a: 0, e: 'tee 把 stdin 同时输出到文件和 stdout。' },
      { q: 'xargs 的作用是？', opts: ['把 stdin 作为参数传给命令', '执行多次', '等待', '排序'], a: 0, e: 'xargs 把标准输入转为命令参数。' },
      { q: 'chmod u+x 的含义？', opts: ['给所有者加执行权', '给组加执行权', '给其他人加', '去掉执行权'], a: 0, e: 'u+x 给所有者(user)加执行权限。' },
      { q: 'chmod g-w 的含义？', opts: ['去掉组的写权限', '去掉所有者的写', '给组加写', '给所有者加写'], a: 0, e: 'g-w 去掉组(group)的写权限。' },
      { q: 'chmod o=r 的含义？', opts: ['其他人只读', '所有者只读', '组只读', '所有人只读'], a: 0, e: 'o=r 其他人(other)权限设为只读。' },
      { q: 'chmod a+x 的含义？', opts: ['所有人加执行权', '所有者加', '组加', '其他人加'], a: 0, e: 'a+x a=all 所有人加执行权限。' },
      { q: '权限 755 含义？', opts: ['所有者全权，其他人可读可执行', '所有人全权', '只读', '所有人只读'], a: 0, e: '755：u=rwx, g=rx, o=rx。' },
      { q: '权限 644 含义？', opts: ['所有者读写，其他人只读', '全读写', '全执行', '只读'], a: 0, e: '644：u=rw, g=r, o=r，普通文件常用。' },
      { q: '权限 600 含义？', opts: ['仅所有者读写', '所有人读写', '只读', '所有人执行'], a: 0, e: '600：u=rw, g=-, o=-，密钥文件。' },
      { q: '777 权限的危险性？', opts: ['所有人可读写执行', '无危险', '只读', '仅所有者'], a: 0, e: '777 所有人全权，极不安全。' },
      { q: 'find -name 的作用？', opts: ['按文件名查找', '按大小', '按时间', '按用户'], a: 0, e: '-name 按文件名（支持通配符）。' },
      { q: 'find -type f 的作用？', opts: ['只找普通文件', '只找目录', '只找链接', '只找块设备'], a: 0, e: '-type f 普通文件，d 目录。' },
      { q: 'sort -n 的作用？', opts: ['数字序排序', '自然序', '倒序', '不排序'], a: 0, e: '-n 按数字大小排序。' },
      { q: 'sort -r 的作用？', opts: ['降序', '升序', '随机', '不排序'], a: 0, e: '-r 反向（降序）。' },
      { q: 'tr 命令的作用？', opts: ['转换或删除字符', '翻译', '传输', '跟踪'], a: 0, e: "tr 'a-z' 'A-Z' 把小写转大写。" },
      { q: 'sed -i 的作用？', opts: ['原地修改文件', '忽略', '输入', '交互'], a: 0, e: '-i 直接修改原文件（不输出到屏幕）。' },
      { q: 'awk -F , 的作用？', opts: ['用逗号分隔', '第 F 列', '过滤', '格式化'], a: 0, e: '-F 指定字段分隔符。' },
      { q: 'echo $VAR 的作用？', opts: ['输出变量值', '定义变量', '删除变量', '导入变量'], a: 0, e: 'echo $VAR 输出变量 VAR 的值。' },
      { q: 'env 命令的作用？', opts: ['显示环境变量', '设置环境', '执行命令', '退出'], a: 0, e: 'env 显示所有环境变量。' },
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
      { q: 'ps -ef 与 ps aux 的关系？', opts: ['都看进程，格式不同', '完全不同', 'ps -ef 是错的', '只有 ps aux 对'], a: 0, e: '两者都列出所有进程，字段略有不同。' },
      { q: 'top 命令中 q 的作用？', opts: ['退出', '排序', '帮助', '刷新'], a: 0, e: '在 top 里按 q 退出。' },
      { q: 'kill 默认发送的信号？', opts: ['SIGTERM (15)', 'SIGKILL (9)', 'SIGINT (2)', 'SIGHUP (1)'], a: 0, e: 'kill 默认 SIGTERM，可被捕获优雅退出。' },
      { q: 'df 和 du 的区别？', opts: ['df 看分区，du 看目录', '都看分区', '都看目录', 'du 看分区'], a: 0, e: 'df 文件系统总览，du 目录大小。' },
      { q: 'free -h 中 -h 含义？', opts: ['人类可读', '硬链接', '主机', '高亮'], a: 0, e: '-h 人类可读（K/M/G）。' },
      { q: 'curl -X POST 的作用？', opts: ['指定 POST 方法', '执行', '扩展', '退出'], a: 0, e: '-X 指定 HTTP 方法。' },
      { q: 'curl -d 的作用？', opts: ['发送数据', '删除', '下载', '调试'], a: 0, e: '-d 发送 POST 数据。' },
      { q: 'curl -H 的作用？', opts: ['添加请求头', '帮助', '主机', '高亮'], a: 0, e: '-H 添加请求头。' },
      { q: 'ssh -p 2222 的含义？', opts: ['指定端口 2222', '密码 2222', '协议', '路径'], a: 0, e: '-p 指定端口。' },
      { q: 'scp 本地到远程的格式？', opts: ['scp 本地 user@host:路径', 'scp user@host:路径 本地', '都行', '无顺序'], a: 0, e: 'scp 源 目标，本地在前远程在后。' },
      { q: 'netstat -tlnp 中 -t 含义？', opts: ['TCP', '监听', '数字', '进程'], a: 0, e: '-t 仅 TCP。' },
      { q: 'netstat -tlnp 中 -l 含义？', opts: ['仅监听', 'TCP', '数字', '进程'], a: 0, e: '-l 仅监听端口。' },
      { q: 'netstat -tlnp 中 -n 含义？', opts: ['数字地址端口', '监听', 'TCP', '进程'], a: 0, e: '-n 不解析名字，显示数字。' },
      { q: 'ss 命令相比 netstat？', opts: ['更快的新版替代', '完全不同', '已废弃', '只能查看 TCP'], a: 0, e: 'ss 是 netstat 的现代替代，更快。' },
      { q: 'lsof -i:8080 的作用？', opts: ['查看 8080 端口占用', '列出文件', '列出进程', '列出用户'], a: 0, e: 'lsof -i:端口 查端口占用。' },
      { q: 'ifconfig 的新版替代？', opts: ['ip addr', 'ifcfg', 'netcfg', 'ifnew'], a: 0, e: 'ip addr 是新版网卡查看命令。' },
      { q: 'hostname -I 的作用？', opts: ['显示本机 IP', '显示主机名', '设置主机名', '显示域名'], a: 0, e: '-I 显示本机所有 IP。' },
      { q: 'who 命令的作用？', opts: ['显示登录用户', '我是谁', '谁在用', '所有用户'], a: 0, e: 'who 显示当前登录用户。' },
      { q: 'uptime 显示的 load average 是？', opts: ['平均负载', '运行时间', '用户数', 'CPU 数'], a: 0, e: 'load average 是运行队列平均长度。' },
      { q: '脚本中 # 的作用？', opts: ['注释', '执行', '变量', '路径'], a: 0, e: '# 开头是注释（除 shebang）。' },
      { q: 'echo "hello" 输出？', opts: ['hello', '"hello"', 'hello\\n', '报错'], a: 0, e: 'echo 输出 hello 加换行。' },
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
      { q: 'crontab 中 * * * * * 含义？', opts: ['每分钟', '每小时', '每天', '每秒'], a: 0, e: '5 字段：分 时 日 月 周，全 * 是每分钟。' },
      { q: 'systemctl 重启服务？', opts: ['systemctl restart svc', 'systemctl reload svc', 'systemctl start svc', 'systemctl stop svc'], a: 0, e: 'restart 重启服务。' },
      { q: '查看服务状态用？', opts: ['systemctl status svc', 'systemctl show svc', 'service svc', 'svc status'], a: 0, e: 'systemctl status 查看服务运行状态。' },
      { q: 'journalctl 查看日志用？', opts: ['journalctl -u svc', 'log svc', 'dmesg', 'syslog'], a: 0, e: 'journalctl -u 查看某服务日志。' },
      { q: 'tar 解压 .tar.gz？', opts: ['tar -xzf f.tar.gz', 'tar -czf f.tar.gz', 'tar -xf f.tar.gz', 'untar f.tar.gz'], a: 0, e: '-x 解压，-z gzip，-f 指定文件。' },
      { q: 'tar 压缩 .tar.gz？', opts: ['tar -czf f.tar.gz dir', 'tar -xzf f.tar.gz', 'tar -xf dir', 'gzip dir'], a: 0, e: '-c 创建，-z gzip，-f 文件。' },
      { q: 'find 按大小查找？', opts: ['find . -size +1M', 'find . -big 1M', 'find . -s 1M', 'find . -1M'], a: 0, e: '-size +1M 找大于 1M 的文件。' },
      { q: 'find 按时间查找（修改）？', opts: ['find . -mtime -7', 'find . -time 7', 'find . -m 7', 'find . -age 7'], a: 0, e: '-mtime -7 表示 7 天内修改。' },
      { q: '环境变量 PATH 用？', opts: ['echo $PATH', 'echo PATH', 'print PATH', 'show PATH'], a: 0, e: '$PATH 引用环境变量。' },
      { q: 'export 的作用是？', opts: ['导出为环境变量', '导出文件', '退出', '执行'], a: 0, e: 'export 把变量设为环境变量，子进程可继承。' },
      { q: 'alias 的作用是？', opts: ['设置命令别名', '别名文件', '列表', '对齐'], a: 0, e: 'alias ll="ls -la" 设置别名。' },
      { q: '查看路由表用？', opts: ['ip route', 'route', 'routetable', 'paths'], a: 0, e: 'ip route 查看路由表（新版）。' },
      { q: 'strace -p PID 的作用？', opts: ['跟踪已运行进程', '新进程', '杀进程', '查看进程'], a: 0, e: '-p 跟踪指定 PID 的进程。' },
      { q: 'vmstat 的作用？', opts: ['虚拟内存统计', '虚拟机', '视频内存', '查看进程'], a: 0, e: 'vmstat 报告虚拟内存、进程、CPU 等。' },
      { q: 'sar 的作用？', opts: ['系统活动报告', '搜索', '排序', '安全'], a: 0, e: 'sar 收集和报告系统活动数据。' },
      { q: 'dmesg 的作用？', opts: ['查看内核日志', '删除消息', '磁盘信息', '设备消息'], a: 0, e: 'dmesg 显示内核环形缓冲区日志。' },
      { q: 'systemctl enable 的作用？', opts: ['设置开机启动', '立即启动', '重启', '停止'], a: 0, e: 'enable 设置服务开机自启。' },
      { q: 'systemctl disable 的作用？', opts: ['取消开机启动', '停止', '禁用', '删除'], a: 0, e: 'disable 取消开机自启。' },
      { q: 'tar -j 用什么压缩？', opts: ['bzip2', 'gzip', 'xz', 'zip'], a: 0, e: '-j 用 bzip2（.tar.bz2）。' },
      { q: 'tar -J 用什么压缩？', opts: ['xz', 'gzip', 'bzip2', 'zip'], a: 0, e: '-J 用 xz（.tar.xz）。' },
      { q: 'gzip f.txt 生成？', opts: ['f.txt.gz', 'f.gz', 'f.txt', 'f.txt.zip'], a: 0, e: 'gzip 生成 .gz 后缀。' },
      { q: 'gunzip 的作用？', opts: ['解压 .gz', '压缩', 'gzip 别名', '删除'], a: 0, e: 'gunzip 解压 .gz。' },
      { q: 'zip -r 的作用？', opts: ['递归压缩目录', '解压', '查看', '删除'], a: 0, e: '-r 递归压缩目录为 zip。' },
      { q: 'unzip 的作用？', opts: ['解压 zip', '压缩 zip', '查看 zip', '删除 zip'], a: 0, e: 'unzip 解压 .zip。' },
      { q: 'crontab -e 的作用？', opts: ['编辑定时任务', '查看', '删除', '执行'], a: 0, e: '-e 编辑当前用户的 crontab。' },
      { q: 'crontab -l 的作用？', opts: ['列出定时任务', '编辑', '删除', '执行'], a: 0, e: '-l 列出当前用户的定时任务。' },
      { q: 'at 命令的作用？', opts: ['一次性定时任务', '循环任务', '查看时间', '设置时区'], a: 0, e: 'at 执行一次性任务（at 10:00）。' },
      { q: 'envsubst 的作用？', opts: ['替换环境变量', '设置环境', '查看环境', '导出环境'], a: 0, e: 'envsubst 把模板里的 $VAR 替换为环境变量值。' },
      { q: 'xargs -I {} 的作用？', opts: ['自定义占位符', '忽略', '输入', '交互'], a: 0, e: '-I {} 用 {} 作占位符传给后续命令。' },
      { q: 'nohup cmd & 的作用？', opts: ['后台运行且忽略挂断', '前台运行', '只后台', '只忽略挂断'], a: 0, e: '组合：后台 + 忽略 SIGHUP，终端关闭仍运行。' },
      { q: 'jobs 命令的作用？', opts: ['查看后台任务', '查看进程', '查看服务', '查看日志'], a: 0, e: 'jobs 列出当前 shell 的后台任务。' },
      { q: 'fg 命令的作用？', opts: ['把后台任务拉到前台', '查看文件', '格式化', '过滤'], a: 0, e: 'fg 将后台任务调至前台。' },
      { q: 'bg 命令的作用？', opts: ['让暂停的任务后台继续', '后台运行', '查看后台', '结束后台'], a: 0, e: 'bg 让 Ctrl+Z 暂停的任务后台继续运行。' },
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
      { title: '显示当前工作目录。', ans: 'pwd', e: 'pwd 显示当前目录。' },
      { title: '列出当前目录所有文件（含隐藏）。', ans: 'ls -a', e: '-a 显示隐藏文件。' },
      { title: '以长格式列出目录内容。', ans: 'ls -l', e: '-l 长格式。' },
      { title: '回到用户主目录。', ans: 'cd ~', e: '~ 代表主目录。' },
      { title: '回到上一级目录。', ans: 'cd ..', e: '.. 上一级。' },
      { title: '创建名为 test 的目录。', ans: 'mkdir test', e: 'mkdir 创建目录。' },
      { title: '递归创建 a/b/c 目录。', ans: 'mkdir -p a/b/c', e: '-p 递归创建。' },
      { title: '创建空文件 a.txt。', ans: 'touch a.txt', e: 'touch 创建空文件。' },
      { title: '删除文件 a.txt。', ans: 'rm a.txt', e: 'rm 删除文件。' },
      { title: '递归删除目录 dir。', ans: 'rm -r dir', e: '-r 递归删除。' },
      { title: '强制递归删除目录 dir（不提示）。', ans: 'rm -rf dir', e: '-rf 强制递归。' },
      { title: '复制文件 a.txt 为 b.txt。', ans: 'cp a.txt b.txt', e: 'cp 源 目标。' },
      { title: '递归复制目录 src 到 dst。', ans: 'cp -r src dst', e: '-r 递归复制目录。' },
      { title: '重命名 a.txt 为 b.txt。', ans: 'mv a.txt b.txt', e: 'mv 同目录即重命名。' },
      { title: '把 a.txt 移到 /tmp 目录。', ans: 'mv a.txt /tmp', e: 'mv 移动。' },
      { title: '查看文件 a.txt 内容。', ans: 'cat a.txt', e: 'cat 输出文件内容。' },
      { title: '查看文件前 10 行。', ans: 'head -n 10 a.txt', e: 'head -n 指定行数。' },
      { title: '查看文件后 5 行。', ans: 'tail -n 5 a.txt', e: 'tail -n 后 N 行。' },
      { title: '实时跟踪文件 log 的新增内容。', ans: 'tail -f log', e: 'tail -f 实时跟踪。' },
      { title: '统计文件 a.txt 的行数。', ans: 'wc -l a.txt', e: 'wc -l 统计行数。' },
      { title: '查看 ls 命令的手册。', ans: 'man ls', e: 'man 看手册。' },
      { title: '清空终端屏幕。', ans: 'clear', e: 'clear 清屏。' },
      { title: '查看命令历史。', ans: 'history', e: 'history 历史。' },
      { title: '以人类可读大小列出目录。', ans: 'ls -lh', e: '-h 人类可读。' },
    ]
    fills.forEach((f) => fill.push({
      id: '', skill: 'linux', level, type: 'fill',
      title: f.title, testCases: [{ input: '', expected: f.ans }],
      referenceAnswer: f.ans, explanation: f.e, tags: ['Linux'],
    }))
  }
  if (level === 'mid') {
    const fills = [
      { title: '把文件权限改为 755。', ans: 'chmod 755 file', e: 'chmod 数字法。' },
      { title: '给文件所有者加执行权限。', ans: 'chmod u+x file', e: 'u+x 符号法。' },
      { title: '给所有人加执行权限。', ans: 'chmod a+x file', e: 'a+x 所有人。' },
      { title: '把文件所有者改为 root。', ans: 'chown root file', e: 'chown 改所有者。' },
      { title: '在 file 中搜索 "TODO"。', ans: 'grep TODO file', e: 'grep 搜索文本。' },
      { title: '递归搜索目录中含 "TODO" 的行。', ans: 'grep -r TODO .', e: '-r 递归。' },
      { title: '忽略大小写搜索 "error"。', ans: 'grep -i error file', e: '-i 忽略大小写。' },
      { title: '反向匹配（显示不含 error 的行）。', ans: 'grep -v error file', e: '-v 反向。' },
      { title: '搜索并显示行号。', ans: 'grep -n TODO file', e: '-n 行号。' },
      { title: '把 file 中的 old 替换为 new。', ans: "sed 's/old/new/g' file", e: 'sed 替换。' },
      { title: '原地修改 file（替换 old 为 new）。', ans: "sed -i 's/old/new/g' file", e: '-i 原地。' },
      { title: '打印 file 的第 1 列。', ans: "awk '{print $1}' file", e: 'awk 列处理。' },
      { title: '用逗号分隔，打印第 2 列。', ans: "awk -F, '{print $2}' file", e: '-F 分隔符。' },
      { title: '对 file 排序并去重。', ans: 'sort file | uniq', e: 'sort 排序，uniq 去重。' },
      { title: '统计 file 的行数。', ans: 'wc -l file', e: 'wc -l 统计行数。' },
      { title: '把命令输出追加到 log.txt。', ans: 'cmd >> log.txt', e: '>> 追加重定向。' },
      { title: '把命令输出覆盖写入 out.txt。', ans: 'cmd > out.txt', e: '> 覆盖重定向。' },
      { title: '把错误输出重定向到 err.txt。', ans: 'cmd 2> err.txt', e: '2> 重定向错误。' },
      { title: '把正常输出和错误都写入 log。', ans: 'cmd > log 2>&1', e: '2>&1 合并错误到输出。' },
      { title: '按文件名查找 .txt 文件。', ans: 'find . -name "*.txt"', e: 'find -name。' },
      { title: '查找普通文件（非目录）。', ans: 'find . -type f', e: '-type f。' },
      { title: '把小写转大写（用 tr）。', ans: "tr 'a-z' 'A-Z'", e: 'tr 转换。' },
      { title: '按数字大小排序。', ans: 'sort -n file', e: 'sort -n。' },
      { title: '同时输出到屏幕和文件。', ans: 'tee file', e: 'tee 双向输出。' },
    ]
    fills.forEach((f) => fill.push({
      id: '', skill: 'linux', level, type: 'fill',
      title: f.title, testCases: [{ input: '', expected: f.ans }],
      referenceAnswer: f.ans, explanation: f.e, tags: ['Linux'],
    }))
  }
  if (level === 'high') {
    const fills = [
      { title: '查看所有进程。', ans: 'ps aux', e: 'ps aux 查看所有进程。' },
      { title: '实时监控进程。', ans: 'top', e: 'top 实时进程。' },
      { title: '强制杀死 PID 1234。', ans: 'kill -9 1234', e: 'kill -9 强制终止。' },
      { title: '优雅终止 PID 1234。', ans: 'kill -15 1234', e: 'kill -15 优雅终止。' },
      { title: '按名杀 nginx 进程。', ans: 'killall nginx', e: 'killall 按名杀。' },
      { title: '查看磁盘使用情况。', ans: 'df -h', e: 'df -h 磁盘使用。' },
      { title: '查看当前目录总大小。', ans: 'du -sh .', e: 'du -sh 目录大小。' },
      { title: '查看内存使用。', ans: 'free -h', e: 'free -h 内存。' },
      { title: '测试到 example.com 的连通。', ans: 'ping example.com', e: 'ping 测试连通。' },
      { title: '请求 http://example.com。', ans: 'curl http://example.com', e: 'curl 发起请求。' },
      { title: '用 POST 发送 a=1 到 URL。', ans: "curl -X POST URL -d 'a=1'", e: 'curl POST。' },
      { title: '发送 JSON 数据到 URL。', ans: 'curl -H "Content-Type: application/json" -d \'{"a":1}\' URL', e: 'curl JSON。' },
      { title: '远程登录 user@host。', ans: 'ssh user@host', e: 'ssh 远程登录。' },
      { title: '用 2222 端口 SSH 登录。', ans: 'ssh -p 2222 user@host', e: 'ssh -p 指定端口。' },
      { title: '把本地 file 复制到远程 /tmp。', ans: 'scp file user@host:/tmp', e: 'scp 远程复制。' },
      { title: '查看 TCP 监听端口。', ans: 'netstat -tlnp', e: 'netstat -tlnp 查看端口。' },
      { title: '用新版命令查看监听端口。', ans: 'ss -tlnp', e: 'ss 新版替代。' },
      { title: '查看 8080 端口被谁占用。', ans: 'lsof -i:8080', e: 'lsof -i 查端口。' },
      { title: '查看网卡接口。', ans: 'ip addr', e: 'ip addr 网卡。' },
      { title: '查看系统信息。', ans: 'uname -a', e: 'uname -a 系统信息。' },
      { title: '查看本机 IP（hostname）。', ans: 'hostname -I', e: 'hostname -I 本机 IP。' },
      { title: '写 Shell 脚本第一行（bash）。', ans: '#!/bin/bash', e: 'shebang 指定解释器。' },
      { title: '把命令放后台运行。', ans: 'cmd &', e: '& 后台运行。' },
      { title: '让命令在终端关闭后继续运行。', ans: 'nohup cmd &', e: 'nohup 忽略挂断。' },
      { title: '下载 http://example.com/file。', ans: 'wget http://example.com/file', e: 'wget 下载。' },
      { title: '查看当前登录用户。', ans: 'who', e: 'who 登录用户。' },
      { title: '查看运行时间和负载。', ans: 'uptime', e: 'uptime 负载。' },
    ]
    fills.forEach((f) => fill.push({
      id: '', skill: 'linux', level, type: 'fill',
      title: f.title, testCases: [{ input: '', expected: f.ans }],
      referenceAnswer: f.ans, explanation: f.e, tags: ['Linux'],
    }))
  }
  if (level === 'top') {
    const fills = [
      { title: '查看系统负载。', ans: 'uptime', e: 'uptime 显示负载。' },
      { title: '编辑定时任务。', ans: 'crontab -e', e: 'crontab -e 编辑。' },
      { title: '列出当前定时任务。', ans: 'crontab -l', e: 'crontab -l 列出。' },
      { title: '重启 nginx 服务（systemd）。', ans: 'systemctl restart nginx', e: 'systemctl restart 重启。' },
      { title: '查看 nginx 服务状态。', ans: 'systemctl status nginx', e: 'systemctl status 状态。' },
      { title: '设置 nginx 开机自启。', ans: 'systemctl enable nginx', e: 'enable 开机自启。' },
      { title: '取消 nginx 开机自启。', ans: 'systemctl disable nginx', e: 'disable 取消自启。' },
      { title: '查看 nginx 服务日志。', ans: 'journalctl -u nginx', e: 'journalctl -u 服务日志。' },
      { title: '解压 f.tar.gz。', ans: 'tar -xzf f.tar.gz', e: 'tar -xzf 解压。' },
      { title: '把 dir 压缩为 f.tar.gz。', ans: 'tar -czf f.tar.gz dir', e: 'tar -czf 压缩。' },
      { title: '解压 f.tar.bz2。', ans: 'tar -xjf f.tar.bz2', e: '-j bzip2。' },
      { title: '查找大于 1M 的文件。', ans: 'find . -size +1M', e: 'find -size 按大小。' },
      { title: '查找 7 天内修改的文件。', ans: 'find . -mtime -7', e: 'find -mtime 按时间。' },
      { title: '查找 7 天内访问的文件。', ans: 'find . -atime -7', e: '-atime 访问时间。' },
      { title: '查看当前 PATH 变量。', ans: 'echo $PATH', e: 'echo $PATH 查看 PATH。' },
      { title: '把 MYVAR 导出为环境变量。', ans: 'export MYVAR', e: 'export 导出环境变量。' },
      { title: '设置 ll 别名为 ls -la。', ans: 'alias ll="ls -la"', e: 'alias 设置别名。' },
      { title: '查看路由表。', ans: 'ip route', e: 'ip route 路由表。' },
      { title: '查看打开的文件。', ans: 'lsof', e: 'lsof 打开文件。' },
      { title: '跟踪 PID 1234 的系统调用。', ans: 'strace -p 1234', e: 'strace -p 跟踪进程。' },
      { title: '查看虚拟内存统计。', ans: 'vmstat', e: 'vmstat 虚拟内存。' },
      { title: '查看内核日志。', ans: 'dmesg', e: 'dmesg 内核日志。' },
      { title: '查看 IO 统计。', ans: 'iostat', e: 'iostat IO。' },
      { title: '查看各 CPU 统计。', ans: 'mpstat', e: 'mpstat CPU。' },
      { title: '把模板里的 $VAR 替换为环境变量值。', ans: 'envsubst', e: 'envsubst 模板替换。' },
      { title: '查看后台任务列表。', ans: 'jobs', e: 'jobs 后台任务。' },
      { title: '把后台任务调到前台。', ans: 'fg', e: 'fg 调前台。' },
      { title: '解压 f.zip。', ans: 'unzip f.zip', e: 'unzip 解压 zip。' },
      { title: '把 dir 压缩为 f.zip。', ans: 'zip -r f.zip dir', e: 'zip -r 压缩目录。' },
      { title: '执行一次性任务（10:00）。', ans: 'at 10:00', e: 'at 一次性任务。' },
    ]
    fills.forEach((f) => fill.push({
      id: '', skill: 'linux', level, type: 'fill',
      title: f.title, testCases: [{ input: '', expected: f.ans }],
      referenceAnswer: f.ans, explanation: f.e, tags: ['Linux'],
    }))
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
      { q: 'Pod 简写是？', opts: ['po', 'pod', 'p', 'pods'], a: 0, e: 'po 是 pods 简写。' },
      { q: 'Service 简写是？', opts: ['svc', 'sv', 'ser', 'service'], a: 0, e: 'svc 是 service 简写。' },
      { q: 'Deployment 简写是？', opts: ['deploy', 'dep', 'd', 'deployments'], a: 0, e: 'deploy 是 deployment 简写。' },
      { q: 'Namespace 简写是？', opts: ['ns', 'nm', 'n', 'namespaces'], a: 0, e: 'ns 是 namespace 简写。' },
      { q: 'Node 简写是？', opts: ['no', 'nd', 'n', 'nodes'], a: 0, e: 'no 是 node 简写。' },
      { q: 'ConfigMap 简写是？', opts: ['cm', 'cfg', 'cmap', 'config'], a: 0, e: 'cm 是 configmap 简写。' },
      { q: '列出所有常见资源用？', opts: ['kubectl get all', 'kubectl get everything', 'kubectl all', 'kubectl list all'], a: 0, e: 'kubectl get all 列出常见资源。' },
      { q: '-A 等价于？', opts: ['--all-namespaces', '--all-ns', '--every-ns', '-all'], a: 0, e: '-A 是 --all-namespaces 的简写。' },
      { q: '查看 Pod 日志用？', opts: ['kubectl logs <pod>', 'kubectl cat <pod>', 'kubectl show logs <pod>', 'kubectl tail <pod>'], a: 0, e: 'kubectl logs 查看容器日志。' },
      { q: '进入容器用？', opts: ['kubectl exec -it <pod> -- sh', 'kubectl ssh <pod>', 'kubectl enter <pod>', 'kubectl shell <pod>'], a: 0, e: 'exec -it 进入交互式终端。' },
      { q: '容器在 Pod 中的关系？', opts: ['一个 Pod 可含多个容器', '一个容器多个 Pod', '一一对应', '无关系'], a: 0, e: 'Pod 可含一个或多个容器。' },
      { q: 'K8s 编排的对象是？', opts: ['容器', '虚拟机', '物理机', '进程'], a: 0, e: 'K8s 编排容器化应用。' },
      { q: 'describe 看什么最有用？', opts: ['Events 部分', '名字', '标签', '创建时间'], a: 0, e: 'describe 的 Events 部分显示调度、拉镜像等事件。' },
      { q: 'kubectl 简写别名常用？', opts: ['k', 'ku', 'kc', 'kube'], a: 0, e: '常设置 alias k=kubectl。' },
      { q: '查看 Pod 的标签用？', opts: ['kubectl get pods --show-labels', 'kubectl get pods -l', 'kubectl get pods labels', 'kubectl get pods --labels'], a: 0, e: '--show-labels 显示标签。' },
      { q: '查看 Ingress 用？', opts: ['kubectl get ingress', 'kubectl get ing', 'kubectl get ingresses', 'kubectl get routing'], a: 0, e: 'ing 是 ingress 简写。' },
      { q: '查看 ConfigMap 用？', opts: ['kubectl get cm', 'kubectl get configmaps', 'kubectl get cfgmap', 'kubectl get configmap'], a: 0, e: 'cm 是 configmap 简写。' },
      { q: '查看 Secret 用？', opts: ['kubectl get secret', 'kubectl get secrets', 'kubectl get sec', 'kubectl get credentials'], a: 0, e: 'kubectl get secret 查看 Secret。' },
      { q: '输出 JSON 格式用？', opts: ['-o json', '--json', '-j', '-O json'], a: 0, e: '-o json 输出 JSON。' },
      { q: '实时跟踪变化用？', opts: ['-w', '--watch', '-W', '--follow'], a: 0, e: '-w / --watch 实时跟踪。' },
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
      { q: 'apply 和 create 区别？', opts: ['apply 幂等可更新，create 已存在报错', '完全相同', 'create 更好', 'apply 只能新建'], a: 0, e: 'apply 资源存在则更新，create 已存在会报错。' },
      { q: 'scale 调整的是？', opts: ['副本数', '镜像', '端口', '标签'], a: 0, e: 'scale --replicas 调整副本数。' },
      { q: 'set image 触发？', opts: ['滚动更新', '扩容', '删除', '重启节点'], a: 0, e: 'set image 更新镜像，触发滚动更新。' },
      { q: 'rollout undo 回滚到？', opts: ['上一版本', '最新版本', '指定节点', '初始状态'], a: 0, e: 'undo 默认回滚到上一 revision。' },
      { q: 'rollout restart 作用？', opts: ['重启 Pod 不改镜像', '更新镜像', '删除 Pod', '扩容'], a: 0, e: 'restart 触发重启，不改镜像版本。' },
      { q: 'logs --previous 作用？', opts: ['看上次崩溃前日志', '前一行的日志', '历史所有日志', '上一个 Pod 日志'], a: 0, e: '--previous 查看容器上次崩溃前的日志。' },
      { q: 'exec -it 中 -i 含义？', opts: ['交互式（保持 stdin）', '输入', '立即', '镜像'], a: 0, e: '-i 保持 stdin 打开。' },
      { q: 'exec -it 中 -t 含义？', opts: ['分配 TTY', '测试', '时间', '标签'], a: 0, e: '-t 分配伪终端。' },
      { q: 'port-forward 把端口转给？', opts: ['本地机器', '其他 Pod', '节点', '集群外'], a: 0, e: 'port-forward 把集群端口转到本地。' },
      { q: 'run --rm 中 --rm 含义？', opts: ['退出后删除 Pod', '远程', '只读', '重命名'], a: 0, e: '--rm 退出后自动删除该 Pod。' },
      { q: 'expose 创建的资源是？', opts: ['Service', 'Deployment', 'Pod', 'ConfigMap'], a: 0, e: 'expose 创建 Service 暴露资源。' },
      { q: '查看 Pod 在哪个节点用？', opts: ['kubectl get pod -o wide', 'kubectl get pod --node', 'kubectl get pod -n', 'kubectl get pod --where'], a: 0, e: '-o wide 显示 NODE 列。' },
      { q: '查看 HPA 用？', opts: ['kubectl get hpa', 'kubectl get autoscalers', 'kubectl get scales', 'kubectl get hpa-list'], a: 0, e: 'hpa 是 horizontalpodautoscaler 简写。' },
      { q: '编辑资源用？', opts: ['kubectl edit deploy/nginx', 'kubectl modify deploy/nginx', 'kubectl change deploy/nginx', 'kubectl update deploy/nginx'], a: 0, e: 'edit 打开编辑器修改并应用。' },
      { q: '强制删除 Pod 用？', opts: ['kubectl delete pod <name> --force --grace-period=0', 'kubectl delete pod <name> -f', 'kubectl delete pod <name> --now', 'kubectl remove pod <name> --force'], a: 0, e: '--force --grace-period=0 强制删除。' },
      { q: 'kubectl diff 作用？', opts: ['预览 apply 会改什么', '比较两个 Pod', '显示差异文件', '查找不同'], a: 0, e: 'kubectl diff -f file.yaml 预览变更。' },
      { q: 'set image 后查看状态用？', opts: ['kubectl rollout status', 'kubectl get status', 'kubectl image status', 'kubectl deploy status'], a: 0, e: 'rollout status 查看滚动更新进度。' },
      { q: 'scale 缩到 0 副本的作用？', opts: ['停止所有 Pod', '删除 Deployment', '报错', '重启'], a: 0, e: '--replicas=0 停止所有 Pod（保留配置）。' },
      { q: 'apply 多个 YAML 文件用？', opts: ['kubectl apply -f dir/', 'kubectl apply -f a.yaml b.yaml', 'kubectl apply -f *.yaml', '都行'], a: 0, e: '目录或多个文件都可，目录会递归。' },
      { q: '查看 Pod 健康状态用？', opts: ['kubectl get pods', 'kubectl health pods', 'kubectl status pods', 'kubectl check pods'], a: 0, e: 'kubectl get pods 看 STATUS 列。' },
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
      { q: '标签的作用？', opts: ['标识和筛选资源', '存储配置', '加密数据', '限制资源'], a: 0, e: '标签用于标识和筛选资源。' },
      { q: '注解的作用？', opts: ['存储非标识性元数据', '筛选资源', '加密', '限制'], a: 0, e: '注解保存非标识性元数据，不能用来筛选。' },
      { q: 'cordon 后已有 Pod？', opts: ['不变', '被驱逐', '重启', '删除'], a: 0, e: 'cordon 只阻止新调度，已有 Pod 不动。' },
      { q: 'drain 会做什么？', opts: ['驱逐 Pod + cordon', '只驱逐', '只 cordon', '删除节点'], a: 0, e: 'drain 先 cordon 再驱逐 Pod。' },
      { q: '污点 NoSchedule 效果？', opts: ['不调度新 Pod', '驱逐现有', '删除 Pod', '无影响'], a: 0, e: 'NoSchedule 阻止新 Pod 调度上来。' },
      { q: '污点 NoExecute 效果？', opts: ['驱逐现有不符 Pod', '只阻止新 Pod', '无影响', '重启 Pod'], a: 0, e: 'NoExecute 会驱逐不容忍的现有 Pod。' },
      { q: 'PV 和 PVC 关系？', opts: ['PVC 绑定 PV', 'PV 绑定 PVC', '无关系', '相同'], a: 0, e: 'PVC 申请存储，绑定到匹配的 PV。' },
      { q: 'kubeconfig 默认位置？', opts: ['~/.kube/config', '~/.kubeconfig', '/etc/kube', '~/.config/kube'], a: 0, e: '默认在 ~/.kube/config。' },
      { q: 'KUBECONFIG 环境变量作用？', opts: ['指定配置文件路径', '设置集群地址', '设置命名空间', '设置账号'], a: 0, e: 'KUBECONFIG 指定 kubeconfig 文件路径。' },
      { q: 'RoleBinding 作用？', opts: ['把 Role 绑给用户', '创建角色', '删除角色', '查看角色'], a: 0, e: 'RoleBinding 把 Role 的权限绑给用户/ServiceAccount。' },
      { q: 'ClusterRole 作用域？', opts: ['集群级', '命名空间级', '节点级', 'Pod 级'], a: 0, e: 'ClusterRole 是集群级角色。' },
      { q: 'storageclass 作用？', opts: ['动态创建 PV', '存储数据', '加密', '备份'], a: 0, e: 'storageclass 定义动态创建 PV 的模板。' },
      { q: 'edit 保存后？', opts: ['立即生效', '需 apply', '需重启', '需审批'], a: 0, e: 'edit 保存即应用，类似 apply。' },
      { q: '删除标签用？', opts: ['kubectl label pod <name> key-', 'kubectl label pod <name> -key', 'kubectl unlabeled', 'kubectl label pod <name> --del key'], a: 0, e: 'key- （键名加横线）删除标签。' },
      { q: '查看 CronJob 用？', opts: ['kubectl get cronjob', 'kubectl get cj', 'kubectl get cronjobs', 'kubectl get scheduled-jobs'], a: 0, e: 'cj 是 cronjob 简写。' },
      { q: '查看 DaemonSet 用？', opts: ['kubectl get ds', 'kubectl get daemonsets', 'kubectl get daemon', 'kubectl get daemons'], a: 0, e: 'ds 是 daemonset 简写。' },
      { q: '查看 StatefulSet 用？', opts: ['kubectl get sts', 'kubectl get statefulsets', 'kubectl get stateful', 'kubectl get sfs'], a: 0, e: 'sts 是 statefulset 简写。' },
      { q: '查看 ReplicaSet 用？', opts: ['kubectl get rs', 'kubectl get replicasets', 'kubectl get replica', 'kubectl get replicas'], a: 0, e: 'rs 是 replicaset 简写。' },
      { q: '查看 Endpoints 用？', opts: ['kubectl get endpoints', 'kubectl get ep', 'kubectl get endpoint', 'kubectl get eps'], a: 0, e: 'ep 是 endpoints 简写。' },
      { q: 'apply -f 目录会？', opts: ['递归应用所有 YAML', '只应用第一个', '报错', '需 --recursive'], a: 0, e: 'apply -f dir/ 递归应用目录下所有 YAML。' },
      { q: 'rollout history --revision=N 作用？', opts: ['查看指定版本详情', '回滚到 N', '删除 N', '重启 N'], a: 0, e: '--revision=N 查看指定版本详情。' },
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
      { q: 'ImagePullBackOff 原因？', opts: ['镜像拉不下来', '资源不够', '配置错误', '网络断'], a: 0, e: '镜像拉取失败（标签错、无权限、不存在）。' },
      { q: 'Pending 状态常见原因？', opts: ['调度不上（资源/污点）', '镜像错', '代码错', '权限错'], a: 0, e: 'Pending 通常是调度失败。' },
      { q: 'OOMKilled 含义？', opts: ['内存超限被杀', '磁盘满', '网络断', 'CPU 不足'], a: 0, e: 'OOMKilled 是内存超 limits 被内核杀。' },
      { q: 'CrashLoopBackOff 含义？', opts: ['容器崩溃重启循环', '镜像拉失败', '调度失败', '配置错'], a: 0, e: '容器启动后崩溃，K8s 反复重启退避。' },
      { q: 'logs --previous 看什么？', opts: ['上次崩溃前日志', '上一行', '历史所有', '前一 Pod'], a: 0, e: '--previous 查看容器上次崩溃前的日志。' },
      { q: 'Evicted 状态原因？', opts: ['节点资源压力被驱逐', '镜像错', '配置错', '代码错'], a: 0, e: '节点资源不足时 Pod 被驱逐。' },
      { q: 'top 需要？', opts: ['metrics-server', 'GPU', '特殊权限', 'GPU 插件'], a: 0, e: 'kubectl top 依赖 metrics-server。' },
      { q: 'rollout undo --to-revision=N 作用？', opts: ['回滚到指定版本', '查看 N', '删除 N', '重启 N'], a: 0, e: '--to-revision=N 回滚到指定版本。' },
      { q: 'taint 的三个效果？', opts: ['NoSchedule/PreferNoSchedule/NoExecute', 'Yes/No/Maybe', 'Low/Mid/High', 'A/B/C'], a: 0, e: '三种污点效果。' },
      { q: 'drain --ignore-daemonsets 作用？', opts: ['忽略 DaemonSet Pod', '删除 DaemonSet', '重启', '报错'], a: 0, e: '忽略 DaemonSet 管理的 Pod（无法驱逐）。' },
      { q: 'config set-context 作用？', opts: ['修改上下文配置', '切换上下文', '删除上下文', '查看上下文'], a: 0, e: 'set-context 修改或创建上下文。' },
      { q: 'api-resources --namespaced=true 作用？', opts: ['只看命名空间级资源', '只看集群级', '看所有', '看版本'], a: 0, e: '按是否命名空间级筛选。' },
      { q: 'kubectl explain 作用？', opts: ['查看资源字段说明', '解释错误', '查看日志', '查看事件'], a: 0, e: 'explain pod.spec.containers 查看字段定义。' },
      { q: 'rollout status 退出码？', opts: ['成功 0，失败非 0', '总是 0', '总是 1', '随机'], a: 0, e: 'rollout status 成功返回 0，可用于脚本判断。' },
      { q: 'PriorityClass 作用？', opts: ['Pod 调度优先级', '资源配额', '标签', '注解'], a: 0, e: 'PriorityClass 定义 Pod 优先级。' },
      { q: 'PodDisruptionBudget 作用？', opts: ['保证最少可用副本数', '限制资源', '加密', '路由'], a: 0, e: 'PDB 保证自愿驱逐时最少可用副本。' },
      { q: 'Service type ClusterIP 作用？', opts: ['集群内访问', '对外暴露', '节点端口', '负载均衡'], a: 0, e: 'ClusterIP 仅集群内访问（默认）。' },
      { q: 'Service type NodePort 作用？', opts: ['节点端口对外暴露', '仅集群内', '负载均衡', '加密'], a: 0, e: 'NodePort 在每个节点开端口对外。' },
      { q: 'Service type LoadBalancer 作用？', opts: ['云负载均衡器对外', '节点端口', '仅集群内', '加密'], a: 0, e: 'LoadBalancer 自动配置云 LB。' },
      { q: 'Ingress 作用？', opts: ['HTTP/HTTPS 路由', 'TCP 路由', '存储', '调度'], a: 0, e: 'Ingress 是七层路由入口。' },
      { q: 'kubectl auth can-i 作用？', opts: ['检查权限', '认证', '授权', '查看角色'], a: 0, e: 'auth can-i <verb> <resource> 检查是否有权限。' },
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
      { title: '列出当前命名空间的所有 Pod。', ans: 'kubectl get pods', e: 'kubectl get pods 列出 Pod。' },
      { title: '列出所有命名空间的 Pod。', ans: 'kubectl get pods -A', e: '-A 所有命名空间。' },
      { title: '查看 Pod nginx 的详情。', ans: 'kubectl describe pod nginx', e: 'describe 查看详情。' },
      { title: '以 YAML 格式查看 Pod nginx。', ans: 'kubectl get pod nginx -o yaml', e: '-o yaml 输出 YAML。' },
      { title: '列出所有节点。', ans: 'kubectl get nodes', e: 'kubectl get nodes 节点。' },
      { title: '以宽格式列出 Pod。', ans: 'kubectl get pods -o wide', e: '-o wide 宽格式。' },
      { title: '列出 default 命名空间的 Deployment。', ans: 'kubectl get deploy -n default', e: '-n 指定命名空间。' },
      { title: '查看集群信息。', ans: 'kubectl cluster-info', e: 'cluster-info 集群信息。' },
      { title: '查看 K8s 版本。', ans: 'kubectl version', e: 'version 查看版本。' },
      { title: '查看节点资源使用。', ans: 'kubectl top nodes', e: 'top nodes 节点资源。' },
      { title: '查看 Pod 资源使用。', ans: 'kubectl top pods', e: 'top pods Pod 资源。' },
      { title: '列出所有 Service。', ans: 'kubectl get svc', e: 'get svc 列出 Service。' },
      { title: '列出所有 ConfigMap。', ans: 'kubectl get cm', e: 'get cm 列出 ConfigMap。' },
      { title: '列出所有 Secret。', ans: 'kubectl get secret', e: 'get secret 列出 Secret。' },
      { title: '列出所有 Namespace。', ans: 'kubectl get ns', e: 'get ns 命名空间。' },
      { title: '列出所有常见资源。', ans: 'kubectl get all', e: 'get all 常见资源。' },
      { title: '查看集群事件。', ans: 'kubectl get events', e: 'get events 事件。' },
      { title: '查看 API 资源列表。', ans: 'kubectl api-resources', e: 'api-resources 资源列表。' },
      { title: '查看 API 版本。', ans: 'kubectl api-versions', e: 'api-versions 版本。' },
      { title: '以 JSON 格式查看 Pod nginx。', ans: 'kubectl get pod nginx -o json', e: '-o json JSON。' },
      { title: '实时跟踪 Pod 变化。', ans: 'kubectl get pods -w', e: '-w watch。' },
      { title: '显示 Pod 的标签。', ans: 'kubectl get pods --show-labels', e: '--show-labels 显示标签。' },
    ]
    fills.forEach((f) => fill.push({
      id: '', skill: 'kubectl', level, type: 'fill',
      title: f.title, testCases: [{ input: '', expected: f.ans }],
      referenceAnswer: f.ans, explanation: f.e, tags: ['kubectl'],
    }))
  }
  if (level === 'mid') {
    const fills = [
      { title: '声明式应用 deploy.yaml。', ans: 'kubectl apply -f deploy.yaml', e: 'apply -f 声明式。' },
      { title: '删除 deploy.yaml 中的资源。', ans: 'kubectl delete -f deploy.yaml', e: 'delete -f 删除。' },
      { title: '创建 nginx Deployment（镜像 nginx）。', ans: 'kubectl create deployment nginx --image=nginx', e: 'create deployment 命令式。' },
      { title: '把 nginx Deployment 扩到 3 副本。', ans: 'kubectl scale deployment nginx --replicas=3', e: 'scale --replicas 扩缩容。' },
      { title: '把 deploy/nginx 的 nginx 容器镜像改为 nginx:1.25。', ans: 'kubectl set image deploy/nginx nginx=nginx:1.25', e: 'set image 更新镜像。' },
      { title: '查看 deploy/nginx 的发布状态。', ans: 'kubectl rollout status deploy/nginx', e: 'rollout status 发布状态。' },
      { title: '回滚 deploy/nginx。', ans: 'kubectl rollout undo deploy/nginx', e: 'rollout undo 回滚。' },
      { title: '查看 deploy/nginx 发布历史。', ans: 'kubectl rollout history deploy/nginx', e: 'rollout history 历史。' },
      { title: '重启 deploy/nginx（不改镜像）。', ans: 'kubectl rollout restart deploy/nginx', e: 'rollout restart 重启。' },
      { title: '查看 Pod nginx 的日志。', ans: 'kubectl logs nginx', e: 'logs 查看日志。' },
      { title: '跟踪 Pod nginx 的日志。', ans: 'kubectl logs -f nginx', e: '-f 跟踪日志。' },
      { title: '查看 Pod nginx 上次崩溃前日志。', ans: 'kubectl logs --previous nginx', e: '--previous 旧日志。' },
      { title: '进入 Pod nginx 的交互终端。', ans: 'kubectl exec -it nginx -- sh', e: 'exec -it 进入容器。' },
      { title: '把本地 8080 转发到 svc/web 的 80。', ans: 'kubectl port-forward svc/web 8080:80', e: 'port-forward 端口转发。' },
      { title: '按标签 app=nginx 筛选 Pod。', ans: 'kubectl get pods -l app=nginx', e: '-l 标签选择器。' },
      { title: '运行临时 busybox Pod（退出即删）。', ans: 'kubectl run tmp --image=busybox --rm -it -- sh', e: 'run --rm -it 临时。' },
      { title: '暴露 nginx Deployment 80 端口。', ans: 'kubectl expose deployment nginx --port=80', e: 'expose 暴露。' },
      { title: '预览 apply deploy.yaml 的变更。', ans: 'kubectl diff -f deploy.yaml', e: 'diff 预览。' },
      { title: '编辑 deploy/nginx。', ans: 'kubectl edit deploy/nginx', e: 'edit 编辑。' },
      { title: '强制删除 Pod nginx。', ans: 'kubectl delete pod nginx --force --grace-period=0', e: '--force 强制。' },
      { title: '把 nginx 扩到 0 副本（停止）。', ans: 'kubectl scale deployment nginx --replicas=0', e: '--replicas=0 停止。' },
      { title: '应用 dir 目录下所有 YAML。', ans: 'kubectl apply -f dir/', e: '目录递归。' },
    ]
    fills.forEach((f) => fill.push({
      id: '', skill: 'kubectl', level, type: 'fill',
      title: f.title, testCases: [{ input: '', expected: f.ans }],
      referenceAnswer: f.ans, explanation: f.e, tags: ['kubectl'],
    }))
  }
  if (level === 'high') {
    const fills = [
      { title: '给 Pod nginx 打标签 env=prod。', ans: 'kubectl label pod nginx env=prod', e: 'label 打标签。' },
      { title: '删除 Pod nginx 的 env 标签。', ans: 'kubectl label pod nginx env-', e: 'key- 删标签。' },
      { title: '给 Pod nginx 加注解 x=y。', ans: 'kubectl annotate pod nginx x=y', e: 'annotate 加注解。' },
      { title: '给节点 node1 打污点 key=value:NoSchedule。', ans: 'kubectl taint node node1 key=value:NoSchedule', e: 'taint 打污点。' },
      { title: '标记 node1 不可调度。', ans: 'kubectl cordon node1', e: 'cordon 不可调度。' },
      { title: '驱逐 node1 上的 Pod。', ans: 'kubectl drain node1', e: 'drain 驱逐。' },
      { title: '驱逐 node1 并忽略 DaemonSet。', ans: 'kubectl drain node1 --ignore-daemonsets', e: '--ignore-daemonsets。' },
      { title: '恢复 node1 调度。', ans: 'kubectl uncordon node1', e: 'uncordon 恢复调度。' },
      { title: '编辑 deploy/nginx。', ans: 'kubectl edit deploy/nginx', e: 'edit 编辑资源。' },
      { title: '强制删除 Pod nginx。', ans: 'kubectl delete pod nginx --force --grace-period=0', e: '--force --grace-period=0 强制。' },
      { title: '切换到上下文 prod。', ans: 'kubectl config use-context prod', e: 'config use-context 切换。' },
      { title: '查看当前上下文。', ans: 'kubectl config current-context', e: 'config current-context 当前上下文。' },
      { title: '列出所有上下文。', ans: 'kubectl config get-contexts', e: 'config get-contexts 上下文列表。' },
      { title: '查看配置（kubeconfig）。', ans: 'kubectl config view', e: 'config view 配置。' },
      { title: '查看 ConfigMap 名为 cfg。', ans: 'kubectl get cm cfg', e: 'get cm 查看 ConfigMap。' },
      { title: '查看所有 Ingress。', ans: 'kubectl get ingress', e: 'get ingress 查看。' },
      { title: '查看所有 PV。', ans: 'kubectl get pv', e: 'get pv 持久卷。' },
      { title: '查看所有 PVC。', ans: 'kubectl get pvc', e: 'get pvc 持久卷声明。' },
      { title: '查看所有 Role。', ans: 'kubectl get roles', e: 'get roles 角色。' },
      { title: '查看所有 ServiceAccount。', ans: 'kubectl get sa', e: 'get sa ServiceAccount。' },
      { title: '查看所有 DaemonSet。', ans: 'kubectl get ds', e: 'get ds DaemonSet。' },
      { title: '查看所有 StatefulSet。', ans: 'kubectl get sts', e: 'get sts StatefulSet。' },
      { title: '查看所有 ReplicaSet。', ans: 'kubectl get rs', e: 'get rs ReplicaSet。' },
      { title: '查看所有 CronJob。', ans: 'kubectl get cronjob', e: 'get cronjob 定时任务。' },
      { title: '查看 pod.spec.containers 字段定义。', ans: 'kubectl explain pod.spec.containers', e: 'explain 字段说明。' },
      { title: '把默认命名空间改为 dev。', ans: 'kubectl config set-context --current --namespace=dev', e: 'set-context 改默认命名空间。' },
    ]
    fills.forEach((f) => fill.push({
      id: '', skill: 'kubectl', level, type: 'fill',
      title: f.title, testCases: [{ input: '', expected: f.ans }],
      referenceAnswer: f.ans, explanation: f.e, tags: ['kubectl'],
    }))
  }
  if (level === 'top') {
    const fills = [
      { title: '查看 Pod nginx 的失败事件。', ans: 'kubectl describe pod nginx', e: 'describe 看 Events。' },
      { title: '查看 Pod nginx 上次崩溃前日志。', ans: 'kubectl logs --previous nginx', e: '--previous 旧日志。' },
      { title: '查看 HPA。', ans: 'kubectl get hpa', e: 'get hpa 自动扩缩。' },
      { title: '查看 PDB（中断预算）。', ans: 'kubectl get pdb', e: 'get pdb 中断预算。' },
      { title: '查看 NetworkPolicy。', ans: 'kubectl get networkpolicy', e: 'get networkpolicy 网络策略。' },
      { title: '查看 CronJob。', ans: 'kubectl get cronjob', e: 'get cronjob 定时任务。' },
      { title: '查看 DaemonSet。', ans: 'kubectl get ds', e: 'get ds DaemonSet。' },
      { title: '查看 StatefulSet。', ans: 'kubectl get sts', e: 'get sts StatefulSet。' },
      { title: '查看 ReplicaSet。', ans: 'kubectl get rs', e: 'get rs ReplicaSet。' },
      { title: '查看 ServiceAccount。', ans: 'kubectl get sa', e: 'get sa ServiceAccount。' },
      { title: '查看 PV。', ans: 'kubectl get pv', e: 'get pv 持久卷。' },
      { title: '查看 PVC。', ans: 'kubectl get pvc', e: 'get pvc 持久卷声明。' },
      { title: '按 field-selector 查 Pod nginx 的事件。', ans: 'kubectl get events --field-selector involvedObject.name=nginx', e: 'field-selector 过滤事件。' },
      { title: '查看节点资源压力（describe）。', ans: 'kubectl describe node node1', e: 'describe node 看容量和条件。' },
      { title: '查看资源配额。', ans: 'kubectl get quota', e: 'get quota 配额。' },
      { title: '查看 LimitRange。', ans: 'kubectl get limitrange', e: 'get limitrange 限制范围。' },
      { title: '回滚 deploy/nginx 到版本 2。', ans: 'kubectl rollout undo deploy/nginx --to-revision=2', e: '--to-revision 指定版本。' },
      { title: '检查是否有权限创建 Pod。', ans: 'kubectl auth can-i create pods', e: 'auth can-i 检查权限。' },
      { title: '查看 pod.spec.containers 字段定义。', ans: 'kubectl explain pod.spec.containers', e: 'explain 字段说明。' },
      { title: '查看节点污点。', ans: 'kubectl describe node node1', e: 'describe node 看 Taints。' },
      { title: '查看集群组件状态。', ans: 'kubectl get cs', e: 'get cs 组件状态。' },
      { title: '查看 PriorityClass。', ans: 'kubectl get priorityclass', e: 'get priorityclass 优先级。' },
      { title: '查看 StorageClass。', ans: 'kubectl get storageclass', e: 'get storageclass 存储类。' },
      { title: '只看命名空间级资源。', ans: 'kubectl api-resources --namespaced=true', e: '--namespaced 筛选。' },
    ]
    fills.forEach((f) => fill.push({
      id: '', skill: 'kubectl', level, type: 'fill',
      title: f.title, testCases: [{ input: '', expected: f.ans }],
      referenceAnswer: f.ans, explanation: f.e, tags: ['kubectl'],
    }))
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
