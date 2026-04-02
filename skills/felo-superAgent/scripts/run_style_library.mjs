#!/usr/bin/env node

const DEFAULT_API_BASE = 'https://openapi.felo.ai';
const DEFAULT_TIMEOUT_SEC = 60;

const VALID_CATEGORIES = ['TWITTER', 'INSTAGRAM', 'LEMON8', 'NOTECOM', 'WEBSITE', 'IMAGE'];

function usage() {
  console.error(
    [
      'Usage:',
      '  node felo-superAgent/scripts/run_style_library.mjs --category <category> [options]',
      '',
      'Options:',
      '  --category <category>        Style category (required)',
      `                               One of: ${VALID_CATEGORIES.join(', ')}`,
      '  --accept-language <lang>     Language for labels/tags (e.g. en, zh-Hans, ja). Default: en',
      '  --json                       Output raw JSON',
      '  --timeout <seconds>          Request timeout, default 60',
      '  --help                       Show this help',
    ].join('\n')
  );
}

function parseArgs(argv) {
  const out = {
    category: '',
    acceptLanguage: 'en',
    json: false,
    timeoutSec: DEFAULT_TIMEOUT_SEC,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      out.help = true;
    } else if (a === '--json' || a === '-j') {
      out.json = true;
    } else if (a === '--category' || a === '-c') {
      out.category = (argv[++i] || '').trim().toUpperCase();
    } else if (a === '--accept-language') {
      out.acceptLanguage = (argv[++i] || 'en').trim();
    } else if (a === '--timeout' || a === '-t') {
      const n = parseInt(argv[++i] || '', 10);
      if (Number.isFinite(n) && n > 0) out.timeoutSec = n;
    }
  }

  return out;
}

function getMessage(payload) {
  return payload?.message || payload?.error || payload?.msg || payload?.code || 'Unknown error';
}

function isApiError(payload) {
  const status = payload?.status;
  const code = payload?.code;
  if (typeof status === 'string' && status.toLowerCase() === 'error') return true;
  if (typeof code === 'string' && code && code.toUpperCase() !== 'OK') return true;
  return false;
}

/**
 * Pick the best matching value from a multilingual map object.
 * Falls back through: exact match → base language (e.g. "zh" for "zh-Hans") → "en" → first available.
 * Returns an array (may be empty).
 */
function pickLangValue(map, lang) {
  if (!map || typeof map !== 'object') return [];
  if (map[lang]) return map[lang];
  // Try base language (e.g. "zh" from "zh-Hans")
  const base = lang.split('-')[0];
  if (base !== lang && map[base]) return map[base];
  // Fallback to English
  if (map['en']) return map['en'];
  // Last resort: first available key
  const first = Object.values(map)[0];
  return Array.isArray(first) ? first : [];
}

/**
 * Format a single style entry into the brand_style_requirement string.
 * Fields included (null/empty fields are omitted):
 *   Style name: <name>
 *   Style labels: <label1, label2>   (from content.labels, language-aware)
 *   Style DNA: <styleDna>            (from content.styleDna, TWITTER type)
 *   Cover file ID: <coverFileId>     (omitted if null/empty)
 */
function formatStyle(s, lang) {
  const lines = [];

  // Style name (always present)
  lines.push(`Style name: ${s.name ?? ''}`);

  const content = s.content ?? {};

  // Style labels — multilingual map (content.labels for TWITTER, content.tags for others)
  const labelsMap = content.labels ?? content.tags ?? null;
  if (labelsMap) {
    const labelArr = pickLangValue(labelsMap, lang);
    if (labelArr.length > 0) {
      lines.push(`Style labels: ${labelArr.join(', ')}`);
    }
  }

  // Style DNA (TWITTER type)
  if (typeof content.styleDna === 'string' && content.styleDna.trim()) {
    lines.push(`Style DNA: ${content.styleDna.trim()}`);
  }

  // Cover file ID — omit if null/empty
  const coverId = s.coverFileId ?? s.cover_file_id ?? null;
  if (coverId) {
    lines.push(`Cover file ID: ${coverId}`);
  }

  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    usage();
    process.exit(0);
  }

  if (!args.category) {
    console.error('Error: --category is required');
    usage();
    process.exit(1);
  }

  if (!VALID_CATEGORIES.includes(args.category)) {
    console.error(`Error: invalid category "${args.category}". Must be one of: ${VALID_CATEGORIES.join(', ')}`);
    process.exit(1);
  }

  const apiKey = process.env.FELO_API_KEY?.trim();
  if (!apiKey) {
    console.error(
      'ERROR: FELO_API_KEY not set\n\n' +
      'To use this script, set FELO_API_KEY:\n' +
      '  export FELO_API_KEY="your-api-key-here"\n' +
      'Get your API key from https://felo.ai (Settings -> API Keys).'
    );
    process.exit(1);
  }

  const apiBase = (process.env.FELO_API_BASE?.trim() || DEFAULT_API_BASE).replace(/\/$/, '');
  const timeoutMs = args.timeoutSec * 1000;

  const params = new URLSearchParams();
  params.set('category', args.category);
  const url = `${apiBase}/v2/brand/style-library/list?${params.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    });

    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${getMessage(data)}`);
    }
    if (isApiError(data)) {
      throw new Error(getMessage(data));
    }

    const list = data?.data?.list ?? [];

    if (args.json) {
      console.log(JSON.stringify(data?.data ?? {}, null, 2));
    } else {
      if (list.length === 0) {
        console.log('(No styles found)');
      } else {
        // User styles first, then recommended styles
        const userStyles = list.filter((s) => !s.recommended);
        const recommendedStyles = list.filter((s) => s.recommended);
        const allFormatted = [...userStyles, ...recommendedStyles].map((s) => formatStyle(s, args.acceptLanguage));
        console.log(allFormatted.join('\n\n'));
      }
    }
  } catch (err) {
    if (err?.name === 'AbortError') {
      console.error(`Error: Request timed out after ${timeoutMs / 1000}s`);
    } else {
      console.error(`Error: ${err?.message || err}`);
    }
    process.exit(1);
  } finally {
    clearTimeout(timer);
  }
}

main();
