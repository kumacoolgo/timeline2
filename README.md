# 费用时间轴 (Expense Timeline)

一个基于时间轴的可视化订阅、保修和费用跟踪器。

## ✨ 新增/优化
- **安全**：CSRF Cookie 在本地与生产自适应；统一 JSON 错误响应；严格 CSP/HSTS/安全头；默认关闭 `/api/debug`（`ENABLE_DEBUG_API=1` 才可用）。
- **前端**：移除内联脚本 → `app.js`；HTML5 DnD 实现列表排序；新增 **导入/导出**、**统计视图**；支持 **分类/标签/货币**；金额按货币自动格式化。
- **后端**：导入(`/api/import`) / 导出(`/api/export`)；每日提醒 **Cron**（`/api/cron-daily`，Bearer 鉴权）；注册时记录 `users:all` 以便 Cron 扫描。
- **API 严格性**：写操作启用 CSRF + Origin 白名单；Items 入参校验；限流在 429 时带 JSON 头。

## 🛠 技术栈
- Frontend: Vanilla JS + HTML5 + CSS
- Backend: Vercel Serverless (Node.js 18+)
- DB: Upstash Redis
- Email: Resend

## 🚀 部署
1. Fork/Clone 项目到 Git。
2. Vercel 新建 Project → 选择此仓库。
3. 配置环境变量（所有都为 **Plaintext**）：
   - `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
   - `RESEND_API_KEY` / `EMAIL_FROM`（可空，本地会“模拟发送”）
   - `PUBLIC_ORIGIN`（你的外网域名 origin，例如 `https://xxx.vercel.app`）
   - `SESSION_TTL_DAYS`（可选，默认 `7`）
   - （可选）`ENABLE_DEBUG_API=1`（仅测试环境使用）
   - （可选）`CRON_SECRET`（用于 `/api/cron-daily` 的 Bearer 鉴权）
   - （可选）`REMIND_DAYS_AHEAD`（默认 `3`）
4. 点击 Deploy。

> **Cron 提醒**：本仓库 `vercel.json` 已包含一个 09:00(UTC) 的计划任务。  
> 在 Vercel 的 Project → Settings → Cron Jobs 中确认已生效，并在 Cron Job 的 “Headers” 里配置：  
> `Authorization: Bearer <你的 CRON_SECRET>`。

## 🧭 使用
- 登录/注册后，添加「套餐 / 保修 / 保险」项目，支持：阶段单价、退会期、保修期、保期。
- 左侧拖动可排序（桌面浏览器支持原生拖拽）。
- 顶部支持搜索（含名称/类型/编号/分类/标签），可导出 JSON、导入 JSON。
- 「统计」会展示未来 12 个月的各币种合计与按分类汇总。

## 🛡️ 安全说明
- 会话 Cookie：`HttpOnly` + `SameSite=Strict`（生产强制 `Secure`）
- CSRF：生产 `__Host-csrf`，本地 `csrf`；写操作需要携带 `X-CSRF-Token`
- Origin 白名单：写操作校验 `PUBLIC_ORIGIN`
- 限流：登录/发码/写入/全局等多路由限流
- 安全头：CSP/HSTS/XFO/ReferrerPolicy/Permissions-Policy/NoSniff

---
