# Dedu-style Static Site (Chinese)

这是一个仿 **dedu-services** 风格的单页静态网站模板（纯 HTML + CSS），可以直接托管在 **GitHub Pages**。

## 本地预览
双击 `index.html` 即可在浏览器打开。

## 一键发布到 GitHub Pages
1. 在 GitHub 新建一个空仓库（例如 `duke-dedu-site`）。
2. 在你电脑上解压本项目，然后：
   ```bash
   cd duke-dedu-site
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<你的用户名>/duke-dedu-site.git
   git push -u origin main
   ```
3. 打开仓库 **Settings → Pages**：
   - **Source** 选择 **Deploy from a branch**
   - **Branch** 选择 `main`，`/ (root)`，保存。
4. 过一会儿，访问 `https://<你的用户名>.github.io/duke-dedu-site/` 即可预览。

> 若要自定义域名，前往 **Settings → Pages** 添加你的域名，并在域名 DNS 加一条 CNAME 到 `<你的用户名>.github.io`。

## 自定义
- 搜索 `Your Brand`、联系方式等占位文本，替换为你的内容。
- 想改配色：在 `<style>` 的 `:root{}` 里调整 `--accent` 等变量。
