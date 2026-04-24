#!/usr/bin/env node
"use strict";

/**
 * Gemini Lyria-3 音樂生成 CLI（零依賴）
 *
 * 環境變數：
 *   GEMINI_API_KEY  — Google Gemini API 金鑰（必填）
 *   PROMPT_FILE     — 含歌詞或提示詞的文字檔路徑（必填）
 *   ISSUE_DIR       — 音訊輸出目錄（必填）
 *   NAME_PREFIX     — 輸出檔案名稱前綴（選填，預設：track）
 *   LYRIA_MODEL / MODEL — 使用的模型（選填，預設：lyria-3-pro-preview）
 */

const { mkdir, readFile, writeFile } = require("node:fs/promises");
const path = require("node:path");

const MIME_TO_EXT = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/wav": "wav",
  "audio/wave": "wav",
  "audio/ogg": "ogg",
  "audio/flac": "flac",
  "audio/webm": "webm",
};

function mimeToExt(mimeType) {
  const normalized = (mimeType || "audio/mpeg").toLowerCase().split(";")[0].trim();
  return MIME_TO_EXT[normalized] ?? "mp3";
}

async function main() {
  const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();
  if (!apiKey) throw new Error("缺少 GEMINI_API_KEY");

  const promptFile = process.env.PROMPT_FILE;
  if (!promptFile) throw new Error("缺少 PROMPT_FILE 環境變數");

  const issueDir = process.env.ISSUE_DIR;
  if (!issueDir) throw new Error("缺少 ISSUE_DIR 環境變數");

  const namePrefix = process.env.NAME_PREFIX || "track";
  const model =
    process.env.LYRIA_MODEL || process.env.MODEL || "lyria-3-pro-preview";

  const lyrics = (await readFile(promptFile, "utf8")).trim();
  if (!lyrics) throw new Error(`${promptFile} 內容為空，無法生成音樂`);

  const resolvedIssueDir = path.resolve(issueDir);
  await mkdir(resolvedIssueDir, { recursive: true });

  if (typeof fetch !== "function") {
    throw new Error("Global fetch is unavailable. Use Node.js 18+.");
  }

  console.error(`使用模型 ${model} 生成音軌，提示詞長度 ${lyrics.length} 字元`);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: lyrics }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
      },
    }),
  });

  const body = await response.text();
  let json = null;
  try {
    json = JSON.parse(body);
  } catch {
    // keep raw body for debugging
  }

  if (!response.ok) {
    throw new Error(
      `Gemini API error ${response.status}: ${json ? JSON.stringify(json, null, 2) : body}`
    );
  }

  const candidates = Array.isArray(json?.candidates) ? json.candidates : [];
  let idx = 0;
  const savedFiles = [];

  for (const candidate of candidates) {
    for (const part of candidate?.content?.parts ?? []) {
      const blob = part.inlineData || part.inline_data;
      if (!blob?.data) continue;

      const ext = mimeToExt(blob.mimeType || blob.mime_type);
      const filename = `${namePrefix}-${idx++}.${ext}`;
      const filepath = path.join(resolvedIssueDir, filename);

      await writeFile(filepath, Buffer.from(blob.data, "base64"));

      const relativePath = path.relative(process.cwd(), filepath);
      savedFiles.push(relativePath);
      console.log(`Saved: ${relativePath}`);
    }
  }

  if (savedFiles.length === 0) {
    throw new Error("API 未回傳任何音訊資料，請確認模型與 API Key 設定");
  }

  console.error(`共生成 ${savedFiles.length} 個音軌檔案`);

  // 輸出 result.md 用的 backtick 路徑與 githubclaw-artifacts metadata block
  const branch = (process.env.BRANCH || "").trim();
  const audioEntries = savedFiles.map((p) => {
    const normalized = p.replace(/\\/g, "/").replace(/^\.\//, "");
    const branchValue = branch || "<branch>";
    return `{"branch":"${branchValue}","path":"${normalized}"}`;
  });

  console.log("\n=== 複製以下內容到 result.md ===");
  for (const p of savedFiles) {
    const normalized = p.replace(/\\/g, "/").replace(/^\.\//, "");
    console.log(`\`${normalized}\``);
  }
  console.log(
    `\n<!-- githubclaw-artifacts: {"audio":[${audioEntries.join(",")}],"html":[]} -->`
  );
  console.log("=================================");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.log(message);
  process.exitCode = 1;
});
