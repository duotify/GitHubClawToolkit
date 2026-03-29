#!/usr/bin/env node
/**
 * Image Describer Tool
 *
 * Uses Gemini Interactions API to analyze an image and produce
 * a Traditional Chinese (zh-TW) Markdown description including:
 * scene description, OCR text recognition, and key objects.
 *
 * Usage:
 *   node scripts/describe.js <image-path-or-url>
 *
 * Required environment variable:
 *   GEMINI_API_KEY — your Gemini API key
 */

import { GoogleGenAI } from "@google/genai";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MIME_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
};

function printUsage() {
  console.error("用法：node scripts/describe.js <image-path-or-url>");
  console.error("");
  console.error("範例：");
  console.error(
    '  node scripts/describe.js "https://example.com/photo.jpg"'
  );
  console.error('  node scripts/describe.js "./photos/screenshot.png"');
}

function isDataUri(value) {
  return value.startsWith("data:");
}

function isRemoteUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol !== "file:";
  } catch {
    return false;
  }
}

function getMimeType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || "image/png";
}

async function resolveImageInput(rawInput) {
  if (!rawInput) {
    throw new Error("需要提供圖片 URL 或本地檔案路徑。");
  }

  // Data URI — pass through
  if (isDataUri(rawInput)) {
    return {
      source: "data-uri",
      uri: rawInput,
      mimeType: rawInput.match(/^data:([^;]+);base64,/)?.[1] || "image/png",
    };
  }

  // Try local file first
  let localPath = rawInput;

  if (rawInput.startsWith("file://")) {
    localPath = fileURLToPath(rawInput);
  }

  const resolvedPath = path.resolve(localPath);

  try {
    const fileBuffer = await readFile(resolvedPath);
    const mimeType = getMimeType(resolvedPath);

    return {
      source: "local-file",
      uri: `data:${mimeType};base64,${fileBuffer.toString("base64")}`,
      mimeType,
      localPath: resolvedPath,
    };
  } catch (error) {
    if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") {
      throw new Error(`無法讀取本地圖片檔案 "${resolvedPath}": ${error.message}`);
    }
  }

  // Remote URL — verify reachability with 30s timeout
  if (isRemoteUrl(rawInput)) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(rawInput, {
        method: "HEAD",
        signal: controller.signal,
      });
      if (!res.ok) {
        console.error(`警告：遠端 URL 回應 HTTP ${res.status}，仍嘗試傳送給 Gemini。`);
      }
    } catch {
      console.error("警告：無法確認遠端 URL 是否可存取，仍嘗試傳送給 Gemini。");
    } finally {
      clearTimeout(timeout);
    }

    // Detect MIME from URL path, fallback to image/png
    let mimeType = "image/png";
    try {
      const urlPath = new URL(rawInput).pathname;
      mimeType = getMimeType(urlPath);
    } catch {
      // keep default
    }

    return {
      source: "remote-url",
      uri: rawInput,
      mimeType,
    };
  }

  throw new Error(`輸入既非可讀取的本地檔案，也非有效的圖片 URL：${rawInput}`);
}

async function main() {
  const rawInput = process.argv[2];
  if (!rawInput) {
    console.error("錯誤：需要提供圖片 URL 或本地檔案路徑。");
    printUsage();
    process.exit(1);
  }

  const imageInput = await resolveImageInput(rawInput);

  // Dry-run mode
  if (process.env.IMAGE_DESCRIBER_DRY_RUN === "1") {
    process.stdout.write(
      `${JSON.stringify(
        {
          source: imageInput.source,
          mimeType: imageInput.mimeType,
          localPath: imageInput.localPath || null,
          uriPreview:
            imageInput.source === "local-file" || imageInput.source === "data-uri"
              ? `${imageInput.uri.slice(0, 48)}...`
              : imageInput.uri,
        },
        null,
        2
      )}\n`
    );
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error(
      "錯誤：需要設定 GEMINI_API_KEY 環境變數。"
    );
    console.error(
      "請先設定：export GEMINI_API_KEY=your_api_key"
    );
    process.exit(1);
  }

  const client = new GoogleGenAI({ apiKey });

  console.error(`正在分析圖片：${rawInput}`);
  console.error("請稍候，Gemini 正在處理圖片...\n");

  const stream = await client.interactions.create({
    model: "gemini-3-flash-preview",
    input: [
      {
        type: "text",
        text: [
          "請仔細觀察這張圖片，並以繁體中文（zh-TW）Markdown 格式提供以下資訊：",
          "",
          "## 圖片描述",
          "描述圖片的整體場景和內容，包括環境、氛圍與主要活動。",
          "",
          "## 文字辨識（OCR）",
          "列出圖片中出現的所有可辨識文字。若無文字，請說明「圖片中未發現文字」。",
          "",
          "## 關鍵物件",
          "以條列方式列出畫面中的關鍵物件或元素。",
          "",
          "請確保輸出完整且結構清楚。",
        ].join("\n"),
      },
      {
        type: "image",
        uri: imageInput.uri,
        mime_type: imageInput.mimeType,
      },
    ],
    stream: true,
  });

  for await (const chunk of stream) {
    if (
      chunk.event_type === "content.delta" &&
      chunk.delta?.type === "text" &&
      chunk.delta.text
    ) {
      process.stdout.write(chunk.delta.text);
    }
  }

  process.stdout.write("\n");
}

main().catch((err) => {
  console.error(`錯誤：${err.message || err}`);
  process.exit(1);
});
