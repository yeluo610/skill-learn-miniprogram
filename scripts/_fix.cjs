const fs = require('fs')
function fix(file, id, ra, exp, tc) {
  const f = 'data/regex/' + file + '.json'
  let a = JSON.parse(fs.readFileSync(f, 'utf-8'))
  const i = a.findIndex(x => x.id === id)
  if (i < 0) { console.log('NOT FOUND', id); return }
  if (ra) a[i].referenceAnswer = ra
  if (exp) a[i].explanation = exp
  if (tc) a[i].testCases = tc
  fs.writeFileSync(f, JSON.stringify(a, null, 2) + '\n')
  console.log('fixed', id)
}
fix('mid', 'regex-mid-077', '/\\./g', '转义点号匹配单个点。', [{ input: 'a.b.c', expected: ['.', '.'] }])
fix('mid', 'regex-mid-078', '/\\.+/g', '贪婪量词匹配连续点。', [{ input: 'a.b.c', expected: ['.', '.'] }])
fix('high', 'regex-high-065', '/(?:\\.)+/g', '非捕获分组贪婪匹配连续点。', [{ input: 'a.b.c', expected: ['.', '.'] }])
