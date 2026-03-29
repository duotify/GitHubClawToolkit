#!/usr/bin/env node
/**
 * Unified Summary Tool
 *
 * Auto-detects input type (URL / PDF / Video) and produces a
 * structured Traditional Chinese Markdown summary using Gemini.
 *
 * Usage:
 * node scripts/summarize.js <url-or-file>
 * node scripts/summarize.js --type url|pdf|video <input>
 */

import { GoogleGenAI } from "@google/genai";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODELS = {
  url: "gemini-3-flash-preview",
  pdf: "gemini-3-flash-preview",
  video: "gemini-3-flash-preview",
  audio: "gemini-3-flash-preview",
};

const MAX_CONTENT_LENGTH = 120_000;
const MIN_CONTENT_LENGTH = 200;
const FETCH_TIMEOUT_MS = 30_000;

const VIDEO_EXTENSIONS = new Set([
  ".3gp", ".avi", ".m4v", ".mkv", ".mov",
  ".mp4", ".mpeg", ".mpg", ".ogv", ".webm",
]);

const VIDEO_MIME_TYPES = {
  ".3gp": "video/3gpp",
  ".avi": "video/x-msvideo",
  ".m4v": "video/x-m4v",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".mpeg": "video/mpeg",
  ".mpg": "video/mpeg",
  ".ogv": "video/ogg",
  ".webm": "video/webm",
};

const YOUTUBE_HOSTS = new Set([
  "youtube.com", "www.youtube.com", "m.youtube.com",
  "youtu.be", "www.youtu.be",
]);

const AUDIO_EXTENSIONS = new Set([
  ".mp3", ".wav", ".aac", ".ogg", ".flac", ".m4a", ".aiff", ".wma", ".opus",
]);

const AUDIO_MIME_TYPES = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".aiff": "audio/aiff",
  ".wma": "audio/x-ms-wma",
  ".opus": "audio/opus",
};

// ---------------------------------------------------------------------------
// Shared Utilities
// ---------------------------------------------------------------------------

function printUsage() {
  console.error("用法：node scripts/summarize.js [--type url|pdf|video|audio] <input>");
  console.error("");
  console.error("範例：");
  console.error('  node scripts/summarize.js "https://example.com/post/123"');
  console.error('  node scripts/summarize.js "./reports/quarterly.pdf"');
  console.error('  node scripts/summarize.js "https://youtu.be/abc123"');
  console.error('  node scripts/summarize.js "./recording.mp3"');
}

function ensureApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "缺少 GEMINI_API_KEY。請先執行 export GEMINI_API_KEY=your_api_key"
    );
  }
  return apiKey;
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function trimContent(value, maxLength = MAX_CONTENT_LENGTH) {
  const normalized = normalizeText(value);
  if (normalized.length <= maxLength) {
    return { text: normalized, truncated: false };
  }
  return {
    text: `${normalized.slice(0, maxLength)}\n\n[內容因長度限制已截斷]`,
    truncated: true,
  };
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`抓取逾時（${FETCH_TIMEOUT_MS / 1000} 秒）：${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function isRemoteUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function streamInteraction(stream) {
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

// ---------------------------------------------------------------------------
// Input Type Detection
// ---------------------------------------------------------------------------

function parseCliArgs() {
  const args = process.argv.slice(2);
  let type = null;
  let input = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--type" && i + 1 < args.length) {
      type = args[++i];
      if (!["url", "pdf", "video", "audio"].includes(type)) {
        throw new Error(`不支援的類型：${type}（可用：url, pdf, video, audio）`);
      }
    } else if (!input) {
      input = args[i];
    }
  }

  return { type, input };
}

function detectInputType(input) {
  if (!input) throw new Error("請提供輸入（URL 或檔案路徑）。");

  // data: URI → video
  if (input.startsWith("data:")) return "video";

  // URL-based detection
  if (isRemoteUrl(input)) {
    try {
      const url = new URL(input);
      const pathname = url.pathname.toLowerCase();

      // PDF URL
      if (pathname.endsWith(".pdf")) return "pdf";

      // Video URL
      const ext = path.extname(pathname);
      if (VIDEO_EXTENSIONS.has(ext)) return "video";

      // Audio URL
      if (AUDIO_EXTENSIONS.has(ext)) return "audio";

      // YouTube
      if (YOUTUBE_HOSTS.has(url.hostname)) return "video";

      // Default: treat as web page
      return "url";
    } catch {
      return "url";
    }
  }

  // Local file detection
  let localPath = input;
  if (input.startsWith("file://")) localPath = fileURLToPath(input);
  const ext = path.extname(localPath).toLowerCase();

  if (ext === ".pdf") return "pdf";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  if (AUDIO_EXTENSIONS.has(ext)) return "audio";

  throw new Error(
    `無法辨識輸入類型：${input}。支援的格式：網頁 URL、.pdf 檔案、影片檔案（${[...VIDEO_EXTENSIONS].join(", ")}）、音訊檔案（${[...AUDIO_EXTENSIONS].join(", ")}）`
  );
}

// ---------------------------------------------------------------------------
// URL Handler
// ---------------------------------------------------------------------------

async function fetchHtml(url) {
  const response = await fetchWithTimeout(url, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "GitHubClawDev/summary (+https://github.com/rewq0494/GitHubClawDev)",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(
      `抓取網址失敗：${url}（HTTP ${response.status} ${response.statusText}）`
    );
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/pdf")) {
    return { __pdfFallback: true };
  }
  if (
    !contentType.includes("text/html") &&
    !contentType.includes("application/xhtml+xml")
  ) {
    throw new Error(
      `網址不是可解析的 HTML 頁面：${url}（Content-Type: ${contentType || "unknown"}）。若為 PDF，請改用 --type pdf`
    );
  }
  return response.text();
}

function extractFromBody(document) {
  const root = document.querySelector("main, article, body");
  const title =
    normalizeText(document.querySelector("title")?.textContent || "") ||
    "未命名頁面";
  const siteName =
    normalizeText(
      document
        .querySelector('meta[property="og:site_name"]')
        ?.getAttribute("content") || ""
    ) || null;
  return {
    title,
    siteName,
    byline: null,
    excerpt: null,
    content: normalizeText(root?.textContent || ""),
    source: "body-fallback",
  };
}

function extractArticle(html, url) {
  const { document, window } = parseHTML(html);
  if (window?.document && !window.document.location) {
    window.document.location = new URL(url);
  }
  const article = new Readability(document).parse();
  if (!article?.textContent) return extractFromBody(document);

  return {
    title: normalizeText(article.title) || "未命名頁面",
    siteName: normalizeText(article.siteName || "") || null,
    byline: normalizeText(article.byline || "") || null,
    excerpt: normalizeText(article.excerpt || "") || null,
    content: normalizeText(article.textContent),
    source: "readability",
  };
}

function buildUrlPrompt({
  url,
  title,
  siteName,
  byline,
  excerpt,
  content,
  truncated,
}) {
  return `你是一個專門整理網頁內容的繁體中文編輯。請根據以下資料，輸出固定格式的 Markdown 摘要。

任務目標：
1. 深入理解文章內容，提供有深度與細節的摘要，避免過於簡略空泛。
2. 絕對不要虛構（Hallucination）原文沒有提及的資訊。若資訊不足以形成某個段落，請直接省略該部分或註明資訊不足。
3. 全文必須使用繁體中文（zh-TW），並盡可能保留原文的專有名詞（可於括號內附上原文）。

格式規範（重要）：
- 標題請用粗體加 emoji，例如「**📝 內容摘要**」，不要使用 # 標題語法。
- 不要使用 Markdown 表格（| 語法），改用條列格式。
- 條列項目一律使用扁平結構（只用 - 開頭），不要使用編號子列表（1. 2. 3.）或巢狀縮排。
- 條列項目中若需標示重點名稱，直接寫在 - 後面即可，不要在條列內再使用粗體。
- 這些規則是為了確保輸出在 GitHub Issue 和 Telegram 都能正確顯示。

請依照以下結構輸出：

**📝 內容摘要**

**📌 來源**
- 類型：網頁
- 標題：
- 網站：
- 作者：
- 網址：

**💡 核心概述**
（請以流暢的段落整理文章的脈絡。包含：文章的主題背景、關鍵論點/方法、以及最終結論。請視原文的豐富度來決定篇幅，確保能完整傳達作者的原意與重要細節。）

**🔍 重點條列**
（請萃取原文中最具價值的重點。數量請依據原文內容決定，寧缺勿濫。每個重點請盡量包含具體的細節、範例或解釋，不要僅用一句話帶過。）
- 重點 1：具體說明...
- 重點 2：具體說明...

**📊 關鍵數據與事實**
（如原文有關鍵數字、金額、日期、百分比等，請用條列呈現；若無相關資訊則省略此段）
- 項目：數值/日期/事實
- 項目：數值/日期/事實

**🎯 行動建議**
（若文章內容有提供建議或可執行的步驟，請在此條列；若無明確建議，請寫「目前無明確行動建議」）

---
以下是原始資料：
- 標題：${title}
- 網站：${siteName || "未提供"}
- 作者：${byline || "未提供"}
- 摘要：${excerpt || "未提供"}
- 網址：${url}
- 內容是否截斷：${truncated ? "是" : "否"}

原文內容：
"""
${content}
"""`;
}

async function handleUrl(input, client) {
  const url = (() => {
    try {
      return new URL(input).toString();
    } catch {
      throw new Error(`網址格式錯誤：${input}`);
    }
  })();

  console.error(`正在抓取網址：${url}`);
  const html = await fetchHtml(url);

  // Auto-fallback: if the URL serves a PDF, delegate to PDF handler
  if (html && html.__pdfFallback) {
    return { __pdfFallback: true, url };
  }

  console.error("正在抽取正文...");
  const article = extractArticle(html, url);
  const prepared = trimContent(article.content);

  if (prepared.text.length < MIN_CONTENT_LENGTH) {
    throw new Error(
      `無法從頁面抽出足夠正文：${url}。這可能是登入頁、動態頁，或頁面內容過少。`
    );
  }

  return {
    dryRunInfo: {
      detectedType: "url",
      url,
      title: article.title,
      siteName: article.siteName,
      byline: article.byline,
      source: article.source,
      contentLength: prepared.text.length,
      truncated: prepared.truncated,
      preview: prepared.text.slice(0, 280),
    },
    model: MODELS.url,
    interactionInput: buildUrlPrompt({
      url,
      title: article.title,
      siteName: article.siteName,
      byline: article.byline,
      excerpt: article.excerpt,
      content: prepared.text,
      truncated: prepared.truncated,
    }),
    cleanup: null,
  };
}

// ---------------------------------------------------------------------------
// PDF Handler
// ---------------------------------------------------------------------------

function buildPdfPrompt() {
  return `你是專業的文件分析助手。請仔細閱讀這份 PDF 文件的內容，並產出結構化、重點清晰的繁體中文摘要。

任務目標：
1. 確保涵蓋文件中各個章節的重要內容，不要只摘要前幾頁。
2. 絕對不要虛構文件中沒有提到的資訊。
3. 全文使用繁體中文（zh-TW），保留專有名詞的原文（括號附上）。
4. 數字和日期必須準確引用，不可估算。

格式規範（重要）：
- 標題請用粗體加 emoji，例如「**📝 內容摘要**」，不要使用 # 標題語法。
- 不要使用 Markdown 表格（| 語法），改用條列格式。
- 條列項目一律使用扁平結構（只用 - 開頭），不要使用編號子列表（1. 2. 3.）或巢狀縮排。
- 條列項目中若需標示重點名稱，直接寫在 - 後面即可，不要在條列內再使用粗體。
- 這些規則是為了確保輸出在 GitHub Issue 和 Telegram 都能正確顯示。

請依照以下結構輸出：

**📝 內容摘要**

**📌 來源**
- 類型：PDF 文件
- 檔名：（請從文件內容或脈絡推斷標題）

**💡 核心概述**
（請以流暢的段落整理文件的核心脈絡，包含：文件主旨與背景、主要探討的方法論或內容、以及結論與影響。請依據文件厚度與資訊量調整篇幅，確保重要細節不遺漏。）

**🔍 重點條列**
（請萃取文件中的重要論點、發現或規範。數量請視文件內容而定。每點需包含具體細節、數據或範例說明。）
- 重點說明...

**📊 關鍵數據與事實**
（如有關鍵數字、金額、日期、百分比等，請用條列呈現；若無則省略此段）
- 項目：數值/日期
- 項目：數值/日期

**📖 專有名詞表**
（若文件中有頻繁出現或具關鍵性的專業術語，請用條列並簡要解釋；若無則省略此段）
- **術語**：說明
- **術語**：說明

**🎯 行動建議**
（若文件包含後續計畫、建議採取的步驟或管理決策，請在此整理出來；若無則寫「目前無明確行動建議」）`;
}

async function resolvePdfBuffer(rawInput) {
  if (!rawInput) throw new Error("請提供 PDF 檔案路徑或 URL。");

  const lower = rawInput.toLowerCase();
  if (!lower.endsWith(".pdf")) {
    try {
      const url = new URL(rawInput);
      if (!url.pathname.toLowerCase().endsWith(".pdf")) {
        console.error(`警告：輸入不像 PDF 檔案，仍嘗試處理：${rawInput}`);
      }
    } catch {
      console.error(`警告：輸入不像 PDF 檔案，仍嘗試處理：${rawInput}`);
    }
  }

  // Try local file first
  let localPath = rawInput;
  if (rawInput.startsWith("file://")) localPath = fileURLToPath(rawInput);
  const resolvedPath = path.resolve(localPath);

  try {
    const fileBuffer = await readFile(resolvedPath);
    return {
      source: "local-file",
      buffer: fileBuffer,
      mimeType: "application/pdf",
      localPath: resolvedPath,
      displayName: path.basename(resolvedPath),
    };
  } catch (error) {
    if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") {
      throw new Error(`無法讀取檔案 "${resolvedPath}"：${error.message}`);
    }
  }

  // Try remote URL
  if (isRemoteUrl(rawInput)) {
    console.error(`正在下載 PDF：${rawInput}`);
    const response = await fetchWithTimeout(rawInput);
    if (!response.ok)
      throw new Error(`下載失敗（HTTP ${response.status}）：${rawInput}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const urlPath = new URL(rawInput).pathname;
    return {
      source: "remote-url",
      buffer,
      mimeType: "application/pdf",
      remoteUrl: rawInput,
      displayName: path.basename(urlPath) || "document.pdf",
    };
  }

  throw new Error(`輸入既非可讀取的本地檔案，也非有效的 URL：${rawInput}`);
}

async function uploadPdfAndGetUri(client, pdfInput) {
  console.error("正在上傳 PDF 至 Gemini Files API...");
  const blob = new Blob([pdfInput.buffer], { type: pdfInput.mimeType });
  let uploadedFile = await client.files.upload({
    file: blob,
    config: {
      mimeType: pdfInput.mimeType,
      displayName: pdfInput.displayName,
    },
  });

  while (uploadedFile.state === "PROCESSING") {
    await new Promise((r) => setTimeout(r, 2000));
    uploadedFile = await client.files.get({ name: uploadedFile.name });
  }

  if (uploadedFile.state === "FAILED") {
    throw new Error(`Gemini Files API 處理失敗：${uploadedFile.name}`);
  }

  return { uri: uploadedFile.uri, name: uploadedFile.name };
}

async function handlePdf(input, client) {
  const pdfInput = await resolvePdfBuffer(input);

  const dryRunInfo = {
    detectedType: "pdf",
    source: pdfInput.source,
    mimeType: pdfInput.mimeType,
    localPath: pdfInput.localPath || null,
    remoteUrl: pdfInput.remoteUrl || null,
    bufferBytes: pdfInput.buffer.length,
    displayName: pdfInput.displayName,
  };

  console.error(`正在分析 PDF：${input}`);
  const { uri, name: uploadedFileName } = await uploadPdfAndGetUri(
    client,
    pdfInput
  );
  console.error(`已上傳：${uploadedFileName}`);

  return {
    dryRunInfo,
    model: MODELS.pdf,
    interactionInput: [
      { type: "text", text: buildPdfPrompt() },
      { type: "document", uri, mime_type: pdfInput.mimeType },
    ],
    cleanup: async () => {
      await client.files.delete({ name: uploadedFileName }).catch(() => {});
    },
  };
}

// ---------------------------------------------------------------------------
// Video Handler
// ---------------------------------------------------------------------------

function getVideoMimeType(filePath) {
  return VIDEO_MIME_TYPES[path.extname(filePath).toLowerCase()] || "video/mp4";
}

function buildVideoPrompt() {
  return `你是一個專業的影片內容分析師。請仔細觀看這段影片的完整內容，並產出結構化、重點清晰的繁體中文摘要。

任務目標：
1. 確保涵蓋影片從頭到尾的重要段落，不要只摘要開頭。
2. 絕對不要虛構影片中沒有出現的資訊。
3. 全文使用繁體中文（zh-TW），保留專有名詞的原文（括號附上）。

格式規範（重要）：
- 標題請用粗體加 emoji，例如「**📝 內容摘要**」，不要使用 # 標題語法。
- 不要使用 Markdown 表格（| 語法），改用條列格式。
- 條列項目一律使用扁平結構（只用 - 開頭），不要使用編號子列表（1. 2. 3.）或巢狀縮排。
- 條列項目中若需標示重點名稱，直接寫在 - 後面即可，不要在條列內再使用粗體。
- 這些規則是為了確保輸出在 GitHub Issue 和 Telegram 都能正確顯示。

請依照以下結構輸出：

**📝 內容摘要**

**📌 來源**
- 類型：影片

**💡 核心概述**
（請以流暢的段落整理影片的脈絡，包含：影片主題與背景、核心內容或關鍵步驟、以及最終結論與啟示。請依據影片長度與資訊豐富度調整篇幅。）

**🔍 重點條列**
（請萃取影片中的精華重點。數量視內容而定，寧缺勿濫。若影片中有特定的步驟、操作畫面或關鍵論述，請盡量補上具體細節。）
- 重點說明...

**📊 關鍵數據與事實**
（如影片中提及關鍵數字、金額、日期、百分比等，請用條列呈現；若無則省略此段）
- 項目：數值/日期
- 項目：數值/日期

**🎯 行動建議**
（觀看後若有建議行動或下一步，請整理於此；若無則寫「目前無明確行動建議」）`;
}

async function resolveVideoInput(rawInput) {
  if (!rawInput) throw new Error("請提供影片 URL 或本地檔案路徑。");

  if (rawInput.startsWith("data:")) {
    return {
      source: "data-uri",
      uri: rawInput,
      mimeType:
        rawInput.match(/^data:([^;]+);base64,/)?.[1] || "video/mp4",
    };
  }

  // Try local file first
  let localPath = rawInput;
  if (rawInput.startsWith("file://")) localPath = fileURLToPath(rawInput);
  const resolvedPath = path.resolve(localPath);

  try {
    const fileBuffer = await readFile(resolvedPath);
    const mimeType = getVideoMimeType(resolvedPath);
    return {
      source: "local-file",
      uri: `data:${mimeType};base64,${fileBuffer.toString("base64")}`,
      mimeType,
      localPath: resolvedPath,
    };
  } catch (error) {
    if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") {
      throw new Error(`無法讀取影片檔案 "${resolvedPath}"：${error.message}`);
    }
  }

  // Remote URL
  if (isRemoteUrl(rawInput)) {
    return {
      source: "remote-url",
      uri: rawInput,
      mimeType: "video/mp4",
    };
  }

  throw new Error(
    `輸入既非可讀取的本地檔案，也非有效的影片 URL：${rawInput}`
  );
}

async function handleVideo(input) {
  const videoInput = await resolveVideoInput(input);

  return {
    dryRunInfo: {
      detectedType: "video",
      source: videoInput.source,
      mimeType: videoInput.mimeType,
      localPath: videoInput.localPath || null,
      uriPreview:
        videoInput.source === "local-file" ||
        videoInput.source === "data-uri"
          ? `${videoInput.uri.slice(0, 48)}...`
          : videoInput.uri,
    },
    model: MODELS.video,
    interactionInput: [
      { type: "text", text: buildVideoPrompt() },
      { type: "video", uri: videoInput.uri, mime_type: videoInput.mimeType },
    ],
    cleanup: null,
  };
}

// ---------------------------------------------------------------------------
// Audio Handler
// ---------------------------------------------------------------------------

function getAudioMimeType(filePath) {
  return AUDIO_MIME_TYPES[path.extname(filePath).toLowerCase()] || "audio/mpeg";
}

function buildAudioPrompt() {
  return `你是一個專業的音訊內容分析師。請仔細聆聽這段音訊的完整內容，並產出結構化、重點清晰的繁體中文摘要。

任務目標：
1. 確保涵蓋音訊從頭到尾的對話或獨白重點。
2. 絕對不要虛構音訊中沒有出現的資訊。
3. 全文使用繁體中文（zh-TW），保留專有名詞的原文（括號附上）。

格式規範（重要）：
- 標題請用粗體加 emoji，例如「**📝 內容摘要**」，不要使用 # 標題語法。
- 不要使用 Markdown 表格（| 語法），改用條列格式。
- 條列項目一律使用扁平結構（只用 - 開頭），不要使用編號子列表（1. 2. 3.）或巢狀縮排。
- 條列項目中若需標示重點名稱，直接寫在 - 後面即可，不要在條列內再使用粗體。
- 這些規則是為了確保輸出在 GitHub Issue 和 Telegram 都能正確顯示。

請依照以下結構輸出：

**📝 內容摘要**

**📌 來源**
- 類型：音訊

**💡 核心概述**
（請以流暢的段落整理音訊的脈絡，包含：討論主題與背景、核心對話內容或關鍵論點、以及結論。請依據音訊長度與資訊豐富度調整篇幅。）

**🔍 重點條列**
（請萃取音訊中的精華論點或對話重點。數量視內容而定，寧缺勿濫。盡可能保留講者的具體舉例或重要細節。）
- 重點說明...

**📊 關鍵數據與事實**
（如音訊中提及關鍵數字、金額、日期等，請用條列呈現；若無則省略此段）
- 項目：數值/日期
- 項目：數值/日期

**🎯 行動建議**
（聆聽後若有明確的建議行動或後續規劃，請整理於此；若無則寫「目前無明確行動建議」）`;
}

async function resolveAudioInput(rawInput) {
  if (!rawInput) throw new Error("請提供音訊檔案路徑或 URL。");

  // Try local file first
  let localPath = rawInput;
  if (rawInput.startsWith("file://")) localPath = fileURLToPath(rawInput);
  const resolvedPath = path.resolve(localPath);

  try {
    const fileBuffer = await readFile(resolvedPath);
    const mimeType = getAudioMimeType(resolvedPath);
    return {
      source: "local-file",
      buffer: fileBuffer,
      mimeType,
      localPath: resolvedPath,
      displayName: path.basename(resolvedPath),
    };
  } catch (error) {
    if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") {
      throw new Error(`無法讀取音訊檔案 "${resolvedPath}"：${error.message}`);
    }
  }

  // Remote URL
  if (isRemoteUrl(rawInput)) {
    console.error(`正在下載音訊：${rawInput}`);
    const response = await fetchWithTimeout(rawInput);
    if (!response.ok)
      throw new Error(`下載失敗（HTTP ${response.status}）：${rawInput}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const urlPath = new URL(rawInput).pathname;
    const ext = path.extname(urlPath).toLowerCase();
    return {
      source: "remote-url",
      buffer,
      mimeType: AUDIO_MIME_TYPES[ext] || "audio/mpeg",
      remoteUrl: rawInput,
      displayName: path.basename(urlPath) || "audio.mp3",
    };
  }

  throw new Error(
    `輸入既非可讀取的本地檔案，也非有效的音訊 URL：${rawInput}`
  );
}

async function handleAudio(input, client) {
  const audioInput = await resolveAudioInput(input);

  const dryRunInfo = {
    detectedType: "audio",
    source: audioInput.source,
    mimeType: audioInput.mimeType,
    localPath: audioInput.localPath || null,
    remoteUrl: audioInput.remoteUrl || null,
    bufferBytes: audioInput.buffer.length,
    displayName: audioInput.displayName,
  };

  console.error(`正在分析音訊：${input}`);
  const blob = new Blob([audioInput.buffer], { type: audioInput.mimeType });
  let uploadedFile = await client.files.upload({
    file: blob,
    config: {
      mimeType: audioInput.mimeType,
      displayName: audioInput.displayName,
    },
  });

  while (uploadedFile.state === "PROCESSING") {
    await new Promise((r) => setTimeout(r, 2000));
    uploadedFile = await client.files.get({ name: uploadedFile.name });
  }

  if (uploadedFile.state === "FAILED") {
    throw new Error(`Gemini Files API 處理失敗：${uploadedFile.name}`);
  }

  const uploadedFileName = uploadedFile.name;
  console.error(`已上傳：${uploadedFileName}`);

  return {
    dryRunInfo,
    model: MODELS.audio,
    interactionInput: [
      { type: "text", text: buildAudioPrompt() },
      { type: "document", uri: uploadedFile.uri, mime_type: audioInput.mimeType },
    ],
    cleanup: async () => {
      await client.files.delete({ name: uploadedFileName }).catch(() => {});
    },
  };
}

// ---------------------------------------------------------------------------
// Main Entry
// ---------------------------------------------------------------------------

async function main() {
  const { type: forcedType, input } = parseCliArgs();

  if (!input) {
    printUsage();
    process.exit(1);
  }

  const detectedType = forcedType || detectInputType(input);
  console.error(`偵測到輸入類型：${detectedType}`);

  const isDryRun = process.env.SUMMARY_DRY_RUN === "1";

  // For PDF, we need the client before handlePdf (for upload)
  // For URL/Video, we need it only for the interaction
  let client = null;
  if (!isDryRun) {
    const apiKey = ensureApiKey();
    client = new GoogleGenAI({ apiKey });
  }

  let result;
  switch (detectedType) {
    case "url":
      result = await handleUrl(input, client);
      // Auto-fallback: URL returned PDF content-type
      if (result && result.__pdfFallback) {
        console.error("偵測到 PDF Content-Type，自動切換至 PDF 處理器...");
        if (!client) {
          const pdfInput = await resolvePdfBuffer(result.url);
          process.stdout.write(
            `${JSON.stringify(
              {
                detectedType: "pdf",
                source: pdfInput.source,
                mimeType: pdfInput.mimeType,
                localPath: pdfInput.localPath || null,
                remoteUrl: pdfInput.remoteUrl || null,
                bufferBytes: pdfInput.buffer.length,
                displayName: pdfInput.displayName,
              },
              null,
              2
            )}\n`
          );
          return;
        }
        result = await handlePdf(result.url, client);
      }
      break;
    case "pdf":
      if (!client) {
        // dry-run for PDF: still need to resolve buffer but not upload
        const pdfInput = await resolvePdfBuffer(input);
        process.stdout.write(
          `${JSON.stringify(
            {
              detectedType: "pdf",
              source: pdfInput.source,
              mimeType: pdfInput.mimeType,
              localPath: pdfInput.localPath || null,
              remoteUrl: pdfInput.remoteUrl || null,
              bufferBytes: pdfInput.buffer.length,
              displayName: pdfInput.displayName,
            },
            null,
            2
          )}\n`
        );
        return;
      }
      result = await handlePdf(input, client);
      break;
    case "video":
      result = await handleVideo(input);
      break;
    case "audio":
      if (!client) {
        const audioInput = await resolveAudioInput(input);
        process.stdout.write(
          `${JSON.stringify(
            {
              detectedType: "audio",
              source: audioInput.source,
              mimeType: audioInput.mimeType,
              localPath: audioInput.localPath || null,
              remoteUrl: audioInput.remoteUrl || null,
              bufferBytes: audioInput.buffer.length,
              displayName: audioInput.displayName,
            },
            null,
            2
          )}\n`
        );
        return;
      }
      result = await handleAudio(input, client);
      break;
    default:
      throw new Error(`不支援的類型：${detectedType}`);
  }

  // Dry-run: output metadata only
  if (isDryRun) {
    process.stdout.write(`${JSON.stringify(result.dryRunInfo, null, 2)}\n`);
    return;
  }

  // Stream the summary
  console.error("正在請 Gemini 產生摘要...");
  try {
    const stream = await client.interactions.create({
      model: result.model,
      input: result.interactionInput,
      generation_config: { max_output_tokens: 65536 },
      stream: true,
    });
    await streamInteraction(stream);
  } finally {
    if (result.cleanup) await result.cleanup();
  }
}

main().catch((error) => {
  console.error(`錯誤：${error.message || error}`);
  process.exit(1);
});
