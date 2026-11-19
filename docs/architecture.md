# 架构设计

## 总体架构

```
┌─────────────────────────────────────────┐
│          微信小程序（前端）              │
│  pages/  components/  skills/  utils/    │
└──────────────┬──────────────────────────┘
               │ wx.cloud.callFunction
┌──────────────▼──────────────────────────┐
│          云函数（Node.js）               │
│  login  getQuestions  submitAnswer       │
│  generateExam  submitExam  getProgress  │
│  getWrongbook  importQuestions           │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│          云数据库（NoSQL）               │
│  questions  user_progress  wrong_       │
│  questions  exam_records  users          │
└─────────────────────────────────────────┘
```

## 板块插件化（Skill 抽象）

每个学习板块是一个 `Skill`，遵循统一接口。新增板块只需在 `miniprogram/skills/` 下新增目录，不改主框架。

```ts
// miniprogram/shared/skill.ts
interface Skill {
  id: SkillId
  name: string
  icon: string
  desc: string
  levels: LevelConfig[]
  checker: Checker              // 填空题运行时校验器
  tutorial: TutorialSection[]
}
```

### 各板块 Checker

| 板块 | checker 实现 |
|---|---|
| regex | `new RegExp(input)` 对测试字符串执行 |
| jsonpath | `jsonpath-plus` 对 JSON 数据查询 |
| linux | 命令补全：字符串规范化比对（选择题为主） |
| kubectl | 同上 |

## 数据库集合

| 集合 | 说明 |
|---|---|
| `questions` | 题库（按 skill / level 索引） |
| `user_progress` | 用户每题作答状态 |
| `wrong_questions` | 错题本 |
| `exam_records` | 考试记录 |
| `users` | 用户信息（openid 昵称头像） |

详见 [question-schema.md](question-schema.md)。

## 进度同步

小程序天然联网，所有作答状态实时写入云数据库，天然多端一致，无需离线合并逻辑。

## 题目来源

AI 离线生成完整题库（320 题/板块），通过 `scripts/seed-db.ts` 批量导入云数据库。考试时从题库随机抽 50 题，不联网生成。
