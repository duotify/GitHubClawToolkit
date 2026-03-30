#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import tool from "./google-stitch.js";

const DEFAULT_OUTPUT_DIR = "google-stitch-output";

function printUsage() {
  console.error(
    [
      "用法：",
      '  node .agents/skills/google-stitch/scripts/generate.js --prompt "<設計描述>" [options]',
      "",
      "選項：",
      "  --prompt <text>          必填，設計提示詞",
      "  --aspect-ratio <value>   例如 16:9、9:16、1:1",
      "  --image-size <value>     例如 512、1K、2K、4K",
      "  --model <value>          gemini-3.1-flash-image-preview | gemini-3-pro-image-preview",
      "  --output-dir <path>      輸出目錄，預設 ./google-stitch-output",
      "  --html-out <path>        自訂 HTML 輸出檔案",
      "  --image-out <path>       自訂圖片輸出檔案",
      "",
      "環境變數：",
      "  GEMINI_API_KEY / GOOGLE_API_KEY",
      "  GOOGLE_STITCH_DRY_RUN=1  只輸出執行計畫，不呼叫 API",
    ].join("\n"),
  );
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unsupported argument: ${token}`);
    }

    const key = token.slice(2);
    if (key === "help") {
      parsed.help = "1";
      continue;
    }

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }

    parsed[key] = value;
    index += 1;
  }

  return parsed;
}

function mimeToExtension(mimeType) {
  switch (mimeType) {
    case "image/jpeg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    default:
      return ".png";
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  const prompt = String(args.prompt ?? "").trim();
  if (!prompt) {
    printUsage();
    throw new Error("缺少 --prompt。");
  }

  const outputDir = path.resolve(process.cwd(), args["output-dir"] ?? DEFAULT_OUTPUT_DIR);
  const dryRun = process.env.GOOGLE_STITCH_DRY_RUN === "1";
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  const request = {
    prompt,
    ...(args["aspect-ratio"] ? { aspectRatio: args["aspect-ratio"] } : {}),
    ...(args["image-size"] ? { imageSize: args["image-size"] } : {}),
    ...(args.model ? { model: args.model } : {}),
  };

  if (dryRun) {
    process.stdout.write(
      JSON.stringify(
        {
          dryRun: true,
          request,
          outputDir,
          htmlOut: args["html-out"] ? path.resolve(process.cwd(), args["html-out"]) : null,
          imageOut: args["image-out"] ? path.resolve(process.cwd(), args["image-out"]) : null,
        },
        null,
        2,
      ) + "\n",
    );
    return;
  }

  if (!apiKey) {
    throw new Error("缺少 GEMINI_API_KEY 或 GOOGLE_API_KEY。");
  }

  const result = await tool.handler(request, {
    secrets: { apiKey },
  });

  await mkdir(outputDir, { recursive: true });

  const imageExtension = mimeToExtension(result.imageMimeType);
  const htmlPath = result.html
    ? path.resolve(process.cwd(), args["html-out"] ?? path.join(outputDir, "design.html"))
    : null;
  const imagePath = result.image
    ? path.resolve(
        process.cwd(),
        args["image-out"] ?? path.join(outputDir, `design${imageExtension}`),
      )
    : null;

  if (htmlPath) {
    await mkdir(path.dirname(htmlPath), { recursive: true });
    await writeFile(htmlPath, result.html, "utf8");
  }

  if (imagePath) {
    await mkdir(path.dirname(imagePath), { recursive: true });
    await writeFile(imagePath, Buffer.from(result.image, "base64"));
  }

  process.stdout.write(
    JSON.stringify(
      {
        htmlPath,
        imagePath,
        imageMimeType: result.imageMimeType,
        model: result.model,
        prompt: result.prompt,
      },
      null,
      2,
    ) + "\n",
  );
}

main().catch((error) => {
  console.error(`錯誤：${error.message || error}`);
  process.exit(1);
});
