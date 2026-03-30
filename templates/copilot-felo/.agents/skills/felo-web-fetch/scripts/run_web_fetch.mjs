#!/usr/bin/env node

const DEFAULT_API_BASE = 'https://openapi.felo.ai';
const DEFAULT_TIMEOUT_SEC = 60;
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const SPINNER_INTERVAL_MS = 80;
const STATUS_PAD = 56;

function startSpinner(message) {
  const start = Date.now();
  let i = 0;
  const id = setInterval(() => {
    const elapsed = Math.floor((Date.now() - start) / 1000);
    const line = `${message} ${SPINNER_FRAMES[i % SPINNER_FRAMES.length]} ${elapsed}s`;
    process.stderr.write(`\r${line.padEnd(STATUS_PAD, ' ')}`);
    i += 1;
  }, SPINNER_INTERVAL_MS);
  return id;
}

function stopSpinner(id) {
  if (id != null) clearInterval(id);
  process.stderr.write(`\r${' '.repeat(STATUS_PAD)}\r`);
}

function usage() {
  console.error(
    [
      'Usage:',
      '  node felo-web-fetch/scripts/run_web_fetch.mjs --url <url> [options]',
      '',
      'Required:',
      '  --url <url>                    Target page URL',
      '',
      'Options:',
      '  --output-format <format>       html | markdown | text',
      '  --crawl-mode <mode>            fast | fine',
      '  --target-selector <selector>   CSS selector for target extraction',
      '  --wait-for-selector <selector> Wait until selector appears',
      '  --cookie <cookie>              Add cookie entry (repeatable)',
      '  --set-cookies-json <json>      JSON array for set_cookies',
      '  --user-agent <ua>              Custom user-agent',
      '  --timeout <seconds>            Request timeout in seconds (default 60)',
      '  --request-timeout-ms <ms>      API timeout parameter in milliseconds',
      '  --with-readability <bool>      true | false',
      '  --with-links-summary <bool>    true | false',
      '  --with-images-summary <bool>   true | false',
      '  --with-images-readability <bool> true | false',
      '  --with-images <bool>           true | false',
      '  --with-links <bool>            true | false',
      '  --ignore-empty-text-image <bool> true | false',
      '  --with-cache <bool>            true | false',
      '  --with-stypes <bool>           true | false',
      '  --json                         Print full JSON response',
      '  --help                         Show this help',
    ].join('\n')
  );
}

function parseBool(v, name) {
  if (typeof v !== 'string') {
    throw new Error(`Missing value for ${name}`);
  }
  const normalized = v.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  throw new Error(`Invalid boolean for ${name}: ${v}. Use true or false.`);
}

function parseArgs(argv) {
  const out = {
    url: '',
    outputFormat: '',
    crawlMode: '',
    targetSelector: '',
    waitForSelector: '',
    cookies: [],
    cookiesJson: '',
    userAgent: '',
    timeoutSec: DEFAULT_TIMEOUT_SEC,
    requestTimeoutMs: null,
    withReadability: null,
    withLinksSummary: null,
    withImagesSummary: null,
    withImagesReadability: null,
    withImages: null,
    withLinks: null,
    ignoreEmptyTextImage: null,
    withCache: null,
    withStypes: null,
    json: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      out.help = true;
    } else if (a === '--json') {
      out.json = true;
    } else if (a === '--url') {
      out.url = argv[i + 1] ?? '';
      i += 1;
    } else if (a === '--output-format') {
      out.outputFormat = (argv[i + 1] ?? '').trim().toLowerCase();
      i += 1;
    } else if (a === '--crawl-mode') {
      out.crawlMode = (argv[i + 1] ?? '').trim().toLowerCase();
      i += 1;
    } else if (a === '--target-selector') {
      out.targetSelector = argv[i + 1] ?? '';
      i += 1;
    } else if (a === '--wait-for-selector') {
      out.waitForSelector = argv[i + 1] ?? '';
      i += 1;
    } else if (a === '--cookie') {
      const value = argv[i + 1] ?? '';
      if (value) out.cookies.push(value);
      i += 1;
    } else if (a === '--set-cookies-json') {
      out.cookiesJson = argv[i + 1] ?? '';
      i += 1;
    } else if (a === '--user-agent') {
      out.userAgent = argv[i + 1] ?? '';
      i += 1;
    } else if (a === '--timeout') {
      out.timeoutSec = Number.parseInt(argv[i + 1] ?? '', 10);
      i += 1;
    } else if (a === '--request-timeout-ms') {
      out.requestTimeoutMs = Number.parseInt(argv[i + 1] ?? '', 10);
      i += 1;
    } else if (a === '--with-readability') {
      out.withReadability = parseBool(argv[i + 1], '--with-readability');
      i += 1;
    } else if (a === '--with-links-summary') {
      out.withLinksSummary = parseBool(argv[i + 1], '--with-links-summary');
      i += 1;
    } else if (a === '--with-images-summary') {
      out.withImagesSummary = parseBool(argv[i + 1], '--with-images-summary');
      i += 1;
    } else if (a === '--with-images-readability') {
      out.withImagesReadability = parseBool(argv[i + 1], '--with-images-readability');
      i += 1;
    } else if (a === '--with-images') {
      out.withImages = parseBool(argv[i + 1], '--with-images');
      i += 1;
    } else if (a === '--with-links') {
      out.withLinks = parseBool(argv[i + 1], '--with-links');
      i += 1;
    } else if (a === '--ignore-empty-text-image') {
      out.ignoreEmptyTextImage = parseBool(argv[i + 1], '--ignore-empty-text-image');
      i += 1;
    } else if (a === '--with-cache') {
      out.withCache = parseBool(argv[i + 1], '--with-cache');
      i += 1;
    } else if (a === '--with-stypes') {
      out.withStypes = parseBool(argv[i + 1], '--with-stypes');
      i += 1;
    }
  }

  if (!Number.isFinite(out.timeoutSec) || out.timeoutSec <= 0) {
    out.timeoutSec = DEFAULT_TIMEOUT_SEC;
  }
  if (out.requestTimeoutMs !== null && (!Number.isFinite(out.requestTimeoutMs) || out.requestTimeoutMs <= 0)) {
    out.requestTimeoutMs = null;
  }
  return out;
}

function ensureInSet(value, allowed, fieldName) {
  if (!value) return;
  if (!allowed.includes(value)) {
    throw new Error(`Invalid ${fieldName}: ${value}. Allowed values: ${allowed.join(', ')}`);
  }
}

function isApiError(payload) {
  if (typeof payload?.code === 'number') {
    return payload.code !== 0;
  }
  if (typeof payload?.status === 'string') {
    return payload.status.toLowerCase() === 'error';
  }
  return false;
}

function getMessage(payload) {
  return String(payload?.message || payload?.error || payload?.msg || 'Unknown error');
}

async function fetchJson(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    let body = {};
    try {
      body = await res.json();
    } catch {
      body = {};
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${getMessage(body)}`);
    }
    if (isApiError(body)) {
      throw new Error(getMessage(body));
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

function buildPayload(args) {
  const payload = {
    url: args.url,
  };

  if (args.outputFormat) payload.output_format = args.outputFormat;
  if (args.crawlMode) payload.crawl_mode = args.crawlMode;
  if (args.targetSelector) payload.target_selector = args.targetSelector;
  if (args.waitForSelector) payload.wait_for_selector = args.waitForSelector;
  if (args.userAgent) payload.user_agent = args.userAgent;
  if (args.requestTimeoutMs !== null) payload.timeout = args.requestTimeoutMs;

  if (args.cookies.length) payload.set_cookies = args.cookies;
  if (args.cookiesJson) {
    try {
      const parsed = JSON.parse(args.cookiesJson);
      if (!Array.isArray(parsed)) {
        throw new Error('set_cookies JSON must be an array');
      }
      payload.set_cookies = parsed;
    } catch (err) {
      throw new Error(`Invalid --set-cookies-json: ${String(err.message || err)}`);
    }
  }

  if (args.withReadability !== null) payload.with_readability = args.withReadability;
  if (args.withLinksSummary !== null) payload.with_links_summary = args.withLinksSummary;
  if (args.withImagesSummary !== null) payload.with_images_summary = args.withImagesSummary;
  if (args.withImagesReadability !== null) payload.with_images_readability = args.withImagesReadability;
  if (args.withImages !== null) payload.with_images = args.withImages;
  if (args.withLinks !== null) payload.with_links = args.withLinks;
  if (args.ignoreEmptyTextImage !== null) payload.ignore_empty_text_image = args.ignoreEmptyTextImage;
  if (args.withCache !== null) payload.with_cache = args.withCache;
  if (args.withStypes !== null) payload.with_stypes = args.withStypes;

  return payload;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }

  if (!args.url) {
    usage();
    process.exit(1);
  }

  ensureInSet(args.outputFormat, ['html', 'markdown', 'text'], 'output-format');
  ensureInSet(args.crawlMode, ['fast', 'fine'], 'crawl-mode');

  const apiKey = process.env.FELO_API_KEY?.trim();
  if (!apiKey) {
    console.error('ERROR: FELO_API_KEY not set');
    process.exit(1);
  }

  const apiBase = (process.env.FELO_API_BASE?.trim() || DEFAULT_API_BASE).replace(/\/$/, '');
  const payload = buildPayload(args);

  const shortUrl = args.url.length > 45 ? args.url.slice(0, 42) + '...' : args.url;
  const spinnerId = startSpinner(`Fetching ${shortUrl}`);

  try {
    const response = await fetchJson(
      `${apiBase}/v2/web/extract`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
      args.timeoutSec * 1000
    );

    if (args.json) {
      console.log(JSON.stringify(response, null, 2));
      return;
    }

    const content = response?.data?.content;
    if (typeof content === 'string') {
      console.log(content);
      return;
    }

    console.log(JSON.stringify(content ?? response?.data ?? response, null, 2));
  } catch (err) {
    console.error(`ERROR: ${String(err?.message || err || 'Unknown error')}`);
    process.exit(1);
  } finally {
    stopSpinner(spinnerId);
  }
}

main();
