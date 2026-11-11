本文件夹按用户提供的 2a/2b 答案图片转录。用户已确认：2a 图片中的 25/26 为笔误，已按 16/21 处理。
*-answer-key.json 是已有题目的批量改答案文件，不是新增题目导入文件。
*-corrected.json 是完整题目 JSON，仅供备份或导入到新题库，不要向原题库重复导入。
changes.csv 比较的是本地旧 JSON，不代表线上实际差异。尚未修改线上数据库。

重点冲突（本次严格依用户答案表填写，不自行改回推导答案）：
- 2a6 第1题 barely：表格选 C（sometimes），按词义应为 A（hardly）。
- 2a24 第8题正确拼写：表格选 C（borring），按拼写应为 B（moving）。

使用 2a-2b-answer-key.json 可一次修改两册，共48套、720题。先执行 supabase/migration_edit_answers.sql 并部署修改后的 test-bank-manager.js，在网站选择相应草稿题库，使用“批量修改答案”上传本文件、核对并勾选保存。不要使用“导入选择题”入口处理答案修改文件。
