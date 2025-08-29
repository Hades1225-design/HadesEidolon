// tools/gen-plans-index.mjs
// Build /public/planshub/index.json from Markdown plans under /site/PlansHub/plans/*.md
// Zero-deps, Node >=18

import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// repo root presumed two levels up from tools/
const repoRoot = join(__dirname, '..');

const PLANS_DIR = join(repoRoot, 'site', 'PlansHub', 'plans');
const OUT_DIR   = join(repoRoot, 'public', 'planshub');
const OUT_FILE  = join(OUT_DIR, 'index.json');

/** Util */
const slugify = s => String(s || 'untitled')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '');

const readText = async p => fs.readFile(p, 'utf8');

/** Parse optional frontmatter
---
title: ...
area: hackintosh
priority: P2
status: ongoing
owner: Hades
progress: 30
risk: low|medium|high
due: 2025-09-10
tags: tag1, tag2
links:
  - https://...
---
*/
function parseFrontmatter(txt) {
  const m = txt.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { data:{}, body: txt };
  const fmBlock = m[1];
  const body = txt.slice(m[0].length);
  const data = {};
  // simple key: value lines + YAML-ish arrays
  for (const line of fmBlock.split('\n')) {
    const mm = line.match(/^([A-Za-z0-9_]+)\s*:\s*(.*)$/);
    if (!mm) continue;
    const key = mm[1].trim();
    let val = mm[2].trim();
    if (/^\[.*\]$/.test(val)) {
      try { val = JSON.parse(val); } catch { /* ignore */ }
    } else if (/,/.test(val)) {
      // comma list
      val = val.split(',').map(s=>s.trim()).filter(Boolean);
    } else if (/^\d+$/.test(val)) {
      val = Number(val);
    } else if (val === 'true' || val === 'false') {
      val = (val === 'true');
    } else if (val === 'null' || val === 'NULL') {
      val = null;
    }
    data[key] = val;
  }
  return { data, body };
}

// Extract first # H1 as title; collect headings (## etc.)
function extractTitleAndHeadings(md) {
  const lines = md.split('\n');
  let title = null;
  const headings = [];
  for (const ln of lines) {
    const h = ln.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (h) {
      const level = h[1].length;
      const text = h[2].trim();
      if (level === 1 && !title) title = text;
      if (level >= 2) headings.push(text);
    }
  }
  return { title, headings };
}

function gitDate(pathRel, fmt) {
  try {
    const cmd = `git log -1 --format=%${fmt} -- "${pathRel}"`;
    const out = execSync(cmd, { cwd: repoRoot, stdio: ['ignore','pipe','ignore'] }).toString().trim();
    return out || null;
  } catch {
    return null;
  }
}

async function main() {
  // ensure out dir
  await fs.mkdir(OUT_DIR, { recursive: true });

  let files = [];
  try {
    files = (await fs.readdir(PLANS_DIR)).filter(f => f.endsWith('.md'));
  } catch {
    console.error('Plans dir not found:', PLANS_DIR);
    process.exit(1);
  }

  const items = [];
  for (const f of files) {
    const abs = join(PLANS_DIR, f);
    const md = await readText(abs);

    const { data: fm, body } = parseFrontmatter(md);
    const { title: h1Title, headings } = extractTitleAndHeadings(body);

    const title = fm.title || h1Title || f.replace(/\.md$/,'').replace(/[-_]/g,' ').trim();
    const idBase = fm.id || slugify(title);
    const statCtime = gitDate(join('site/PlansHub/plans', f), 'ad'); // author date
    const statMtime = gitDate(join('site/PlansHub/plans', f), 'cd'); // committer date

    // preview: first non-empty line after headings marker or first paragraph
    let preview = '';
    const bodyNoMd = body.replace(/```[\s\S]*?```/g, '').trim();
    const firstLine = bodyNoMd.split('\n').find(s => s.trim().length);
    preview = firstLine ? firstLine.slice(0, 200) : '';

    const item = {
      id: fm.id || `plan-${(statCtime || '').slice(0,10) || '0000-00-00'}-${idBase}`,
      title,
      area: fm.area || 'general',
      priority: fm.priority || 'P3',
      status: fm.status || 'inbox',
      owner: fm.owner || 'Hades',
      progress: typeof fm.progress === 'number' ? fm.progress : 0,
      risk: fm.risk || 'medium',
      due: fm.due || null,
      tags: Array.isArray(fm.tags) ? fm.tags : (typeof fm.tags === 'string' ? fm.tags.split(',').map(s=>s.trim()).filter(Boolean) : []),
      links: Array.isArray(fm.links) ? fm.links : [],
      path: `plans/${f}`,
      created: (statCtime || '').slice(0,10) || null,
      updated: (statMtime || '').slice(0,10) || null,
      preview,
      headings
    };

    items.push(item);
  }

  // sort by updated desc then title
  items.sort((a,b)=>{
    const da = a.updated || '0000-00-00';
    const db = b.updated || '0000-00-00';
    return db.localeCompare(da) || a.title.localeCompare(b.title);
  });

  const areas = [...new Set(items.map(i=>i.area))].sort();

  const out = {
    version: '2.0.0',
    generated_at: new Date().toISOString(),
    items,
    areas
  };

  await fs.writeFile(OUT_FILE, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log('Wrote', OUT_FILE, 'items=', items.length);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
