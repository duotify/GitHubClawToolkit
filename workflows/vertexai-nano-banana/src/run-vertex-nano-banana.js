#!/usr/bin/env node

import { GoogleGenAI } from "@google/genai";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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

function mimeToExtension(mimeType) {
  switch (mimeType) {
    case "image/jpeg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    default:
      return ".png";
  }
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
    "",
    "## Output requirements",
    "1. 先根據 issue 需求產出最合適的圖片。",
    "2. 以圖片輸出為主，不需要額外說明文字。",
    "3. 如果你一定要附帶文字，最多只能一句，而且要非常短。",
    "4. 不要要求額外互動，直接完成目前最佳版本。",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

async function generateNanoBanana({ client, model, contextPrompt }) {
  // Follow the official js-genai image generation pattern: send a text prompt
  // to an image-capable model and read image bytes from parts[].inlineData.
  const response = await client.models.generateContent({
    model,
    contents: contextPrompt,
  });

  const candidates = Array.isArray(response?.candidates)
    ? response.candidates
    : [];
  const parts = Array.isArray(candidates[0]?.content?.parts)
    ? candidates[0].content.parts
    : [];

  const textParts = [];
  const imageParts = [];
  for (const part of parts) {
    const text = normalizeText(part?.text);
    if (text) {
      textParts.push(text);
    }

    if (part?.inlineData?.data) {
      imageParts.push({
        data: part.inlineData.data,
        mimeType: normalizeText(part.inlineData.mimeType) || "image/png",
      });
    }
  }

  return {
    response,
    textParts,
    imageParts,
  };
}

async function writeImages({ repoRoot, imageDir, imageParts }) {
  await mkdir(imageDir, { recursive: true });

  const images = [];
  for (let index = 0; index < imageParts.length; index += 1) {
    const image = imageParts[index];
    const extension = mimeToExtension(image.mimeType);
    const fileName = `nano-banana-${String(index + 1).padStart(2, "0")}${extension}`;
    const filePath = path.join(imageDir, fileName);

    await writeFile(filePath, Buffer.from(image.data, "base64"));

    images.push({
      fileName,
      filePath,
      repoRelativePath: path
        .relative(repoRoot, filePath)
        .split(path.sep)
        .join("/"),
      mimeType: image.mimeType,
    });
  }

  return images;
}

async function writeFailureResult({ resultFile, brainMeta, message }) {
  const lines = ["❌ Nano Banana 產圖失敗", "", message];

  if (brainMeta) {
    lines.push("", brainMeta);
  }

  await writeFile(resultFile, `${lines.join("\n")}\n`, "utf8");
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
  const imageDir = path.resolve(
    repoRoot,
    args["image-dir"] || process.env.IMAGE_DIR || path.join(issueDir, "files"),
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
      path.join(issueDir, "vertex-nano-banana-log.json"),
  );
  const model = normalizeText(
    args.model ||
      process.env.VERTEX_NANO_BANANA_MODEL ||
      "gemini-2.5-flash-image",
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
  });

  let generation;
  try {
    generation = await generateNanoBanana({
      client,
      model,
      contextPrompt,
    });
  } catch (cause) {
    const message = extractMessage(cause, "Vertex AI Express request failed.");
    await writeFailureResult({
      resultFile,
      brainMeta,
      message,
    });
    throw new Error(message);
  }

  if (generation.imageParts.length === 0) {
    const message = "Vertex AI response did not contain any image output.";
    await writeFailureResult({
      resultFile,
      brainMeta,
      message,
    });
    throw new Error(message);
  }

  const savedImages = await writeImages({
    repoRoot,
    imageDir,
    imageParts: generation.imageParts,
  });

  const resultLines = [];
  for (const image of savedImages) {
    resultLines.push(image.repoRelativePath);
    resultLines.push(`![${image.fileName}](${image.repoRelativePath})`);
  }

  if (brainMeta) {
    resultLines.push("", brainMeta);
  }

  await writeFile(resultFile, `${resultLines.join("\n")}\n`, "utf8");

  await writeFile(
    logFile,
    `${JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        mode: "vertex-ai-express-nano-banana",
        model,
        repoRoot,
        issueDir,
        imageDir,
        contextPrompt,
        response: generation.response,
        images: savedImages,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  process.stdout.write(`${resultLines.join("\n")}\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
