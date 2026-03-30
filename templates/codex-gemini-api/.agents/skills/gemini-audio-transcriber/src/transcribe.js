#!/usr/bin/env node
/**
 * Audio Transcriber Tool
 *
 * Uses Gemini Interactions API to transcribe audio into Traditional Chinese.
 * Supports speaker diarization when multiple speakers are detected.
 *
 * Usage:
 *   node scripts/transcribe.js <audio-path-or-url>
 *
 * Required environment variable:
 *   GEMINI_API_KEY — your Gemini API key
 */

import { GoogleGenAI } from "@google/genai";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MIME_TYPES = {
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".webm": "audio/webm",
  ".wma": "audio/x-ms-wma",
};

function printUsage() {
  console.error("用法：node scripts/transcribe.js <audio-path-or-url>");
  console.error("");
  console.error("範例：");
  console.error(
    '  node scripts/transcribe.js "https://example.com/audio/meeting.mp3"'
  );
  console.error('  node scripts/transcribe.js "./recordings/meeting.m4a"');
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
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || "audio/mpeg";
}

async function resolveAudioInput(rawInput) {
  if (!rawInput) {
    throw new Error("需要提供音訊 URL 或本機檔案路徑。");
  }

  if (isDataUri(rawInput)) {
    return {
      source: "data-uri",
      uri: rawInput,
      mimeType: rawInput.match(/^data:([^;]+);base64,/)?.[1] || "audio/mpeg",
    };
  }

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
      throw new Error(
        `無法讀取本機音訊檔案 "${resolvedPath}"：${error.message}`
      );
    }
  }

  if (isRemoteUrl(rawInput)) {
    return {
      source: "remote-url",
      uri: rawInput,
      mimeType: getMimeType(rawInput),
    };
  }

  throw new Error(
    `輸入既非可讀取的本機檔案，也非有效的音訊 URL：${rawInput}`
  );
}

async function main() {
  const rawInput = process.argv[2];
  if (!rawInput) {
    console.error("錯誤：需要提供音訊 URL 或本機檔案路徑。");
    printUsage();
    process.exit(1);
  }

  const audioInput = await resolveAudioInput(rawInput);

  if (process.env.AUDIO_TRANSCRIBER_DRY_RUN === "1") {
    process.stdout.write(
      `${JSON.stringify(
        {
          source: audioInput.source,
          mimeType: audioInput.mimeType,
          localPath: audioInput.localPath || null,
          uriPreview:
            audioInput.source === "local-file" ||
            audioInput.source === "data-uri"
              ? `${audioInput.uri.slice(0, 48)}...`
              : audioInput.uri,
        },
        null,
        2
      )}\n`
    );
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("錯誤：需要設定 GEMINI_API_KEY 環境變數。");
    console.error("請先設定：export GEMINI_API_KEY=your_api_key");
    process.exit(1);
  }

  const client = new GoogleGenAI({ apiKey });

  console.error(`正在分析音訊：${rawInput}`);
  console.error("請稍候，Gemini 正在處理音訊...\n");

  const stream = await client.interactions.create({
    model: "gemini-3-flash-preview",
    input: [
      {
        type: "text",
        text: [
          "請仔細聆聽這段音訊內容，並完成以下任務：",
          "",
          "1. 將所有語音內容轉錄為繁體中文逐字稿",
          "2. 如果音訊中有多位說話者，請用「說話者 A」「說話者 B」等標記區分每位說話者的發言",
          "3. 保留語意完整，不遺漏重要內容",
          "4. 如果音訊品質不佳導致某段無法辨識，請用「[無法辨識]」標記",
          "5. 輸出格式為繁體中文 Markdown",
          "",
          "請直接輸出逐字稿內容，不需要額外的前言或說明。",
        ].join("\n"),
      },
      {
        type: "audio",
        uri: audioInput.uri,
        mime_type: audioInput.mimeType,
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
