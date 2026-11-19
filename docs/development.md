# 开发指南

## 快速开始

### 1. 准备账号与工具

1. 注册微信小程序账号：https://mp.weixin.qq.com（个人主体即可，免费）
   - 注册后获取 **AppID**
2. 下载微信开发者工具：https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html

### 2. 安装依赖

```bash
npm install
```

### 3. 配置项目

1. 复制配置文件：
   ```bash
   cp project.private.config.json.example project.private.config.json
   ```
2. 编辑 `project.private.config.json`，把 `"env": "your-env-id"` 改成你的云环境 ID
3. 编辑 `miniprogram/app.ts`，把 `CLOUD_ENV` 常量改成你的云环境 ID
4. 编辑 `project.config.json`，把 `"appid": "REPLACE_WITH_YOUR_APPID"` 改成你的 AppID

### 4. 开通云开发

1. 用微信开发者工具打开本项目目录（会读取 `project.config.json`）
2. 顶部菜单 → **云开发** → 开通（有免费额度，个人自用足够）
3. 记下云环境 ID，回填到上面的配置文件

### 5. 创建数据库集合

在云开发控制台 → 数据库，创建以下集合：

| 集合名 | 权限 | 说明 |
|---|---|---|
| `questions` | 所有用户可读 | 题库 |
| `user_progress` | 仅创建者可读写 | 用户作答进度 |
| `wrong_questions` | 仅创建者可读写 | 错题本 |
| `exam_records` | 仅创建者可读写 | 考试记录 |
| `users` | 仅创建者可读写 | 用户信息 |

### 6. 导入题库

```bash
npm run seed-db
```

生成的文件在 `dist/import-*.json`（JSON Lines 格式）。

然后到云开发控制台 → 数据库 → `questions` 集合 → **导入**：
- 选择对应 `dist/import-*.json` 文件
- 格式选 **JSON Lines**
- 逐个文件导入

### 7. 部署云函数

在微信开发者工具中，对 `cloudfunctions/` 下**每个云函数目录**右键：
- **上传并部署：云端安装依赖**

需要部署的云函数：
- `login` 登录
- `getQuestions` 取关卡题目
- `submitAnswer` 提交单题答案
- `generateExam` 生成考试卷
- `submitExam` 提交考试
- `getProgress` 进度汇总
- `getWrongbook` 错题本
- `importQuestions` 批量导入题库（开发用）

### 8. 运行小程序

开发者工具会自动编译预览。点工具栏的"编译"即可在模拟器看到首页。

## 常用命令

```bash
npm run validate-questions   # 校验题库格式与答案
npm run seed-db              # 生成 JSON Lines 导入文件
npm run lint                 # 代码检查（占位）
```

## 题库校验

编写或修改题库后，务必运行：

```bash
npm run validate-questions
```

校验内容：
- 必填字段（id / skill / level / type / title / explanation）
- 选择题有 options 和 answer
- 填空题有 testCases，且 referenceAnswer 自身能通过所有 testCases
- id 全局唯一

详见 [question-authoring.md](question-authoring.md)。

## 调试技巧

- 云函数日志：云开发控制台 → 云函数 → 对应函数 → 日志
- 数据库实时查看：云开发控制台 → 数据库 → 对应集合
- 真机预览：开发者工具 → 预览 → 扫码

## 发布

1. 开发者工具 → 上传 → 填版本号
2. 登录小程序后台 → 提交审核
3. 审核通过 → 发布
4. 个人小程序审核通常 1-2 天

## 常见问题

**Q: 静默登录失败？**
A: 检查云函数 login 是否已部署，云环境 ID 是否填对。

**Q: 题目列表为空？**
A: 题库未导入，运行 `npm run seed-db` 生成文件后在云开发控制台导入。

**Q: 填空题总是判定错误？**
A: 检查 testCases 的 expected 与 referenceAnswer 是否一致（运行 `npm run validate-questions`）。

**Q: 云函数超时？**
A: 考试组卷/评分涉及大量查询，可在云开发控制台调大超时时间（默认 3 秒，建议调到 10 秒）。
