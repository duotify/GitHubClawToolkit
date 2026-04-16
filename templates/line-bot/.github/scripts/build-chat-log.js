#!/usr/bin/env node
/**
 * build-chat-log.js
 *
 * 將 GitHub Issue 內的所有 LINE 訊息 comments 整理成一份乾淨的聊天記錄 markdown。
 *
 * Usage:
 *   node build-chat-log.js <issue_number> [output_file] [utc_offset]
 *
 * Arguments:
 *   issue_number  必填，GitHub Issue 編號
 *   output_file   選填，輸出檔案路徑，預設 chat-log.md
 *   utc_offset    選填，時區偏移（整數），預設 8（台灣 UTC+8）
 *
 * 依賴：gh CLI（需已登入），Node.js >= 18
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

const issueNumber = process.argv[2];
const outputFile = process.argv[3] || 'chat-log.md';
const utcOffset = parseInt(process.argv[4] ?? '8', 10);

if (!issueNumber) {
  console.error('Usage: node build-chat-log.js <issue_number> [output_file] [utc_offset]');
  process.exit(1);
}

// ─── 解析工具 ────────────────────────────────────────────────────────────────

function parseLineMeta(body) {
  const match = body.match(/<!-- line-meta: (\{.*?\}) -->/s);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

function parseSenderName(body) {
  const m = body.match(/^- Sender: (.+)$/m);
  return m ? m[1].trim() : null;
}

function parseTimestamp(meta, body) {
  if (meta?.ts) return meta.ts;
  const m = body.match(/^- Received at: (.+)$/m);
  return m ? m[1].trim() : null;
}

/**
 * 取得 <details> 之前的區塊（避免把 raw snapshot JSON 裡的 > 誤認為引用文字）
 */
function beforeDetails(body) {
  return body.split('<details>')[0];
}

function parseTextContent(body) {
  const section = beforeDetails(body);
  // 找 "Text\n\n> ..." 區塊
  const m = section.match(/\nText\n\n((?:^> .*\n?)+)/m);
  if (!m) return null;
  return m[1]
    .split('\n')
    .filter(l => l.startsWith('> '))
    .map(l => l.slice(2))
    .join('\n')
    .trim();
}

function parseImageMarkdown(body) {
  // Preview 區塊的 ![...](url)，一定在 <details> 之前
  const section = beforeDetails(body);
  const matches = [...section.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)];
  return matches.length ? matches.map(m => `![${m[1]}](${m[2]})`).join('\n') : null;
}

function parseStoredFile(body) {
  const m = body.match(/^- Stored file: \[([^\]]+)\]\(([^)]+)\)$/m);
  return m ? { name: m[1].trim(), url: m[2].trim() } : null;
}

function detectEventType(body) {
  if (/LINE text message/.test(body)) return 'text';
  if (/LINE image message/.test(body)) return 'image';
  if (/LINE audio message/.test(body)) return 'audio';
  if (/LINE video message/.test(body)) return 'video';
  if (/LINE file message/.test(body)) return 'file';
  if (/LINE sticker message/.test(body)) return 'sticker';
  if (/LINE follow event/.test(body)) return 'follow';
  if (/LINE join event/.test(body)) return 'join';
  if (/LINE unfollow event/.test(body)) return 'unfollow';
  return null;
}

// ─── 時間格式化 ──────────────────────────────────────────────────────────────

function formatTs(ts) {
  if (!ts) return '時間不明';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  const local = new Date(d.getTime() + utcOffset * 3600_000);
  const p = n => String(n).padStart(2, '0');
  const sign = utcOffset >= 0 ? '+' : '-';
  return (
    `${local.getUTCFullYear()}-${p(local.getUTCMonth() + 1)}-${p(local.getUTCDate())} ` +
    `${p(local.getUTCHours())}:${p(local.getUTCMinutes())} UTC${sign}${Math.abs(utcOffset)}`
  );
}

// ─── 主流程 ──────────────────────────────────────────────────────────────────

const raw = execSync(
  `gh issue view ${issueNumber} --json title,comments`,
  { encoding: 'utf-8' }
);
const { title, comments } = JSON.parse(raw);

const entries = [];

for (const comment of comments) {
  const body = comment.body || '';
  const meta = parseLineMeta(body);
  if (!meta) continue; // 略過非 LINE 訊息（如 agent result comment）

  const sender = parseSenderName(body) || meta.user_id || '(未知)';
  const ts = parseTimestamp(meta, body);
  const type = detectEventType(body);
  if (!type) continue;

  let content;

  switch (type) {
    case 'text': {
      const text = parseTextContent(body);
      content = text || '_(空白訊息)_';
      break;
    }
    case 'image': {
      const img = parseImageMarkdown(body);
      if (img) {
        content = img;
      } else {
        const file = parseStoredFile(body);
        content = file ? `![${file.name}](${file.url})` : '🖼️ _(圖片無法取得)_';
      }
      break;
    }
    case 'audio': {
      const file = parseStoredFile(body);
      content = file ? `🎵 [${file.name}](${file.url})` : '🎵 _(語音訊息)_';
      break;
    }
    case 'video': {
      const file = parseStoredFile(body);
      content = file ? `🎬 [${file.name}](${file.url})` : '🎬 _(影片訊息)_';
      break;
    }
    case 'file': {
      const file = parseStoredFile(body);
      content = file ? `📎 [${file.name}](${file.url})` : '📎 _(檔案)_';
      break;
    }
    case 'sticker':
      content = '🎭 _(貼圖)_';
      break;
    case 'follow':
      content = `👋 ${sender} 加入`;
      break;
    case 'join':
      content = '🤖 機器人加入群組';
      break;
    case 'unfollow':
      content = `🚪 ${sender} 離開`;
      break;
    default:
      continue;
  }

  entries.push({ ts, sender, content });
}

// 依時間排序
entries.sort((a, b) => {
  if (!a.ts) return 1;
  if (!b.ts) return -1;
  return new Date(a.ts) - new Date(b.ts);
});

// ─── 輸出 chat-log.md ────────────────────────────────────────────────────────

const lines = [
  `# 聊天記錄 — Issue #${issueNumber}：${title}`,
  '',
  `> 自動整理自 GitHub Issue，共 ${entries.length} 則訊息。`,
  `> 最後更新：${new Date().toISOString()}`,
  '',
  '---',
  '',
];

for (const entry of entries) {
  lines.push(`[${formatTs(entry.ts)}] **${entry.sender}**`);
  lines.push('');
  lines.push(entry.content);
  lines.push('');
  lines.push('---');
  lines.push('');
}

if (entries.length === 0) {
  lines.push('_(此 Issue 目前沒有 LINE 訊息記錄)_');
  lines.push('');
}

writeFileSync(outputFile, lines.join('\n'), 'utf-8');
console.log(`✅ 聊天記錄已輸出至 ${outputFile}（共 ${entries.length} 則訊息）`);
