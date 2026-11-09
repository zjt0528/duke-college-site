# 在线测试：Supabase 题库管理

本次升级支持**文字单选题**：管理员建立题库、导入新练习、预览核对答案并发布；学生按“题库 → 练习”选择。数据库负责审批、权限、评分、一次提交限制和成绩快照。页面不会接收正确答案，管理员导入预览除外。

## 已经在使用在线测试

在 Supabase **SQL Editor** 中执行完整的 [`migration_question_banks.sql`](migration_question_banks.sql)。该文件采用事务，可重复执行；保留原有题目 ID、练习名称、用户权限和成绩，将原题目归入“book reading vocabulary”。

此文件已合并题库升级和名称修改，**只需执行这一份，不必再执行 `migration_rename_legacy_bank.sql`**。已有旧默认名称的题库也会同步更名；管理员之后自行修改的名称不会因重跑迁移被覆盖。单独的更名文件仅保留作按需更名工具。

前提是之前已经执行了下列文件。如果不确定是否执行过，先运行以下**只读检查**，不要重跑 `setup.sql`：

```sql
select
  to_regclass('public.questions') as questions,
  to_regclass('public.test_access') as test_access,
  to_regprocedure('public.admin_get_submission(bigint)') as submission_detail,
  to_regprocedure('public.get_my_submissions()') as student_results;
```

迁移文件在缺少前置结构时会停止并提示，整个事务不会部分写入。

## 全新 Supabase 项目

按顺序执行：

1. `setup.sql`（仅首次，含四道示例题）。
2. `migration_link_users.sql`。
3. `migration_admin_access.sql`。
4. `migration_one_submission_results.sql`。
5. `migration_submission_detail.sql`。
6. `migration_question_banks.sql`。

在 Supabase 启用邮箱密码登录，并按实际网站地址配置 Auth 的 Site URL 和 Redirect URLs。网站注册自己的账号后，在 SQL Editor 将该账号设为管理员：

```sql
-- 将邮箱替换成你已注册的管理员邮箱。
insert into public.admins(user_id)
select id from auth.users where email = 'your-admin@example.com'
on conflict do nothing;
```

原来的 `questions_lg_r_rs_2a.sql` 到 `6a.sql` 只作旧版首次种子使用；升级后请使用网站题库管理。旧种子已移除清空题目的操作，并增加事务和重复检测；升级后运行旧种子会明确拒绝。无需再次运行这些文件来新增题库。

## 网站操作

发布静态网站时，需一起部署 `index.html`、`test.js` 和新的 `test-bank-manager.js`。无构建步骤，也不要上传开发用的 `node_modules`。

1. 管理员登录在线测试，点击“题库管理”。
2. 选择“新建题库”，填写名称和简介并保存。系统自动生成内部编号，无需填写；新题库是草稿。
3. 下载 JSON 模板，整理 PDF 中的题目、选项和答案，上传 JSON 或粘贴内容。
4. 点击“校验并预览”，展开练习核对题目和正确答案，再勾选确认并导入。
5. 点击“发布题库”。学生仍须管理员审批，并拥有对应练习权限；原来设置“全部练习”的学生可看到新发布的题库。

中文界面使用中文题库/练习名称，英文界面使用英文名称；某一种名称未填时显示另一种名称。题目内容保留 PDF 原文，不随界面语言自动翻译。

## PDF 和导入格式

当前没有自动 PDF 识别服务。将 PDF 发到本聊天，或放进项目文件夹并提供文件名，可进一步整理成可导入 JSON。扫描版、跨页题目及图片题需要逐题核对；当前题型不包含图片选项、填空或多选。若 PDF 没有答案页，需要提供或确认答案，不能把推测答案当作原始答案。

示例仅说明格式，不是本次新增的实际题库：

```json
{
  "worksheets": [
    {
      "code": "unit-1",
      "title_zh": "阅读练习一",
      "title_en": "Reading practice 1",
      "grade": "G3",
      "questions": [
        {
          "prompt": "Which word is a noun?",
          "choices": ["quickly", "happiness", "blue", "quietly"],
          "correct_index": 1
        }
      ]
    }
  ]
}
```

- `correct_index` 从 0 开始：A=0、B=1、C=2、D=3。
- 编号最多 64 个字符，只用小写字母、数字和连字符，首位是字母或数字。练习编号在一个题库内唯一。
- 每次导入 1–100 个练习、合计不超过 1000 道题；每道题 2–10 个非空文字选项。
- 题面最多 20000 个字符，单个选项最多 2000 个，名称最多 160 个，年级最多 32 个。
- 共享阅读材料应放进各题 `prompt`，可用 `\n` 换行。导入预览按纯文本展示。
- 仅对草稿题库新增练习；重复导入相同编号会整体拒绝，不会重复题目或覆盖原题。
- 需要修正尚未使用的草稿练习时，可在 SQL Editor 用下方调用删除该练习，再重新导入。已有提交的练习禁止删除；改版请用新编号保留历史。

```sql
-- SQL Editor 没有当前登录用户。模拟已验证的管理员仅供数据库所有者使用。
-- 通常应通过已登录的管理页面调用 RPC；删除草稿可由开发者在可信会话执行：
-- select public.admin_delete_draft_worksheet('reading-g3:unit-1');
```

## 数据与接口

- `test_question_banks`：题库编号、中英文名称/简介、发布状态。
- `test_worksheets`：练习与题库关系、显示名称、年级、顺序。历史 `subject` 原值保持不变；新练习的标识为 `题库编号:练习编号`。
- `questions`：保留原表和 ID，增加练习外键、单选题有效性约束及查询索引。
- `submissions.question_snapshot`：新提交时的题面、选项、答案和学生选择；管理员历史详情优先读取快照。

迁移前的提交没有快照，仍根据旧题表回查；已被删除或修改的历史题目无法从现有数据恢复。迁移不会删除或“修复”旧数据；历史无效题目会在提交或重新发布时提示校验失败，需要核对后处理。

保留 `get_questions(p_subject)`、`submit_test(...)`、原有用户审批和成绩 RPC，新增 `get_test_catalog()` 及题库管理 RPC。学生先加载目录，再按练习获取题目，避免一次下载全部题库。新版页面在数据库升级前可回退到旧题目加载方式；题库管理需要先运行迁移。

每个管理 RPC 在数据库内检查管理员身份；底表启用 RLS，禁止客户端直接读取正确答案或成绩表。函数显式限制执行权限，固定 `search_path`。相关设计依据：[Supabase 数据库函数](https://supabase.com/docs/guides/database/functions)、[RLS 文档](https://supabase.com/docs/guides/database/postgres/row-level-security)。前端只使用现有公开 anon key；不要在静态网页中添加 service role key 或数据库密码。

## 本地验证

```powershell
npm ci --ignore-scripts
npm test
```

测试在内存中的 PGlite PostgreSQL 中运行迁移，使用模拟的 Supabase Auth 表和角色；覆盖升级、导入事务、重复拦截、匿名/学生权限、评分和快照，并以 DOM 测试检查页面交互。不会连接线上 Supabase。线上实际结构和项目配置仍需在执行迁移后验证。
