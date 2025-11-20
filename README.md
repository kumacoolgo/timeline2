# 费用时间轴（Expense Timeline）

本项目提供一个可视化的订阅 / 保修 / 保险费用时间轴工具，支持用户创建账号、添加项目、查看分布、统计费用等功能。

本文档仅介绍 **如何部署与运行项目**，不包含技术实现细节。

---

## 🚀 部署方式

本项目推荐使用 **Vercel** 进行部署，并依赖 **Upstash Redis** 作为数据存储、**Resend** 作为邮件服务。

---

## 1. 环境依赖

部署前请确保你具备以下条件：

- Node.js **18–20**  
- 一个 **Vercel 账号**（用于托管前端和 API）  
- 一个 **Upstash Redis 实例**（用于存储用户和项目数据）  
- 一个 **域名或 Vercel 站点地址** 用于配置 `PUBLIC_ORIGIN`  
- （可选）Resend 邮件服务账号（提升生产环境的注册体验）

---

## 2. 必须配置的环境变量

在 Vercel 中，进入：

> **Project → Settings → Environment Variables**

添加以下环境变量：

### 🟥 Upstash Redis（必填）

| 变量名 | 描述 |
|-------|------|
| `UPSTASH_REDIS_REST_URL` | Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Redis REST Token |

> 支持旧版变量 `UPSTASH_REST_URL`/`UPSTASH_REST_TOKEN`，但建议使用新名称。

---

### 🟥 安全校验（必填）

| 变量名 | 描述 |
|-------|------|
| `PUBLIC_ORIGIN` | 前端访问地址（只写 Origin，不带路径） |

示例：

```

[https://expense-timeline.vercel.app](https://expense-timeline.vercel.app)
[https://your-domain.com](https://your-domain.com)

````

---

### 🟧 邮件服务（可选但推荐）

如需注册/登录时正常发邮件：

| 变量名 | 描述 |
|-------|------|
| `RESEND_API_KEY` | Resend API Key |
| `EMAIL_FROM` | 发件人邮箱，如 `"Expense Timeline" <no-reply@your-domain.com>` |

未配置时开发环境会模拟发邮件，但生产环境会失败。

---

### 🟨 其它可选变量

| 变量名 | 作用 | 默认值 |
|--------|------|--------|
| `SESSION_TTL_DAYS` | 登录 Session 有效天数 | 7 天 |
| `ENABLE_DEBUG_API` | 是否启用调试 API | 关闭 |

---

## 3. 一键部署到 Vercel（推荐）

### ① 将项目推到 GitHub / GitLab / Bitbucket  
### ② 进入 Vercel → “New Project” → 导入该仓库  
### ③ 设置环境变量（见上方）  
### ④ 点击 **Deploy**

等待构建完成即可使用。

项目包含 `vercel.json`，会自动处理：

- 静态资源托管（`public`）
- `/api/*` 的后端接口
- 单页应用路由

---

## 4. 本地开发

### ① 克隆项目

```bash
git clone <your-repo-url> expense-timeline
cd expense-timeline
npm install
````

### ② 配置环境变量

方式 A：手动设置

```bash
export UPSTASH_REDIS_REST_URL=...
export UPSTASH_REDIS_REST_TOKEN=...
export PUBLIC_ORIGIN=http://localhost:3000
```

方式 B：使用 Vercel CLI（推荐）

```bash
npm i -g vercel
vercel link
vercel env pull .env.local
```

### ③ 启动本地开发环境

```bash
npm run dev
```

或：

```bash
vercel dev
```

访问：

```
http://localhost:3000
```

本地会完整模拟生产环境的 API 行为与前端展示。

---

## 5. 流程总结（快速版）

1. 创建 Upstash Redis
2. 在 Vercel 导入仓库
3. 添加 Redis、邮件、`PUBLIC_ORIGIN` 等环境变量
4. 点击 Deploy
5. 访问 Vercel 地址即可开始使用

---
