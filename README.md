# Timeline（费用 & 保修管理时间轴）

单文件前端 + Vercel Serverless + Upstash Redis（Hash 版）。多用户、登录/注册、可拖拽排序、离线本地可用。

## 部署
1. 在 Upstash 建 Redis，拿 `UPSTASH_REDIS_REST_URL` 和 `UPSTASH_REDIS_REST_TOKEN`。
2. 推到 GitHub，导入到 Vercel。
3. 在 Vercel 的 Environment Variables 设置上述两个变量（可选：`SESSION_TTL_SECONDS`）。
4. 部署。

## API
- `POST /api/register` { email, password }
- `POST /api/login` { email, password }
- `POST /api/logout`
- `GET  /api/me` => { uid, email }
- `GET  /api/items` => [items...]
- `POST /api/items` => upsert 一个 item
- `DELETE /api/items?id=...` => 删除

## Item 结构
```json
{
  "id": "it_xxx",
  "type": "plan|insurance|warranty",
  "name": "乐天1",
  "number": "070...",
  "startDate": "2025-05-01",
  "notes": "",
  "billingDay": 1,
  "pricePhases": [{"fromMonth":1,"amount":1000}],
  "cancelWindows": [{"fromMonth":25,"toMonth":26}],
  "warrantyMonths": 24,
  "sort": 0,
  "createdAt": 1730000000000
}
```
