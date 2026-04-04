# LINEBotWorker

LINE webhook worker 的核心程式。收到 LINE 事件後，會把對話留言到指定的 GitHub issue；如果沒有固定 `ISSUE_NUMBER`，就會依 LINE source 自動找或建立唯一 issue，並把媒體檔存到該 issue 專屬 branch。

## 功能

- 驗證 `X-Line-Signature`
- 可固定綁定單一 GitHub issue，或依 LINE source 自動綁定唯一 issue
- 所有 LINE 事件都留言到綁定 issue，並清楚標示 `group` / `room` / `user` 來源
- 支援 `follow`、`join`、`text`、`image`、`audio`、`video`、`file`
- 圖片與影片在 issue / comment 內直接顯示預覽
- `sticker` 事件直接忽略
- 如果設定了 `LINE_DEFAULT_REPLY_MESSAGE`，會直接用 reply token 回一則固定訊息
- `GET /status` 可查看這支 Worker 目前綁定的 GitHub issue

## 結構

```text
LINEBotWorker/
├── scripts/
├── src/
│   ├── application/     use case / orchestration
│   ├── domain/          純規則與格式化
│   ├── infrastructure/  LINE / GitHub / config adapters
│   └── presentation/    HTTP entrypoint
├── test/
├── wrangler.jsonc
└── package.json
```

## Build 與測試

```sh
cd workers/line-bot
bun install
bun run build
WORKER_NAME=your-worker-name bun run dev
WORKER_NAME=your-worker-name bun run set
WORKER_NAME=your-worker-name bun run deploy
bun run test
```

- `bun run build` 會把 `src/index.js` bundle 成 `dist/index.mjs`
- `bun run dev` / `bun run deploy` 需要傳入 `WORKER_NAME`
- `bun run set` 需要傳入 `WORKER_NAME`，會把 `.dev.vars` 用 `wrangler secret bulk` 寫進指定 Worker
- `bun run test` 或 `node --test` 都可以直接執行 worker 邏輯測試
- `WORKER_NAME` 會先正規化：無效字元改成 `-`、連續 `-` 會合併、開頭結尾的 `-` 會移除
- 因為 `wrangler.jsonc` 目前啟用 `workers_dev`，`WORKER_NAME` 正規化後仍必須在 63 字元以內，且只能包含英數字元與 `-`

這個資料夾現在只保留最基本的 Cloudflare Worker 部署設定；執行時需要的環境值不再寫在 `wrangler.jsonc`。

## 必要環境變數

- `CLAW_SYS_GITHUB_TOKEN`
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`

可選：

- `ISSUE_NUMBER`
- `DEFAULT_UTC_OFFSET`
- `LINE_DEFAULT_REPLY_MESSAGE`
- `GITHUB_API_BASE_URL`
- `GITHUB_API_VERSION`
- `LINE_API_BASE_URL`
- `LINE_DATA_API_BASE_URL`
- `LINE_WEBHOOK_PATH`

補充：

- 本地開發請把值放在 `.dev.vars`
- 部署到 Cloudflare 時可直接執行 `WORKER_NAME=your-worker-name bun run set`
- `wrangler.jsonc` 的 `vars` 目前只保留這些固定 API / webhook 預設值
- webhook 路徑固定是 `/line/webhook`
- `CLAW_SYS_GITHUB_TOKEN` 需要 `Issues: read/write` 與 `Contents: read/write`
- `ISSUE_NUMBER` 有值時會固定留言到該 issue；沒有值時會依 `user` / `group` / `room` source 自動找或建立唯一 issue
- `LINE_WORKER_NAME` 不是環境變數，會直接用 `GITHUB_OWNER` / `GITHUB_REPO` 組成，並套用相同的 Worker 名稱正規化規則
- `LINE_DEFAULT_REPLY_MESSAGE` 會在事件可使用 reply token 時直接回覆一則固定訊息

## 輸出入口

Worker 入口是 `src/index.js`，預設 export 仍然是 worker handler：

```js
import worker from './src/index.js';

const response = await worker.fetch(request, env, ctx);
```

可用路徑：

- `POST /line/webhook`
- `GET /health`
- `GET /status`

## 媒體存放

- 每個綁定的 issue 會使用自己的 branch：`issue-<ISSUE_NUMBER>`
- 檔案會存到：`workspaces/issue-<ISSUE_NUMBER>/line`
- issue / comment 會寫入 branch 與 repo path
