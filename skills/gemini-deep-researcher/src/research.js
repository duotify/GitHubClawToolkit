import { GoogleGenAI } from "@google/genai";

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_TIME_MS = 600000; // 10 minutes

function buildPrompt(topic) {
  return `請針對以下主題進行深度研究，並產出一份結構完整的繁體中文（zh-TW）研究報告。

主題：${topic}

報告需包含：
1. **摘要** — 200 字以內的研究重點摘要
2. **背景** — 主題的背景脈絡與重要性
3. **主要發現** — 研究過程中發現的關鍵資訊（至少 3 點）
4. **分析** — 對主要發現的深入分析與比較
5. **結論與建議** — 根據研究結果的結論與可行建議
6. **參考來源** — 所有引用的來源連結

規則：
- 全文使用繁體中文（zh-TW）
- 所有事實陳述必須附上來源
- 使用 Markdown 格式
- 保持客觀中立的語調`;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8").trim();
}

async function getTopic() {
  const args = process.argv.slice(2);
  if (args.length > 0) {
    return args.join(" ");
  }
  if (!process.stdin.isTTY) {
    const input = await readStdin();
    if (input) return input;
  }
  console.error("錯誤：請提供研究主題。");
  console.error("用法：node scripts/research.js \"研究主題\"");
  process.exit(1);
}

async function main() {
  const topic = await getTopic();
  const prompt = buildPrompt(topic);

  // Dry-run mode
  if (process.env.DEEP_RESEARCHER_DRY_RUN === "1") {
    const preview = {
      agent: "deep-research",
      background: true,
      prompt,
      topic,
      note: "Dry-run mode — 不會呼叫 Gemini API",
    };
    process.stdout.write(JSON.stringify(preview, null, 2) + "\n");
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("錯誤：請設定 GEMINI_API_KEY 或 GOOGLE_API_KEY 環境變數。");
    process.exit(1);
  }

  const client = new GoogleGenAI({ apiKey });

  // 1. Start the background research
  console.error("正在啟動深度研究...");
  const initialResponse = await client.interactions.create({
    agent: "deep-research",
    input: prompt,
    background: true,
  });

  const interactionId = initialResponse.id;
  console.error(`研究任務已建立（ID: ${interactionId}），等待完成...`);

  // 2. Poll until complete
  let elapsed = 0;

  while (elapsed < MAX_POLL_TIME_MS) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    elapsed += POLL_INTERVAL_MS;

    const status = await client.interactions.get(interactionId);

    if (status.status === "completed") {
      if (status.output) {
        for (const part of status.output) {
          if (part.type === "text" && part.text) {
            process.stdout.write(part.text);
          }
        }
        process.stdout.write("\n");
      }
      console.error("研究完成！");
      return;
    }

    if (status.status === "failed") {
      throw new Error(
        `研究任務失敗：${status.error?.message || "未知錯誤"}`,
      );
    }

    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    console.error(`等待中... (${minutes}m${seconds}s)`);
  }

  throw new Error(
    `研究任務逾時（超過 ${MAX_POLL_TIME_MS / 60000} 分鐘）`,
  );
}

main().catch((err) => {
  console.error(`錯誤：${err.message}`);
  process.exit(1);
});
