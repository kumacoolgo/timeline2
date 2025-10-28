# Timeline Minimal (Vercel + Upstash)

- `index.html`：单页前端。左侧选择项目，右侧渲染该项目时间轴。
- `/api`：登录/注册/Session 与 Items CRUD（Upstash Redis）。
- `vercel.json`：Node 运行时 + 静态前端路由。

## 环境变量
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `SESSION_TTL_DAYS`（可选，默认 30）
