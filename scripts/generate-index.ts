#!/usr/bin/env bun
/**
 * generate-index.ts — Readwise Briefing Archive 索引页生成器
 *
 * 扫描根目录 readwise-briefing-*.html / readwise-proposals-*.html，
 * 按日期倒序生成 index.html（访客落地页）。
 *
 * 视觉复用简报主题：LXGW WenKai 字体 + Light/Dark 切换 + 墨绿 accent。
 *
 * 用法：cd ~/Work/readwise-briefing && bun run scripts/generate-index.ts
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const DATE_RE = /(\d{4})(\d{2})(\d{2})/;

interface Entry {
  date: string; // YYYYMMDD
  dateLabel: string; // YYYY-MM-DD
  briefing?: string; // 文件名
  proposals?: string;
  briefingTitle?: string;
  proposalsTitle?: string;
  highlights?: number; // 高亮总数（从简报提取）
  tier5?: number; // ⭐×5 深挖数
  size: number; // 文件大小（字节），用于排序稳定性
}

// 从 HTML 中提取第一个 <title>
function extractTitle(html: string): string | undefined {
  const m = html.match(/<title>([^<]*)<\/title>/i);
  return m?.[1]?.trim();
}

// 从简报 HTML 提取高亮总数（第一个 .stat .n 的数字）
function extractHighlights(html: string): { highlights?: number; tier5?: number } {
  const nums = [...html.matchAll(/class="n"[^>]*>([0-9]+)</g)].map((m) =>
    parseInt(m[1], 10),
  );
  if (nums.length === 0) return {};
  // 经验：简报 stats 第一格通常是"总高亮"，部分版本第二/三格是分层
  // tier5 不稳定（不同版本位置不同），仅尝试常见模式
  const tier5 = nums[1] && nums[1] < 50 ? nums[1] : undefined;
  return { highlights: nums[0], tier5 };
}

async function scan(): Promise<Entry[]> {
  const files = await readdir(ROOT);
  const map = new Map<string, Entry>();

  for (const f of files) {
    if (!f.endsWith(".html")) continue;
    const dm = f.match(DATE_RE);
    if (!dm) continue;
    const date = dm[0];
    const dateLabel = `${dm[1]}-${dm[2]}-${dm[3]}`;

    let entry = map.get(date);
    if (!entry) {
      entry = { date, dateLabel, size: 0 };
      map.set(date, entry);
    }

    const path = join(ROOT, f);
    const stat = await readFile(path).then((b) => b.byteLength).catch(() => 0);
    entry.size += stat;

    const html = await readFile(path, "utf-8").catch(() => "");
    const title = extractTitle(html);

    if (f.startsWith("readwise-briefing-")) {
      entry.briefing = f;
      entry.briefingTitle = title;
      Object.assign(entry, extractHighlights(html));
    } else if (f.startsWith("readwise-proposals-")) {
      entry.proposals = f;
      entry.proposalsTitle = title;
    }
  }

  return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
}

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function render(entries: Entry[]): string {
  const total = entries.length;
  const withProposals = entries.filter((e) => e.proposals).length;
  const latest = entries[0]?.dateLabel ?? "—";
  const generated = new Date().toISOString().slice(0, 10);

  const rows = entries
    .map((e) => {
      const briefingCell = e.briefing
        ? `<a href="${e.briefing}">📡 简报</a>`
        : `<span class="muted">—</span>`;
      const proposalsCell = e.proposals
        ? `<a href="${e.proposals}">🎯 Proposals</a>`
        : `<span class="muted">—</span>`;
      const hlCell = e.highlights
        ? `<b>${e.highlights}</b>`
        : `<span class="muted">—</span>`;
      const tierCell = e.tier5
        ? `<span class="tier5">${e.tier5}</span>`
        : `<span class="muted">—</span>`;

      return `<tr>
<td class="date">${e.dateLabel}</td>
<td>${briefingCell}</td>
<td>${proposalsCell}</td>
<td>${hlCell}</td>
<td>${tierCell}</td>
</tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Readwise 情报简报档案</title>
<style>
:root{--bg:#faf9f7;--surface:#ffffff;--surface2:#f5f4f0;--border:#e8e5df;--text:#1a1a1a;--text2:#4a4a4a;--text3:#888880;--accent:#2d5a4a;--accent2:#6366f1;--accent3:#059669;--accent4:#d97706}
html.dark{--bg:#0f1117;--surface:#1a1d27;--surface2:#242736;--border:#2e3247;--text:#e2e8f0;--text2:#94a3b8;--text3:#64748b;--accent:#6c8ef5;--accent2:#a78bfa;--accent3:#34d399;--accent4:#f59e0b}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--text);font-family:"LXGW WenKai","霞鹜文楷","STKaiti","KaiTi","楷体",-apple-system,BlinkMacSystemFont,serif;line-height:1.75;margin:0;padding:0;transition:background .2s}
.wrap{max-width:920px;margin:0 auto;padding:32px 20px 80px}
header{border-bottom:2px solid var(--accent);padding-bottom:18px;margin-bottom:28px;position:relative}
h1{font-size:1.7rem;margin:0 0 6px;color:var(--accent)}
.sub{color:var(--text2);font-size:.92rem}
#theme-toggle{position:absolute;top:0;right:0;font-size:1.4rem;cursor:pointer;background:var(--surface2);border:1px solid var(--border);border-radius:50%;width:42px;height:42px;line-height:38px;text-align:center}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0}
.stat{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 8px;text-align:center}
.stat .n{font-size:1.5rem;font-weight:bold;color:var(--accent)}
.stat .l{font-size:.72rem;color:var(--text3);margin-top:2px}
.intro{background:var(--surface);border:1px solid var(--border);border-left:4px solid var(--accent2);border-radius:10px;padding:14px 18px;margin:18px 0;color:var(--text2);font-size:.9rem}
h2{font-size:1.2rem;margin:34px 0 14px;padding-left:12px;border-left:4px solid var(--accent);color:var(--text)}
table{width:100%;border-collapse:collapse;margin:12px 0;font-size:.9rem;background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden}
th{background:var(--surface2);text-align:left;padding:10px;color:var(--accent);border-bottom:1px solid var(--border);white-space:nowrap}
td{padding:10px;border-bottom:1px solid var(--border);vertical-align:top;color:var(--text2)}
tr:last-child td{border-bottom:none}
tr:hover td{background:var(--surface2)}
td.date{color:var(--text);font-weight:500;white-space:nowrap}
a{color:var(--accent2);text-decoration:none}
a:hover{text-decoration:underline}
.muted{color:var(--text3)}
.tier5{color:var(--accent3);font-weight:bold}
.foot{margin-top:40px;padding-top:16px;border-top:1px solid var(--border);color:var(--text3);font-size:.75rem;text-align:center}
</style>
</head>
<body>
<div class="wrap">
<header>
<button id="theme-toggle">🌙</button>
<h1>📡 Readwise 情报简报档案</h1>
<div class="sub">AI 驱动的个人情报简报归档 · 最新 ${latest}</div>
<div class="stats">
<div class="stat"><div class="n">${total}</div><div class="l">期数</div></div>
<div class="stat"><div class="n" style="color:var(--accent3)">${withProposals}</div><div class="l">含 Proposals</div></div>
<div class="stat"><div class="n" style="color:var(--accent2)">${total - withProposals}</div><div class="l">仅简报</div></div>
<div class="stat"><div class="n" style="color:var(--accent4)">${latest}</div><div class="l">最近更新</div></div>
</div>
</header>

<div class="intro">
📖 <b>关于</b>：这是 Kyle Li 的个人 Readwise 情报简报公开档案。基于 Readwise 收集的高亮与文章，经 AI 对齐分析后生成。
每期包含<b>信号简报</b>（分层展示高价值内容）与可选的 <b>Proposals</b>（深度挖掘的可执行提案）。<br>
🤖 自动生成，非人工编辑。内容为个人学习参考，不构成任何建议。
</div>

<h2>📋 全部简报（按日期倒序）</h2>
<table>
<thead><tr>
<th>日期</th>
<th>📡 简报</th>
<th>🎯 Proposals</th>
<th>高亮数</th>
<th>⭐×5</th>
</tr></thead>
<tbody>
${rows}
</tbody>
</table>

<div class="foot">
Generated by <code>scripts/generate-index.ts</code> · ${generated} ·
基于 <a href="https://readwise.io" target="_blank" rel="noopener">Readwise</a> + my-readwise-briefing skill
</div>
</div>
<script>
const btn=document.getElementById('theme-toggle');
btn.addEventListener('click',()=>{
document.documentElement.classList.toggle('dark');
const d=document.documentElement.classList.contains('dark');
btn.textContent=d?'☀️':'🌙';
localStorage.setItem('theme',d?'dark':'light');
});
if(localStorage.getItem('theme')==='dark'){
document.documentElement.classList.add('dark');
btn.textContent='☀️';
}
</script>
</body>
</html>
`;
}

async function main() {
  const entries = await scan();
  if (entries.length === 0) {
    console.error("❌ 未找到任何 HTML 文件");
    process.exit(1);
  }
  const html = render(entries);
  await writeFile(join(ROOT, "index.html"), html, "utf-8");
  console.log(`✅ index.html 已生成 · ${entries.length} 期 · 最新 ${entries[0].dateLabel}`);
}

main();
