# 部署指南

## 前置准备

1. 注册微信小程序账号（个人主体即可，免费）：https://mp.weixin.qq.com
2. 下载微信开发者工具：https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html
3. 安装依赖：`npm install`

## 开通云开发

1. 打开微信开发者工具，导入本项目（填入你的 AppID）
2. 顶部菜单 → 云开发 → 开通（有免费额度，个人自用足够）
3. 记下云环境 ID

## 配置

1. 复制 `project.private.config.json.example` 为 `project.private.config.json`
2. 填入 `cloudenvironment` 中的 `env`
3. 在 `miniprogram/app.ts` 中替换 cloudEnv 为你的环境 ID

## 数据库集合

在云开发控制台创建以下集合（或首次云函数调用会自动创建）：

- `questions`
- `user_progress`
- `wrong_questions`
- `exam_records`
- `users`

权限设置：所有集合改为"仅创建者可读写"（用户只能看自己的进度/错题），`questions` 改为"所有用户可读"。

## 导入题库

```bash
npm run seed-db
```

该脚本读取 `data/` 下的 JSON 题库，逐条写入云数据库 `questions` 集合。

## 部署云函数

在微信开发者工具中，右键 `cloudfunctions/` 下每个云函数目录 → "上传并部署：云端安装依赖"。

## 发布

1. 开发者工具 → 上传 → 提交审核 → 发布
2. 个人小程序需通过审核后即可对外可见
