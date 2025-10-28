# timeline-min

一个可在 Vercel + Upstash 上一键部署的极简时间轴 Demo：
- 离线可用（localStorage）
- 登录后云端同步（Upstash Redis）
- Redis Hash 存储每个 item（`items:<uid>`）
- PBKDF2+盐的安全密码哈希，HttpOnly Cookie 会话

## 环境变量（Vercel → Settings → Environment Variables）
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `SESSION_TTL_DAYS`（可选，默认 7）

部署后访问 `index.html` 即可。