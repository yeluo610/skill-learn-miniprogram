# 技能学习小程序 · Skill Learn Miniprogram

一个可扩展的命令/语法学习平台微信小程序，通过关卡练习、考试测评、错题管理和交互式教程，帮助你系统掌握正则、JSONPath、Linux 命令、kubectl 等技能。

## 板块

- **正则 regex**（首期）
- **JSONPath**（首期）
- Linux 命令（二期）
- kubectl 命令（二期）
- 更多板块（SQL / Shell / ...）持续扩展中

## 技术栈

- 前端：微信小程序原生 + TypeScript
- 后端：微信云开发 CloudBase（无服务器、无 Docker）
- 数据库：云数据库（NoSQL）
- 云函数：Node.js

## 功能

- 学习关卡：4 阶段（低/中/高/顶）× ~80 题/阶段，选择题 + 填空题
- 考试：20 套 × ~50 题，从题库随机抽取
- 错题本：关卡 + 考试错题统一管理
- 交互式教程：左讲解 + 右实时练习
- 微信登录 + 进度云端同步

## 目录结构

```
skill-learn-miniprogram/
├── miniprogram/         # 小程序前端
├── cloudfunctions/      # 云函数
├── data/                # 题库源数据（JSON）
├── docs/                # 项目文档
├── scripts/             # 工具脚本
└── README.md
```

## 开发

详见 [docs/development.md](docs/development.md)（快速上手）、[docs/architecture.md](docs/architecture.md)（架构）、[docs/deploy.md](docs/deploy.md)（部署）、[docs/question-authoring.md](docs/question-authoring.md)（题库编写）。

### 常用命令

```bash
npm install                  # 安装依赖
npm run validate-questions   # 校验题库
npm run seed-db              # 生成导入文件
```
