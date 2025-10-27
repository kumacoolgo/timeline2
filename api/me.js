const { json, getUserIdBySession, redis } = require('./_utils');


module.exports = async (req, res) => {
const uid = await getUserIdBySession(req);
if (!uid) return json(res, { error: 'Unauthorized' }, 401);
// 反查 email（可选：为避免额外存储，实际不返回 email 也行）
// 这里按简单做法：在 Redis 扫描 user:email:* 查 uid，生产可另建索引映射
const prefix = 'user:email:';
// Upstash REST 没有传统 SCAN 直接接口，简化：不返 email，前端只关心是否登录
return json(res, { uid });
};