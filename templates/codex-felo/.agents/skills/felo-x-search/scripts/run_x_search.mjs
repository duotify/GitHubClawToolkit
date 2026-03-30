#!/usr/bin/env node

const DEFAULT_API_BASE = 'https://openapi.felo.ai';
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getMessage(payload) {
  return payload?.message || payload?.error || payload?.msg || payload?.code || 'Unknown error';
}

async function fetchWithRetry(url, init, timeoutMs) {
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      if (res.status >= 500 && attempt < MAX_RETRIES) {
        await sleep(RETRY_BASE_MS * Math.pow(2, attempt));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (err.name === 'AbortError') throw new Error(`Request timed out after ${timeoutMs / 1000}s`);
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_BASE_MS * Math.pow(2, attempt));
        continue;
      }
      throw lastError;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

async function postApi(apiBase, apiKey, path, body, timeoutMs) {
  const res = await fetchWithRetry(
    `${apiBase}/v2${path}`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );
  let data = {};
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${getMessage(data)}`);
  if (data.status === 'error') throw new Error(getMessage(data));
  return data;
}

// ── Formatting ──

function formatNumber(num) {
  if (num == null) return '0';
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
}

// Tweet ID must be a non-empty numeric string; username must be 1–15 word chars
const TWEET_ID_RE = /^\d+$/;
const USERNAME_RE = /^\w{1,15}$/;

function buildTweetUrl(id, username) {
  const validId = typeof id === 'string' && TWEET_ID_RE.test(id.trim());
  const validUsername = typeof username === 'string' && USERNAME_RE.test(username.trim());

  if (!validId) return null;

  const base = validUsername
    ? `https://x.com/${username.trim()}/status/${id.trim()}`
    : `https://x.com/i/web/status/${id.trim()}`;

  // Structural check via URL constructor — catches any remaining edge cases
  try {
    new URL(base);
    return base;
  } catch {
    return null;
  }
}

function formatUser(u, headerLevel = 2) {
  if (!u) return '';
  const h = '#'.repeat(Math.min(6, headerLevel));
  let badge = '';
  if (u.blue_verified) badge = ' 🔵';
  else if (u.verified) badge = ' ✓';

  let out = `${h} @${u.username} (${u.display_name || u.username}${badge})\n`;
  out += `- User ID: \`${u.user_id}\`\n`;
  if (u.verified_type) out += `- Verification Type: ${u.verified_type}\n`;
  const status = [];
  if (u.protected) status.push('Protected (Private)');
  if (u.is_automated) status.push('Automated');
  if (status.length) out += `- Account Status: ${status.join(' | ')}\n`;
  out += `- Followers: ${formatNumber(u.followers_count)}\n`;
  out += `- Following: ${formatNumber(u.following_count)}\n`;
  out += `- Total Tweets: ${formatNumber(u.tweet_count)}\n`;
  if (u.favorites_count > 0) out += `- Likes Given: ${formatNumber(u.favorites_count)}\n`;
  if (u.media_count > 0) out += `- Media Count: ${formatNumber(u.media_count)}\n`;
  if (u.description) out += `- Bio: ${u.description}\n`;
  if (u.location) out += `- Location: ${u.location}\n`;
  if (u.url) out += `- Website: ${u.url}\n`;
  if (u.can_dm) out += `- Direct Messages: Open\n`;
  if (u.profile_image_url) out += `- Profile Image: ${u.profile_image_url}\n`;
  if (u.cover_image_url) out += `- Cover Image: ${u.cover_image_url}\n`;
  if (u.pinned_tweet_ids?.length) out += `- Pinned Tweets: ${u.pinned_tweet_ids.length} tweet(s)\n`;
  if (u.created_at) out += `- Account Created: ${u.created_at}\n`;
  out += '\n---\n\n';
  return out;
}

function formatTweet(t, indent = '', headerLevel = 3) {
  if (!t) return '';
  const h = '#'.repeat(Math.min(6, headerLevel));
  const author = t.author || {};
  const verified = author.verified ? ' ✓' : '';

  let out = `${indent}${h} @${author.username || 'unknown'}(${author.display_name || author.username || 'unknown'}${verified})\n`;
  const tweetUrl = buildTweetUrl(t.id, author.username);
  const tweetLink = tweetUrl ? `[🐦 查看推文](${tweetUrl})` : `Tweet ID: \`${t.id}\``;
  const meta = [`Posted: ${t.created_at || 'unknown'}`, tweetLink];
  if (t.conversation_id) meta.push(`Conversation: \`${t.conversation_id}\``);
  if (t.is_reply && t.in_reply_to_username) meta.push(`Reply to @${t.in_reply_to_username}`);
  out += `${indent}- ${meta.join(' ｜ ')}\n\n`;

  for (const line of (t.content || '').split('\n')) {
    out += `${indent}${line}\n`;
  }
  out += '\n';

  const metrics = t.metrics || {};
  const parts = [];
  if (metrics.favorite_count) parts.push(`${formatNumber(metrics.favorite_count)} likes`);
  if (metrics.retweet_count) parts.push(`${formatNumber(metrics.retweet_count)} retweets`);
  if (metrics.reply_count) parts.push(`${formatNumber(metrics.reply_count)} replies`);
  if (parts.length) out += `${indent}Engagement: ${parts.join(' ｜ ')}\n`;

  if (Array.isArray(t.media_urls) && t.media_urls.length) {
    out += `${indent}Media (${t.media_urls.length}):\n`;
    for (const media of t.media_urls) {
      const type = media.type || 'photo';
      if (type === 'video') {
        out += `${indent}  • [video] ${media.url || ''}\n`;
      } else {
        out += `${indent}  • [photo] ${media.thumbnail || ''}\n`;
      }
    }
  }

  out += `\n${indent}---\n\n`;
  return out;
}

// ── CLI ──

function usage() {
  console.error(
    [
      'Usage:',
      '  node felo-x-search/scripts/run_x_search.mjs [query] [options]',
      '',
      'Examples:',
      '  run_x_search.mjs "AI news"                  Search tweets (default)',
      '  run_x_search.mjs "OpenAI" --user             Search users',
      '  run_x_search.mjs --id "1234567890"           Get tweet replies',
      '  run_x_search.mjs --id "elonmusk" --user      Get user info',
      '  run_x_search.mjs --id "elonmusk" --user --tweets  Get user tweets',
      '',
      'Options:',
      '  -q, --query <text>     Search keyword (same as positional arg)',
      '  --id <values>          Tweet IDs or usernames (comma-separated)',
      '  --user                 Switch to user mode',
      '  --tweets               Get user tweets (with --id --user)',
      '  -l, --limit <n>        Number of results',
      '  --cursor <str>         Pagination cursor',
      '  --include-replies      Include replies (with --tweets)',
      '  --query-type <type>    Query type filter',
      '  --since-time <val>     Start time filter',
      '  --until-time <val>     End time filter',
      '  -j, --json             Output raw JSON',
      '  -t, --timeout <seconds> Request timeout in seconds (default: 30)',
      '  --help                 Show this help',
    ].join('\n'),
  );
}

function parseArgs(argv) {
  const out = {
    query: '',
    ids: [],
    user: false,
    tweets: false,
    limit: 0,
    cursor: '',
    includeReplies: false,
    queryType: '',
    sinceTime: null,
    untilTime: null,
    json: false,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    help: false,
  };

  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') { out.help = true; }
    else if (a === '--json' || a === '-j') { out.json = true; }
    else if (a === '--user') { out.user = true; }
    else if (a === '--tweets') { out.tweets = true; }
    else if (a === '--include-replies') { out.includeReplies = true; }
    else if (a === '-q' || a === '--query') { out.query = (argv[++i] || '').trim(); }
    else if (a === '--id') { out.ids = (argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean); }
    else if (a === '-l' || a === '--limit') { out.limit = parseInt(argv[++i] || '', 10) || 0; }
    else if (a === '--cursor') { out.cursor = (argv[++i] || '').trim(); }
    else if (a === '--query-type') { out.queryType = (argv[++i] || '').trim(); }
    else if (a === '--since-time') { out.sinceTime = argv[++i]; }
    else if (a === '--until-time') { out.untilTime = argv[++i]; }
    else if (a === '-t' || a === '--timeout') {
      const n = parseInt(argv[++i] || '', 10);
      if (Number.isFinite(n) && n > 0) out.timeoutMs = n * 1000;
    }
    else if (!a.startsWith('-')) { positional.push(a); }
  }

  // positional arg as query
  if (!out.query && positional.length) {
    out.query = positional.join(' ').trim();
  }

  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { usage(); process.exit(0); }

  const apiKey = process.env.FELO_API_KEY?.trim();
  if (!apiKey) {
    console.error('ERROR: FELO_API_KEY not set');
    process.exit(1);
  }

  const apiBase = (process.env.FELO_API_BASE?.trim() || DEFAULT_API_BASE).replace(/\/$/, '');
  const { query, ids, json, timeoutMs } = args;

  if (!query && !ids.length) {
    usage();
    process.exit(1);
  }

  let code = 1;
  try {
    if (query) {
      if (args.user) {
        // search users
        const spinnerId = startSpinner(`Searching users: ${query}`);
        try {
          const body = { query };
          if (args.cursor) body.cursor = args.cursor;
          const payload = await postApi(apiBase, apiKey, '/x/user/search', body, timeoutMs);
          if (json) { console.log(JSON.stringify(payload, null, 2)); code = 0; }
          else {
            const data = payload?.data || {};
            const users = data.users || [];
            if (!users.length) { process.stderr.write('No users found.\n'); }
            else {
              process.stdout.write(`Found ${data.total || users.length} user(s)\n\n`);
              for (const u of users) process.stdout.write(formatUser(u));
              if (data.has_next && data.next_cursor) process.stderr.write(`\nMore results available. Use --cursor "${data.next_cursor}"\n`);
              code = 0;
            }
          }
        } finally { stopSpinner(spinnerId); }
      } else {
        // search tweets (default)
        const spinnerId = startSpinner(`Searching tweets: ${query}`);
        try {
          const body = { query };
          if (args.queryType) body.query_type = args.queryType;
          if (args.sinceTime) body.since_time = args.sinceTime;
          if (args.untilTime) body.until_time = args.untilTime;
          if (args.limit) body.limit = args.limit;
          if (args.cursor) body.cursor = args.cursor;
          const payload = await postApi(apiBase, apiKey, '/x/tweet/search', body, timeoutMs);
          if (json) { console.log(JSON.stringify(payload, null, 2)); code = 0; }
          else {
            const data = payload?.data || {};
            const tweets = data.tweets || [];
            if (!tweets.length) { process.stderr.write('No tweets found.\n'); }
            else {
              process.stdout.write(`Found ${data.total || tweets.length} tweet(s)\n\n`);
              for (const t of tweets) process.stdout.write(formatTweet(t));
              if (data.has_next && data.next_cursor) process.stderr.write(`\nMore results available. Use --cursor "${data.next_cursor}"\n`);
              code = 0;
            }
          }
        } finally { stopSpinner(spinnerId); }
      }
    } else if (ids.length) {
      if (args.user) {
        if (args.tweets) {
          // get user tweets
          const label = ids[0];
          const spinnerId = startSpinner(`Fetching tweets from ${label}`);
          try {
            const body = { username: ids[0] };
            if (args.limit) body.limit = args.limit;
            if (args.cursor) body.cursor = args.cursor;
            if (args.includeReplies) body.include_replies = true;
            const payload = await postApi(apiBase, apiKey, '/x/user/tweets', body, timeoutMs);
            if (json) { console.log(JSON.stringify(payload, null, 2)); code = 0; }
            else {
              const data = payload?.data || {};
              const tweets = data.tweets || [];
              if (!tweets.length) { process.stderr.write('No tweets found.\n'); }
              else {
                process.stdout.write(`Found ${data.total || tweets.length} tweet(s)\n\n`);
                for (const t of tweets) process.stdout.write(formatTweet(t));
                if (data.has_next && data.next_cursor) process.stderr.write(`\nMore results available. Use --cursor "${data.next_cursor}"\n`);
                code = 0;
              }
            }
          } finally { stopSpinner(spinnerId); }
        } else {
          // get user info
          const spinnerId = startSpinner('Fetching user info');
          try {
            const payload = await postApi(apiBase, apiKey, '/x/user/info', { usernames: ids }, timeoutMs);
            if (json) { console.log(JSON.stringify(payload, null, 2)); code = 0; }
            else {
              const users = payload?.data?.users || [];
              if (!users.length) { process.stderr.write('No users found.\n'); }
              else { for (const u of users) process.stdout.write(formatUser(u)); code = 0; }
            }
          } finally { stopSpinner(spinnerId); }
        }
      } else {
        // get tweet replies (default for --id)
        const spinnerId = startSpinner(`Fetching replies for ${ids.length} tweet(s)`);
        try {
          const body = { tweet_ids: ids };
          if (args.cursor) body.cursor = args.cursor;
          if (args.sinceTime) body.since_time = args.sinceTime;
          if (args.untilTime) body.until_time = args.untilTime;
          const payload = await postApi(apiBase, apiKey, '/x/tweet/replies', body, timeoutMs);
          if (json) { console.log(JSON.stringify(payload, null, 2)); code = 0; }
          else {
            const results = payload?.data?.results || [];
            if (!results.length) { process.stderr.write('No replies found.\n'); }
            else {
              for (const r of results) {
                process.stdout.write(`## Replies to tweet \`${r.tweet_id}\` (${r.total || 0} total)\n\n`);
                for (const t of (r.replies || [])) process.stdout.write(formatTweet(t));
                if (r.has_next && r.next_cursor) process.stderr.write(`More replies for ${r.tweet_id}. Use --cursor "${r.next_cursor}"\n`);
              }
              code = 0;
            }
          }
        } finally { stopSpinner(spinnerId); }
      }
    }
  } catch (err) {
    process.stderr.write(`Error: ${err?.message || err}\n`);
  }

  process.exit(code);
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err?.message || err}\n`);
  process.exit(1);
});
