const a = require('../data/regex/mid.json')
const q = a.find(x => x.id === 'regex-mid-077')
const ra = q.referenceAnswer
console.log('ra =', JSON.stringify(ra))
const m = /^\/(.+)\/([gimsuy]*)$/.exec(ra.trim())
console.log('match =', m ? [m[1], m[2]] : 'null')
if (m) {
  const re = new RegExp(m[1], m[2].includes('g') ? m[2] : 'g' + m[2])
  const tc = q.testCases[0]
  const expectedArr = Array.isArray(tc.expected) ? tc.expected : [tc.expected]
  const matches = []
  let mm
  re.lastIndex = 0
  while ((mm = re.exec(tc.input)) !== null) {
    matches.push(mm[0])
    if (mm.index === re.lastIndex) re.lastIndex++
  }
  console.log('matches =', matches, 'expected =', expectedArr)
}
