# Timeline (single-selected)

- 顶部是项目列表（最多展示 3 行，上滚动查看更多）
- 点击一行后，下方时间轴**只显示该项目**。
- 支持 Vercel + Upstash，无数据库即可登录同步。

## 环境变量（Vercel → Project → Settings → Environment Variables）
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `SESSION_TTL_DAYS` （可选，默认 30）

## 部署
1. 把本仓库推到 GitHub
2. Vercel Import → 选择本仓库
3. 配好上面三个变量 → Redeploy
