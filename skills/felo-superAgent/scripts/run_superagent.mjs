#!/usr/bin/env node

const DEFAULT_API_BASE = 'https://openapi.felo.ai';
const DEFAULT_TIMEOUT_SEC = 60;
const STREAM_IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const RECONNECT_DELAY_MS = 2000;
const HIDDEN_TOOLS = new Set(['manage_outline']);

function usage() {
  console.error(
    [
      'Usage:',
      '  node felo-superAgent/scripts/run_superagent.mjs --query "your question" [options]',
      '',
      'Options:',
      '  --query <text>                 User question (required, 1-2000 chars)',
      '  --thread-id <id>              Existing thread ID for follow-up',
      '  --live-doc-id <id>            Reuse existing LiveDoc short_id',
      '  --skill-id <id>               Skill ID (new conversations only)',
      '  --selected-resource-ids <ids> Comma-separated resource IDs (new conversations only)',
      '  --ext <json>                  Extra params JSON (new conversations only)',
      '  --accept-language <lang>      Language preference (e.g. zh, en)',
      '  --timeout <seconds>           Request/stream timeout, default 60',
      '  --json                        Output JSON with answer, thread_short_id, live_doc_short_id',
      '  --verbose                     Log stream details to stderr',
      '  --help                        Show this help',
    ].join('\n')
  );
}

function parseArgs(argv) {
  const out = {
    query: '',
    threadId: '',
    liveDocId: '',
    skillId: '',
    selectedResourceIds: [],
    ext: null,
    acceptLanguage: '',
    timeoutSec: DEFAULT_TIMEOUT_SEC,
    json: false,
    verbose: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      out.help = true;
    } else if (a === '--json' || a === '-j') {
      out.json = true;
    } else if (a === '--verbose' || a === '-v') {
      out.verbose = true;
    } else if (a === '--query' || a === '-q') {
      out.query = (argv[++i] || '').trim();
    } else if (a === '--thread-id') {
      out.threadId = (argv[++i] || '').trim();
    } else if (a === '--live-doc-id') {
      out.liveDocId = (argv[++i] || '').trim();
    } else if (a === '--skill-id') {
      out.skillId = (argv[++i] || '').trim();
    } else if (a === '--selected-resource-ids') {
      out.selectedResourceIds = (argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
    } else if (a === '--ext') {
      const raw = (argv[++i] || '').trim();
      try {
        out.ext = JSON.parse(raw);
      } catch {
        console.error('Error: --ext must be valid JSON');
        process.exit(1);
      }
    } else if (a === '--accept-language') {
      out.acceptLanguage = (argv[++i] || '').trim();
    } else if (a === '--timeout' || a === '-t') {
      const n = parseInt(argv[++i] || '', 10);
      if (Number.isFinite(n) && n > 0) out.timeoutSec = n;
    } else if (!a.startsWith('-') && !out.query) {
      out.query = a.trim();
    }
  }

  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${getMessage(body)}`);
    if (isApiError(body)) throw new Error(getMessage(body));
    return body;
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error(`Request timed out after ${timeoutMs / 1000}s`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── API ──

async function createConversation(apiKey, apiBase, body, timeoutMs, threadId) {
  const url = threadId
    ? `${apiBase}/v2/conversations/${encodeURIComponent(threadId)}/follow_up`
    : `${apiBase}/v2/conversations`;
  const payload = await fetchJson(
    url,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    timeoutMs
  );
  const data = payload?.data ?? {};
  if (!data.stream_key) throw new Error('Unexpected response: missing stream_key');
  return data;
}

// ── SSE ──

function extractToolParams(data) {
  const out = [];
  const tools = data?.tools;
  if (!Array.isArray(tools)) return out;
  for (const t of tools) {
    if (HIDDEN_TOOLS.has(t?.name) || HIDDEN_TOOLS.has(t?.tool_name)) continue;
    if (t?.name && t?.params) out.push({ name: t.name, params: t.params });
  }
  return out;
}

function extractToolResults(data) {
  const out = [];
  const tools = data?.tools;
  if (!Array.isArray(tools)) return out;
  for (const t of tools) {
    if (HIDDEN_TOOLS.has(t?.name) || HIDDEN_TOOLS.has(t?.tool_name)) continue;
    const callResult = t?.call_result;
    if (t?.tool_name === 'generate_images' || t?.name === 'generate_images') {
      if (!callResult) continue;
      if (Array.isArray(callResult)) {
        for (const item of callResult) {
          if (item?.image_url) out.push({ type: 'image', title: item?.title || '', image_url: item.image_url });
        }
      } else if (callResult?.images && Array.isArray(callResult.images)) {
        for (const img of callResult.images) {
          if (img?.image_url) out.push({ type: 'image', title: img?.title || '', image_url: img.image_url });
        }
      } else if (callResult?.image_url) {
        out.push({ type: 'image', title: callResult?.title || '', image_url: callResult.image_url });
      }
    }
    if (t?.name === 'generate_discovery' && callResult?.status === 'success') {
      out.push({ type: 'discovery', title: callResult?.title || t?.params?.title || 'Discovery' });
    }
    if (t?.name === 'generate_document' && callResult?.status === 'success') {
      out.push({ type: 'document', title: callResult?.title || t?.params?.title || 'Document' });
    }
    if (t?.name === 'generate_ppt' && callResult?.status === 'success') {
      out.push({ type: 'ppt', title: callResult?.title || t?.params?.title || 'PPT' });
    }
    if (t?.name === 'generate_html' && callResult?.status === 'success') {
      out.push({ type: 'html', title: callResult?.title || t?.params?.title || 'HTML' });
    }
    if (t?.name === 'search_x' && callResult?.tweets && Array.isArray(callResult.tweets)) {
      out.push({ type: 'search_x', status: callResult.status, tweets: callResult.tweets });
    }
  }
  return out;
}

function dispatch(eventType, dataStr, callbacks) {
  const { onMessage, onToolCall, onToolResult } = callbacks;
  let payload = {};
  if (dataStr) {
    try {
      payload = JSON.parse(dataStr);
    } catch {
      payload = { content: dataStr };
    }
  }

  switch (eventType) {
    case 'message':
      if (typeof payload.content === 'string') onMessage(payload.content);
      break;
    case 'stream': {
      const content = payload?.content;
      if (typeof content === 'string') {
        try {
          const inner = JSON.parse(content);
          const type = inner?.type;
          const data = inner?.data;
          if (type === 'content' || type === 'text' || type === 'delta' || type === 'answer') {
            const text = data?.content ?? data?.text ?? data?.delta;
            if (typeof text === 'string') onMessage(text);
          } else if (type === 'tools' && onToolCall) {
            const params = extractToolParams(data);
            for (const item of params) onToolCall(item);
          } else if ((type === 'tools_result_stream' || type === 'tools_result') && onToolResult) {
            const results = extractToolResults(data);
            for (const item of results) onToolResult(item);
          } else if (type !== 'processing' && type !== 'tools' && type !== 'message' && data?.message && typeof data.message === 'string') {
            onMessage(data.message);
          }
        } catch {
          onMessage(content);
        }
      }
      break;
    }
    case 'heartbeat':
    case 'connected':
      break;
    default:
      break;
  }
}

async function readSSE(url, apiKey, startOffset, callbacks) {
  const { onMessage, onDone, onEvent, onToolCall, onToolResult } = callbacks;
  const controller = new AbortController();
  let idleTimer = null;
  const resetIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => controller.abort(), STREAM_IDLE_TIMEOUT_MS);
  };

  const connectUrl = startOffset >= 0 ? `${url}?offset=${startOffset}` : url;
  let maxOffset = startOffset;
  let streamDone = false;

  try {
    const res = await fetch(connectUrl, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      let msg = text;
      try {
        const j = JSON.parse(text);
        msg = getMessage(j) || text;
      } catch {}
      throw new Error(`HTTP ${res.status}: ${msg}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = '';
    let currentData = undefined;

    const processEvent = (evt, data) => {
      if (!evt || data === undefined) return;
      let eventOffset = -1;
      try {
        const parsed = JSON.parse(data);
        if (typeof parsed?.offset === 'number') {
          eventOffset = parsed.offset;
          if (parsed.offset > maxOffset) maxOffset = parsed.offset;
        }
      } catch {}

      if (eventOffset >= 0 && eventOffset <= startOffset) return;

      if (onEvent) onEvent(evt, data);

      if (evt === 'error') return; // server "not ready yet" signal, keep reading
      if (evt === 'done' || evt === 'completed' || evt === 'complete') {
        streamDone = true;
        onDone();
        return;
      }
      dispatch(evt, data, { onMessage, onToolCall, onToolResult });
    };

    resetIdleTimer();
    while (true) {
      const { done, value } = await reader.read();
      resetIdleTimer();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('event:')) {
          processEvent(currentEvent, currentData);
          currentEvent = line.slice(6).trim();
          currentData = undefined;
        } else if (line.startsWith('data:')) {
          currentData = line.slice(5).trim();
        } else if (line === '') {
          processEvent(currentEvent, currentData);
          currentEvent = '';
          currentData = undefined;
        }
      }
    }

    if (idleTimer) clearTimeout(idleTimer);
    processEvent(currentEvent, currentData);
  } catch (err) {
    if (idleTimer) clearTimeout(idleTimer);
    if (err?.name === 'AbortError') {
      return { maxOffset, streamDone, streamError: `Stream idle timeout (no data for ${STREAM_IDLE_TIMEOUT_MS / 1000}s)` };
    }
    throw err;
  }

  return { maxOffset, streamDone, streamError: null };
}

async function consumeStream(apiKey, apiBase, streamKey, callbacks) {
  const url = `${apiBase}/v2/conversations/stream/${encodeURIComponent(streamKey)}`;
  let lastOffset = -1;
  const startTime = Date.now();

  while (true) {
    if (Date.now() - startTime > STREAM_IDLE_TIMEOUT_MS) {
      callbacks.onError('Stream timeout: no completion after ' + (STREAM_IDLE_TIMEOUT_MS / 1000) + 's');
      return;
    }

    const result = await readSSE(url, apiKey, lastOffset, callbacks);

    if (result.streamDone) return;
    if (result.maxOffset > lastOffset) lastOffset = result.maxOffset;

    await sleep(RECONNECT_DELAY_MS);
  }
}

// ── Format helpers ──

function formatTweet(tweet) {
  const info = tweet?.other_info || {};
  const author = info.author || {};
  const metrics = info.metrics || {};
  const name = author.display_name || author.username || 'Unknown';
  const handle = author.username ? `@${author.username}` : '';
  const text = tweet?.snippet || tweet?.title || '';
  const link = tweet?.link || info.url || '';
  const stats = [];
  if (metrics.favorite_count) stats.push(`${metrics.favorite_count} likes`);
  if (metrics.retweet_count) stats.push(`${metrics.retweet_count} retweets`);
  if (metrics.view_count) stats.push(`${metrics.view_count} views`);
  const statsStr = stats.length > 0 ? `  [${stats.join(' | ')}]` : '';
  return `  ${name} (${handle})${statsStr}\n  ${text}\n  ${link}`;
}

// ── Main ──

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }
  if (!args.query) {
    usage();
    process.exit(1);
  }

  const apiKey = process.env.FELO_API_KEY?.trim();
  if (!apiKey) {
    console.error(
      'ERROR: FELO_API_KEY not set\n\n' +
      'To use SuperAgent, set FELO_API_KEY:\n' +
      '  export FELO_API_KEY="your-api-key-here"\n' +
      'Get your API key from https://felo.ai (Settings -> API Keys).'
    );
    process.exit(1);
  }

  const apiBase = (process.env.FELO_API_BASE?.trim() || DEFAULT_API_BASE).replace(/\/$/, '');
  const timeoutMs = args.timeoutSec * 1000;

  // Build request body
  const body = { query: args.query.slice(0, 2000) };
  if (args.liveDocId) body.live_doc_short_id = args.liveDocId;
  if (args.acceptLanguage) body.accept_language = args.acceptLanguage;

  const threadId = args.threadId || undefined;

  // skill_id, selected_resource_ids, ext only for new conversations
  if (threadId && (args.skillId || args.selectedResourceIds.length || args.ext)) {
    process.stderr.write('Warning: --skill-id, --selected-resource-ids, --ext are ignored in follow-up mode.\n');
  }
  if (!threadId) {
    if (args.skillId) body.skill_id = args.skillId;
    if (args.selectedResourceIds.length) body.selected_resource_ids = args.selectedResourceIds;
    if (args.ext) body.ext = args.ext;
  }

  process.stderr.write(threadId ? 'SuperAgent: following up...\n' : 'SuperAgent: creating conversation...\n');

  const createData = await createConversation(apiKey, apiBase, body, timeoutMs, threadId);
  const { stream_key, thread_short_id, live_doc_short_id } = createData;

  if (args.verbose) {
    process.stderr.write(`Stream key: ${stream_key}\n`);
    process.stderr.write(`Thread ID: ${thread_short_id}\n`);
    process.stderr.write(`LiveDoc ID: ${live_doc_short_id}\n`);
  }

  const feloBase = (process.env.FELO_WEB_BASE?.trim() || apiBase.replace(/\/\/openapi-/, '//').replace(/\/\/openapi\./, '//')).replace(/\/$/, '');
  const liveDocUrl = live_doc_short_id ? `${feloBase}/zh-Hans/livedoc/${live_doc_short_id}` : '';

  const chunks = [];
  const toolResults = [];
  const seenKeys = new Set();
  const isJson = args.json;

  const onToolCall = (item) => {
    if (isJson) return;
    const { name, params } = item;
    console.log(`\n[Tool: ${name}]`);
    if (name === 'search_x') {
      console.log(`  Query: ${params.query || ''}`);
      if (params.query_type) console.log(`  Type: ${params.query_type}`);
      if (params.limit) console.log(`  Limit: ${params.limit}`);
    } else if (name === 'generate_images') {
      const images = params?.images;
      if (Array.isArray(images)) {
        for (const img of images) console.log(`  Image: ${img.title || '(untitled)'}`);
      }
    } else if (name === 'generate_discovery') {
      console.log(`  Title: ${params.title || params.query || ''}`);
    } else if (name === 'generate_document') {
      console.log(`  Title: ${params.title || ''}`);
    } else if (name === 'generate_ppt') {
      console.log(`  Title: ${params.title || ''}`);
    } else if (name === 'generate_html') {
      console.log(`  Title: ${params.title || ''}`);
    } else {
      console.log(`  Params: ${JSON.stringify(params)}`);
    }
  };

  const onToolResult = (item) => {
    const LIVEDOC_TYPES = new Set(['document', 'ppt', 'html', 'discovery']);
    const key = item?.image_url || (LIVEDOC_TYPES.has(item?.type) ? item.type : `${item?.type}:${item?.title}`);
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    toolResults.push(item);

    if (isJson) return;
    if (item.type === 'image') {
      console.log(liveDocUrl ? `[${item.title || 'Image'}](${liveDocUrl})` : item.image_url);
    } else if (item.type === 'discovery') {
      console.log(liveDocUrl ? `[${item.title}](${liveDocUrl})` : item.title);
    } else if (item.type === 'document') {
      console.log(liveDocUrl ? `[${item.title || 'Document'}](${liveDocUrl})` : (item.title || 'Document'));
    } else if (item.type === 'ppt') {
      console.log(liveDocUrl ? `[${item.title || 'PPT'}](${liveDocUrl})` : (item.title || 'PPT'));
    } else if (item.type === 'html') {
      console.log(liveDocUrl ? `[${item.title || 'HTML'}](${liveDocUrl})` : (item.title || 'HTML'));
    } else if (item.type === 'search_x') {
      console.log(`\n[Twitter Search Results] (${item.tweets.length} tweets)`);
      for (const tweet of item.tweets) {
        console.log(formatTweet(tweet));
        console.log('');
      }
    }
  };

  let streamError = null;
  const onEvent = args.verbose
    ? (eventType, dataStr) => {
        process.stderr.write(`[stream] event=${eventType}\n`);
        process.stderr.write(`[stream] data=${dataStr || ''}\n`);
      }
    : undefined;

  await consumeStream(apiKey, apiBase, stream_key, {
    onMessage: (content) => {
      chunks.push(content);
      if (!isJson) process.stdout.write(content);
    },
    onError: (err) => {
      streamError = err;
    },
    onDone: () => {},
    onEvent,
    onToolCall,
    onToolResult,
  });

  if (streamError) throw new Error(streamError);

  const answer = chunks.join('').trim();

  if (isJson) {
    const images = toolResults.filter((r) => r.type === 'image');
    const discoveries = toolResults.filter((r) => r.type === 'discovery');
    const documents = toolResults.filter((r) => r.type === 'document');
    const ppts = toolResults.filter((r) => r.type === 'ppt');
    const htmls = toolResults.filter((r) => r.type === 'html');
    const searches = toolResults.filter((r) => r.type === 'search_x');
    console.log(
      JSON.stringify(
        {
          status: 'ok',
          data: {
            answer: answer || null,
            thread_short_id: thread_short_id ?? null,
            live_doc_short_id: live_doc_short_id ?? null,
            image_urls: images.length > 0 ? images.map((r) => ({ url: r.image_url, title: r.title })) : undefined,
            discoveries: discoveries.length > 0 ? discoveries.map((r) => ({ title: r.title })) : undefined,
            documents: documents.length > 0 ? documents.map((r) => ({ title: r.title })) : undefined,
            ppts: ppts.length > 0 ? ppts.map((r) => ({ title: r.title })) : undefined,
            htmls: htmls.length > 0 ? htmls.map((r) => ({ title: r.title })) : undefined,
            search_x: searches.length > 0 ? searches.map((r) => ({ tweets: r.tweets })) : undefined,
            live_doc_url: liveDocUrl || undefined,
          },
        },
        null,
        2
      )
    );
  } else {
    if (answer) console.log('');
    if (!answer && toolResults.length === 0) console.log('(No content in stream)');
    process.stderr.write(`\n[state] thread_short_id=${thread_short_id || ''} live_doc_short_id=${live_doc_short_id || ''} live_doc_url=${liveDocUrl || ''}\n`);
  }
}

main().catch((err) => {
  console.error(`ERROR: ${err?.message || err}`);
  process.exit(1);
});
