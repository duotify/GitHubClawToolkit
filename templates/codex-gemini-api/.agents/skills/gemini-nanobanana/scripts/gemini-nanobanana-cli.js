#!/usr/bin/env node
"use strict";

/**
 * Simple Gemini image CLI wrapper (no dependencies).
 *
 * Usage:
 *   nanobanana --prompt "A banana astronaut in space"
 *   nanobanana -p "Stylize this" -i .\ref1.png -i .\ref2.jpg --resolution 512
 *   nanobanana --prompt "Forecast infographic" --google-search
 */

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_MODEL = process.env.NANOBANANA_MODEL || "gemini-3.1-flash-image-preview";
const DEFAULT_THINKING = "high";
const DEFAULT_ASPECT_RATIO = "Auto";
const DEFAULT_RESOLUTION = "1K";
const DEFAULT_OUTPUT_MODE = "images";
const DEFAULT_OUTPUT_DIR = "nanobanana-output";
const MAX_REFERENCE_IMAGES = 14;
const HELP_FLAGS = new Set(["-h", "--help"]);

function printHelp() {
  console.log(`Nano Banana Gemini Image CLI

Usage:
  nanobanana [options] --prompt "your prompt"
  nanobanana [options] "your prompt"
  npx @willh/nanobanana-cli [options] --prompt "your prompt"

Options:
  -p, --prompt <text>         Prompt text
  -i, --image <path>          Reference image path (repeatable, max 14)
      --images <p1,p2,...>    Comma-separated image paths (max 14 total)
      --model <name>          Model (default: NANOBANANA_MODEL or gemini-3.1-flash-image-preview)
      --thinking <level>      minimal | low | medium | high (default: high)
      --aspect-ratio <ratio>  e.g. 1:1, 16:9, 5:4, Auto (default: Auto)
      --resolution <size>     512 | 512px | 1K | 2K | 4K (default: 1K)
      --output-mode <mode>    images | both (default: images)
      --google-search         Enable Google Search grounding tool
      --output-dir <dir>      Save directory (default: nanobanana-output, or inferred from prompt)
      --api-key <key>         Gemini API key (default: NANOBANANA_GEMINI_API_KEY, fallback: GEMINI_API_KEY)
      --name-prefix <prefix>  Output file prefix (default: nanobanana)
  -h, --help                  Show help
`);
}

function getValue(args, index, optionName) {
  const value = args[index + 1];
  if (!value || value.startsWith("-")) {
    throw new Error(`Missing value for ${optionName}.`);
  }
  return value;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const result = {
    prompt: "",
    images: [],
    model: DEFAULT_MODEL,
    thinking: DEFAULT_THINKING,
    aspectRatio: DEFAULT_ASPECT_RATIO,
    resolution: DEFAULT_RESOLUTION,
    outputMode: DEFAULT_OUTPUT_MODE,
    googleSearch: false,
    outputDir: "",
    apiKey: process.env.NANOBANANA_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "",
    namePrefix: "nanobanana",
  };
  const promptParts = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (HELP_FLAGS.has(arg)) {
      result.help = true;
      continue;
    }

    if (arg === "--") {
      promptParts.push(...args.slice(i + 1));
      break;
    }

    switch (arg) {
      case "-p":
      case "--prompt":
        result.prompt = getValue(args, i, arg);
        i += 1;
        break;
      case "-i":
      case "--image":
        result.images.push(getValue(args, i, arg));
        i += 1;
        break;
      case "--images":
        result.images.push(
          ...getValue(args, i, arg)
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
        );
        i += 1;
        break;
      case "--model":
        result.model = getValue(args, i, arg);
        i += 1;
        break;
      case "--thinking":
        result.thinking = getValue(args, i, arg);
        i += 1;
        break;
      case "--aspect-ratio":
        result.aspectRatio = getValue(args, i, arg);
        i += 1;
        break;
      case "--resolution":
        result.resolution = getValue(args, i, arg);
        i += 1;
        break;
      case "--output-mode":
        result.outputMode = getValue(args, i, arg);
        i += 1;
        break;
      case "--google-search":
      case "--googleSearch":
        result.googleSearch = true;
        break;
      case "--output-dir":
        result.outputDir = getValue(args, i, arg);
        i += 1;
        break;
      case "--api-key":
        result.apiKey = getValue(args, i, arg);
        i += 1;
        break;
      case "--name-prefix":
        result.namePrefix = getValue(args, i, arg);
        i += 1;
        break;
      default:
        if (arg.startsWith("-")) {
          throw new Error(`Unknown option: ${arg}`);
        }
        promptParts.push(arg);
        break;
    }
  }

  if (!result.prompt && promptParts.length) {
    result.prompt = promptParts.join(" ");
  }

  return result;
}

function normalizeResolution(input) {
  const value = String(input || DEFAULT_RESOLUTION).trim().toLowerCase();
  if (value === "512" || value === "512px") {
    return "512";
  }
  if (value === "1k" || value === "2k" || value === "4k") {
    return value.toUpperCase();
  }
  throw new Error(`Invalid resolution: ${input}. Use 512, 512px, 1K, 2K, or 4K.`);
}

function normalizeThinking(input) {
  const value = String(input || DEFAULT_THINKING).trim().toLowerCase();
  if (["minimal", "low", "medium", "high"].includes(value)) {
    return value;
  }
  throw new Error(`Invalid thinking level: ${input}. Use minimal, low, medium, or high.`);
}

function normalizeOutputMode(input) {
  const value = String(input || DEFAULT_OUTPUT_MODE).trim().toLowerCase();
  if (["images", "image", "images-only", "image-only"].includes(value)) {
    return ["IMAGE"];
  }
  if (["both", "text+images", "text-and-images", "image-and-text"].includes(value)) {
    return ["TEXT", "IMAGE"];
  }
  throw new Error(`Invalid output mode: ${input}. Use images or both.`);
}

function inferOutputDirFromPrompt(prompt) {
  const patterns = [
    /(?:save|write|export|output)\s+(?:to|in|into)\s+["']([^"']+)["']/i,
    /(?:save|write|export|output)\s+(?:to|in|into)\s+([A-Za-z]:\\[^\s,;]+)/i,
    /(?:save|write|export|output)\s+(?:to|in|into)\s+([.]{1,2}[\\/][^\s,;]+)/i,
    /(?:save|write|export|output)\s+(?:to|in|into)\s+([^\s,;]*[\\/][^\s,;]+)/i,
  ];
  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    if (!match) {
      continue;
    }
    const raw = match[1].trim().replace(/[.,;:!?]+$/, "");
    if (!raw || /^https?:\/\//i.test(raw)) {
      continue;
    }
    const resolved = path.resolve(raw);
    return path.extname(resolved) ? path.dirname(resolved) : resolved;
  }
  return "";
}

function guessMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
  };
  return map[ext] || "application/octet-stream";
}

function mimeToExtension(mimeType) {
  const normalized = String(mimeType || "").toLowerCase();
  if (normalized.includes("png")) return "png";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpg";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("gif")) return "gif";
  if (normalized.includes("bmp")) return "bmp";
  if (normalized.includes("tiff")) return "tiff";
  return "png";
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findNextImageIndex(outputDir, prefix) {
  const namePattern = new RegExp(`^${escapeRegex(prefix)}-(\\d+)`, "i");
  let maxIndex = 0;
  for (const entry of fs.readdirSync(outputDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const match = entry.name.match(namePattern);
    if (!match) continue;
    const parsed = Number.parseInt(match[1], 10);
    if (Number.isFinite(parsed) && parsed > maxIndex) {
      maxIndex = parsed;
    }
  }
  return maxIndex + 1;
}

function buildPayload(options) {
  const parts = [{ text: options.prompt }];
  for (const imagePath of options.images) {
    const resolved = path.resolve(imagePath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Reference image not found: ${imagePath}`);
    }
    const data = fs.readFileSync(resolved).toString("base64");
    parts.push({
      inline_data: {
        mime_type: guessMimeType(resolved),
        data,
      },
    });
  }

  const imageConfig = { imageSize: normalizeResolution(options.resolution) };
  if (String(options.aspectRatio || DEFAULT_ASPECT_RATIO).toLowerCase() !== "auto") {
    imageConfig.aspectRatio = options.aspectRatio;
  }

  const payload = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseModalities: normalizeOutputMode(options.outputMode),
      imageConfig,
      thinkingConfig: {
        thinkingLevel: normalizeThinking(options.thinking),
      },
    },
  };

  if (options.googleSearch) {
    payload.tools = [{ googleSearch: {} }];
  }

  return payload;
}

function saveImages(responseJson, outputDir, prefix) {
  const candidates = Array.isArray(responseJson.candidates) ? responseJson.candidates : [];
  let saved = 0;
  let nextImageIndex = findNextImageIndex(outputDir, prefix);

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts || [];
    for (const part of parts) {
      const blob = part.inlineData || part.inline_data;
      if (blob?.data) {
        const ext = mimeToExtension(blob.mimeType || blob.mime_type);
        const fileName = `${prefix}-${String(nextImageIndex).padStart(2, "0")}.${ext}`;
        const fullPath = path.join(outputDir, fileName);
        fs.writeFileSync(fullPath, Buffer.from(blob.data, "base64"));
        console.log(`Saved: ${fullPath}`);
        saved += 1;
        nextImageIndex += 1;
      } else if (part.text) {
        console.log(part.text);
      }
    }
  }

  return saved;
}

async function main() {
  const options = parseArgs(process.argv);
  if (options.help) {
    printHelp();
    return;
  }

  if (!options.apiKey) {
    throw new Error("Missing API key. Set NANOBANANA_GEMINI_API_KEY, GEMINI_API_KEY, or pass --api-key.");
  }
  if (!options.prompt) {
    throw new Error("Missing prompt. Use --prompt or provide a positional prompt.");
  }
  if (options.images.length > MAX_REFERENCE_IMAGES) {
    throw new Error(`Too many reference images (${options.images.length}). Max is ${MAX_REFERENCE_IMAGES}.`);
  }

  const inferredOutputDir = options.outputDir ? "" : inferOutputDirFromPrompt(options.prompt);
  const outputDir = path.resolve(options.outputDir || inferredOutputDir || DEFAULT_OUTPUT_DIR);
  fs.mkdirSync(outputDir, { recursive: true });

  const payload = buildPayload(options);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(options.model)}:generateContent`;

  if (typeof fetch !== "function") {
    throw new Error("Global fetch is unavailable. Use Node.js 18+.");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "x-goog-api-key": options.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await response.text();
  let json = null;
  try {
    json = JSON.parse(body);
  } catch {
    // Keep raw body for easier debugging below.
  }

  if (!response.ok) {
    throw new Error(`Gemini API error ${response.status}: ${json ? JSON.stringify(json, null, 2) : body}`);
  }

  const count = saveImages(json, outputDir, options.namePrefix);
  if (count === 0) {
    console.warn("No image parts found in response.");
  } else {
    console.log(`Done. Saved ${count} image(s) to ${outputDir}`);
  }
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
