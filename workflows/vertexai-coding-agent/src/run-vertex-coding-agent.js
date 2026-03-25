#!/usr/bin/env node

import { GoogleGenAI } from "@google/genai";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[index + 1];
    if (typeof value === "string" && !value.startsWith("--")) {
      args[key] = value;
      index += 1;
    } else {
      args[key] = "true";
    }
  }
  return args;
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function safeReadFile(filePath) {
  return readFile(filePath, "utf8").catch(() => "");
}

function runGit(repoRoot, args) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      result.stderr || result.stdout || `git ${args.join(" ")} failed`,
    );
  }

  return result.stdout.trim();
}

function buildFileSnapshot(repoRoot, limit = 240) {
  const output = runGit(repoRoot, ["ls-files"]);
  const paths = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const shown = paths.slice(0, limit);
  const omitted = Math.max(paths.length - shown.length, 0);
  return {
    count: paths.length,
    shown,
    omitted,
  };
}

function extractTextFromResponse(response) {
  const directText = normalizeText(response?.text);
  if (directText) return directText;

  const candidates = Array.isArray(response?.candidates)
    ? response.candidates
    : [];
  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts)
      ? candidate.content.parts
      : [];
    const text = parts
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("")
      .trim();
    if (text) return text;
  }

  return "";
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function extractMessage(cause, fallback) {
  if (!cause || typeof cause !== "object") return fallback;
  const message = cause.message;
  if (typeof message === "string" && message.trim()) return message;
  const error = cause.error;
  if (error && typeof error === "object" && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

function buildContextPrompt({
  repoRoot,
  issueDir,
  model,
  issueMarkdown,
  agentsMarkdown,
  memoryMarkdown,
  manualMemoryMarkdown,
  fileSnapshot,
  gitStatus,
}) {
  return [
    `Repository root: ${repoRoot}`,
    `Issue workspace: ${issueDir}`,
    `Model: ${model}`,
    "",
    "## Issue workspace instructions",
    agentsMarkdown || "(missing AGENTS.md)",
    "",
    "## Issue content",
    issueMarkdown || "(missing issue.md)",
    "",
    "## Repository file snapshot",
    `Total files: ${fileSnapshot.count}`,
    ...(fileSnapshot.shown.length > 0
      ? [fileSnapshot.shown.map((file) => `- ${file}`).join("\n")]
      : ["(no files)"]),
    fileSnapshot.omitted > 0
      ? `- ...and ${fileSnapshot.omitted} more files`
      : "",
    "",
    "## Current git status",
    gitStatus || "(clean)",
    "",
    "## Memory",
    memoryMarkdown || "",
    manualMemoryMarkdown || "",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

async function runMultiTurnConversation({ client, model, contextPrompt }) {
  const chat = client.chats.create({
    model,
    config: {
      temperature: 0.7,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      tools: [{ codeExecution: {} }, { googleSearch: {} }],
      systemInstruction: [
        "你是 GitHubClaw 的 Vertex AI Express coding agent。",
        "請一律使用繁體中文（台灣）。",
        "你會收到 issue 與工作區說明，請根據內容產出可直接回寫到 issue 的最終結果。",
        "若任務涉及計算、驗證、資料整理或推導，優先使用 codeExecution。",
        "若任務涉及外部知識、最新資訊、事實查核或需要補足公開背景，主動使用 googleSearch。",
        "輸出必須是 JSON，格式如下：",
        '{"result_markdown":"...","summary":"...","status":"completed"}',
        "result_markdown 內容要可以直接貼到 GitHub comment。",
        "summary 要短。",
        "status 固定使用 completed、blocked、needs-input 其中之一。",
        "不要輸出 JSON 以外的內容。",
      ].join("\n"),
    },
  });

  const turns = [];

  async function sendTurn(label, message) {
    const response = await chat.sendMessage({ message });
    const text = extractTextFromResponse(response);
    turns.push({
      label,
      message,
      responseText: text,
    });
    return {
      response,
      text,
    };
  }

  await sendTurn(
    "context-sync",
    [
      "請先完整吸收以下資訊，先不要產出最終答案。",
      "你的任務是先整理脈絡、限制與可能缺口，建立穩定上下文。",
      "如果需要計算或查證，這一輪就可以開始使用工具，但先不要直接輸出最終結論。",
      "",
      contextPrompt,
      "",
      "第一輪請只輸出 JSON，格式如下：",
      '{"task_understanding":"...","constraints":["..."],"risks":["..."],"missing_context":["..."]}',
      "如果沒有缺口，missing_context 請輸出空陣列。",
    ].join("\n"),
  );

  await sendTurn(
    "review-and-refine",
    [
      "根據上一輪整理結果，請再做一次自我檢查。",
      "目標是消除不必要的不確定性，盡量利用已提供資訊推論，而不是輕易阻塞。",
      "若還有可透過 googleSearch 或 codeExecution 消除的不確定性，請先用工具補足。",
      "第二輪請只輸出 JSON，格式如下：",
      '{"resolved_assumptions":["..."],"remaining_blockers":["..."],"execution_plan":["..."]}',
      "如果沒有 remaining_blockers，請輸出空陣列。",
    ].join("\n"),
  );

  const finalTurn = await sendTurn(
    "final-answer",
    [
      "現在請基於前兩輪已建立的上下文，產出最終結果。",
      "如果最後一步仍需要工具驗證，請先完成驗證再輸出。",
      "請只輸出最終 JSON，格式如下：",
      '{"result_markdown":"...","summary":"...","status":"completed"}',
      "如果仍有阻塞，status 請用 blocked，並在 result_markdown 清楚寫出阻塞點與下一步。",
      "不要輸出 markdown code fence，不要輸出說明文字。",
    ].join("\n"),
  );

  const history =
    typeof chat.getHistory === "function" ? await chat.getHistory() : null;

  return {
    finalText: finalTurn.text,
    turns,
    history,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(
    args["repo-root"] || process.env.REPO_ROOT || process.cwd(),
  );
  const issueDir = path.resolve(
    repoRoot,
    args["issue-dir"] || process.env.ISSUE_DIR || ".",
  );
  const resultFile = path.resolve(
    repoRoot,
    args["result-file"] ||
      process.env.RESULT_FILE ||
      path.join(issueDir, "result.txt"),
  );
  const logFile = path.resolve(
    repoRoot,
    args["log-file"] ||
      process.env.LOG_FILE ||
      path.join(issueDir, "vertex-exec-log.json"),
  );
  const model = normalizeText(
    args.model || process.env.VERTEX_AGENT_MODEL || "gemini-2.5-pro",
  );
  const apiKey = normalizeText(process.env.CLOUD_CONSOLE_API_KEY);
  const brainMeta = normalizeText(process.env.BRAIN_META);

  if (!apiKey) {
    throw new Error(
      "Missing CLOUD_CONSOLE_API_KEY for Vertex AI Express mode.",
    );
  }

  const issueMarkdown = await safeReadFile(path.join(issueDir, "issue.md"));
  const agentsMarkdown = await safeReadFile(path.join(issueDir, "AGENTS.md"));
  const memoryMarkdown = await safeReadFile(
    path.join(repoRoot, ".memory", "MEMORY.md"),
  );
  const manualMemoryMarkdown = await safeReadFile(
    path.join(repoRoot, ".memory", "shared", "manual.md"),
  );
  const fileSnapshot = buildFileSnapshot(repoRoot);
  const gitStatus = runGit(repoRoot, ["status", "--short"]);

  const contextPrompt = buildContextPrompt({
    repoRoot,
    issueDir,
    model,
    issueMarkdown,
    agentsMarkdown,
    memoryMarkdown,
    manualMemoryMarkdown,
    fileSnapshot,
    gitStatus,
  });

  const client = new GoogleGenAI({
    vertexai: true,
    apiKey,
    apiVersion: "v1",
  });

  let conversation;
  try {
    conversation = await runMultiTurnConversation({
      client,
      model,
      contextPrompt,
    });
  } catch (cause) {
    throw new Error(extractMessage(cause, "Vertex AI Express request failed."));
  }

  const responseText = normalizeText(conversation.finalText);
  if (!responseText) {
    throw new Error(
      "Vertex AI Express response did not contain any text output.",
    );
  }

  const parsed = tryParseJson(responseText) || {};
  const resultMarkdown = normalizeText(
    parsed.result_markdown || parsed.result || responseText,
  );
  const summary = normalizeText(parsed.summary || "");
  const status = normalizeText(parsed.status || "completed") || "completed";
  const finalResult =
    brainMeta && !resultMarkdown.includes(brainMeta)
      ? `${resultMarkdown}\n\n${brainMeta}`
      : resultMarkdown;

  await writeFile(resultFile, `${finalResult || responseText}\n`, "utf8");

  await writeFile(
    logFile,
    `${JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        mode: "vertex-ai-express-chat",
        model,
        repoRoot,
        issueDir,
        contextPrompt,
        turns: conversation.turns,
        history: conversation.history,
        response: {
          text: responseText,
        },
        parsed: {
          summary,
          status,
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  process.stdout.write(`${finalResult || responseText}\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
