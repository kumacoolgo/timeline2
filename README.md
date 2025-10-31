# 费用时间轴 (Expense Timeline)

一个基于时间轴的可视化订阅、保修和费用跟踪器。

本项目使用 Vanilla JS、Vercel Serverless Functions 和 Upstash Redis 构建，实现了用户认证、项目管理以及一个动态生成的可视化时间轴，用于跟踪各项服务的起止、费用和特殊窗口期（如退会期）。

## ✨ 功能特性

* **用户认证**: 支持邮箱/密码注册、登录、登出和密码重置。
* **邮件验证**: 使用 Resend 服务发送注册和重置密码的验证码。
* **项目管理 (CRUD)**:
    * 添加、编辑、删除跟踪项目（套餐、保修、保险）。
    * 支持拖拽排序。
* **可视化时间轴**:
    * 动态计算并显示每个项目的时间轴（精确到月）。
    * 高亮显示当月。
    * 自动滚动到“本月”。
* **多类型支持**:
    * **套餐/保险**: 支持多阶段金额（如“第1-6个月免费，第7个月起￥1000”）。
    * **保修**: 支持“X个月保修期”。
    * **退会期**: 可视化标记“退会窗口”。
* **响应式设计**: 适配 PC 和移动端设备。
* **数据持久化**: 所有用户和项目数据均安全存储在 Upstash Redis 中。

## 🛠️ 技术栈

* **Frontend**: Vanilla JS (ES6+), HTML5, CSS3 (无框架)
* **Backend**: Vercel Serverless Functions (Node.js)
* **Database**: [Upstash](https://upstash.com/) (Redis)
* **Email Service**: [Resend](https://resend.com/)

---

## 🚀 如何部署 (Vercel)

你可以通过以下步骤在 Vercel 上免费部署你自己的版本。

### 1. 准备工作

* **克隆仓库**: 将本项目 Fork 或 Clone 到你自己的 GitHub/GitLab 账户。
* **Upstash (Redis) 账户**:
    1.  注册 [Upstash](https://upstash.com/)。
    2.  创建一个新的 **Global** Redis 数据库。
    3.  复制 `UPSTASH_REDIS_REST_URL` 和 `UPSTASH_REDIS_REST_TOKEN`。
* **Resend (Email) 账户**:
    1.  注册 [Resend](https://resend.com/)。
    2.  **添加并验证一个域名**（这是发送邮件所必需的）。
    3.  创建一个 API Key，复制 `RESEND_API_KEY`。
    4.  确定你的发件人邮箱地址 (例如 `noreply@your-domain.com`)，这将作为 `EMAIL_FROM`。

### 2. 部署到 Vercel

1.  登录 Vercel，选择 "Add New... -> Project"。
2.  导入你刚才 Fork/Clone 的 Git 仓库。
3.  在 "Environment Variables"（环境变量）部分，添加以下 **Secret**：

    * `UPSTASH_REDIS_REST_URL`: (来自 Upstash)
    * `UPSTASH_REDIS_REST_TOKEN`: (来自 Upstash)
    * `RESEND_API_KEY`: (来自 Resend)
    * `EMAIL_FROM`: (来自 Resend, 例如: `noreply@your-verified-domain.com`)
    * `SESSION_TTL_DAYS`: (可选, 默认值为 7)

4.  点击 "Deploy"。Vercel 会自动识别 `package.json` 并安装 `resend` 依赖，然后部署你的应用。

5.  部署完成后，访问你的 Vercel 域名即可开始使用！