# mimo-view H5 · 全场景语音助手（纯前端）

微信小程序版的 H5 复刻版。单页面语音助手，调用小米 MiMo 的 ASR / 大模型 / TTS，
**纯前端、无后端、无需审核**，部署到 HTTPS 后扫码即用。

## 功能

- 🎤 **语音问答**：按住麦克风说话 → ASR 转写 → 大模型回答（文字气泡）→ TTS 语音播报
- 📷 **全场景模式**：点摄像头开启实时预览，按住麦克风边看画面边提问（截当前帧 + 语音一起问）
- 🔊 左上角音量按钮：开关语音播报
- ↻ 重置 / ✕ 关闭

## 目录

```
h5/
├── index.html
├── css/style.css
├── js/
│   ├── config.js    ⭐ 填 API Key / 模型 / 音色
│   ├── api.js       # fetch 调 chat / asr / tts
│   ├── recorder.js  # MediaRecorder 录音
│   ├── camera.js    # getUserMedia 摄像头 + canvas 截帧
│   └── app.js       # 主流程与交互
└── images/basicprofile.jpeg
```

## 本地运行

浏览器出于安全限制，摄像头/麦克风只在 **HTTPS 或 localhost** 下可用。本地起一个静态服务：

```bash
cd h5
python3 -m http.server 8000
# 打开 http://localhost:8000
```

> localhost 被视为安全来源，可用麦克风/摄像头。局域网 IP（如 192.168.x.x）不行，必须 HTTPS。

## 部署（扫码即用）

部署到任意支持 HTTPS 的静态托管，把 `h5/` **目录内容作为站点根**（index.html 要在根）：

### 方式一：Gitee Pages（推荐，国内访问快）

> 本项目已针对 Gitee Pages 调整：资源全部相对路径，含 `.nojekyll`，`h5/` 可直接作为仓库根。

1. **实名认证**：Gitee Pages 需先完成账号实名认证。
2. **新建仓库**：在 Gitee 新建一个仓库（⚠️ 建议设为「私有」，因为 `js/config.js` 含 API Key）。
3. **上传 h5 内容到仓库根**（注意是 `h5/` 里的文件放到仓库根，不是把 `h5` 文件夹整个放进去）：
   ```bash
   cd h5
   git init
   git add -A
   git commit -m "mimo-view h5"
   git remote add origin https://gitee.com/你的用户名/你的仓库名.git
   git branch -M master
   git push -u origin master
   ```
   push 后仓库根应能看到 `index.html`、`css/`、`js/`、`images/`。
4. **开启 Pages**：仓库页面 → 服务 → Gitee Pages → 部署目录选 `/`（根）→ 启动。
5. 得到 `https://你的用户名.gitee.io/仓库名/` 的 HTTPS 地址，生成二维码扫码打开。
6. **每次改代码 push 后，回到 Gitee Pages 页面点「更新」**（不会自动更新）。

### 方式二：Vercel / Netlify

把 `h5` 目录拖进去，自动分配 https 域名（海外访问更快）。


## ⚠️ 现场演示注意（重要）

1. **必须 HTTPS**：扫码链接是 `https://`，否则摄像头/麦克风无法使用。
2. **建议用系统浏览器打开**：微信内置浏览器（尤其 iOS）对 `getUserMedia` 支持差。
   页面已在微信内给出提示，引导点右上角「在浏览器打开」。用 **Safari / Chrome** 最稳。
3. **录音格式**：
   - Safari 录 `m4a`（ASR 支持）✅
   - Chrome 多为 `webm`（ASR 不支持）→ 会提示“请改用 Safari 打开”。
   - 演示优先用 **iPhone Safari**。
4. **API Key 暴露**：纯前端 Key 写在 `config.js`，任何人可在浏览器开发者工具看到。
   - Gitee 仓库请设为**私有**，避免 Key 在公网仓库泄露；
   - Pages 页面本身的 JS 仍可被访问者看到 Key，这是纯前端固有限制，仅限 Demo；
   - 演讲结束后尽快**停用或轮换**该 Key。
5. **首次使用会弹权限框**：允许麦克风/摄像头后才能用。建议演示前自己先跑一遍授权。

## 配置

编辑 `js/config.js`：

| 字段 | 说明 |
| --- | --- |
| `API_KEY` | 你的 mimo API Key |
| `BASE_URL` | 接口地址 |
| `MODEL` / `ASR_MODEL` / `TTS_MODEL` | 三个模型名 |
| `TTS_VOICE` | 音色（默认 Chloe） |
| `ENABLE_TTS` | 是否默认开启语音播报 |
