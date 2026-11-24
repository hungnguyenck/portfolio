#!/usr/bin/env node
/* Static site generator, zero dependencies (Node 18+).
   content/*.json  +  tools/*.mjs templates  ->  dist/  (what GitHub Pages serves)  */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { md, esc, inline, stripMd } from './md.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'dist');
const warns = [];
const warn = (m) => { warns.push(m); console.warn('  ! ' + m); };

/* ---------------- content loading ---------------- */
function readJson(rel, fallback) {
  const f = path.join(ROOT, rel);
  if (!fs.existsSync(f)) { if (fallback !== undefined) return fallback; throw new Error(`Missing file: ${rel}`); }
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { throw new Error(`${rel} is not valid JSON: ${e.message}`); }
}
function folder(dir) {
  const d = path.join(ROOT, dir);
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter((f) => f.endsWith('.json')).sort().map((f) => ({ ...readJson(`${dir}/${f}`), slug: f.slice(0, -5) }));
}
const site = readJson('content/site.json');
const hero = readJson('content/hero.json');
const experience = readJson('content/experience.json', { items: [] }).items || [];
const skills = readJson('content/skills.json', { groups: [] }).groups || [];
const projects = folder('content/projects').filter((p) => p.published !== false);
const products = Object.fromEntries(folder('content/products').map((p) => [p.slug, p]));
const posts = folder('content/posts').filter((p) => p.published !== false).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

/* ---------------- urls ---------------- */
const DEV = process.env.DEV === '1';
let siteUrl = (process.env.SITE_URL || site.siteUrl || '').trim().replace(/\/+$/, '');
if (!siteUrl && process.env.GITHUB_REPOSITORY) {            // zero-config on GitHub Actions
  const [owner, repo] = process.env.GITHUB_REPOSITORY.toLowerCase().split('/');
  siteUrl = `https://${owner}.github.io` + (repo === `${owner}.github.io` ? '' : '/' + repo);
}
let BASE = siteUrl ? new URL(siteUrl).pathname.replace(/\/+$/, '') : '';
if (DEV) { siteUrl = ''; BASE = ''; }
const u = (p) => (!p ? '' : /^(https?:|mailto:|tel:|data:|#|\/\/)/.test(p) ? p : BASE + (p.startsWith('/') ? p : '/' + p));
const abs = (p) => (siteUrl ? siteUrl.replace(new RegExp(BASE + '$'), '') + BASE + (p.startsWith('/') ? p : '/' + p) : u(p));
const exists = (p) => /^\/assets\//.test(p) ? fs.existsSync(path.join(ROOT, p)) : true;
const img = (p, where) => { if (p && !exists(p)) warn(`Image not found: ${p}  (used in ${where})`); return u(p); };

/* ---------------- helpers ---------------- */
const VIEW = { ember: 'marketing', blue: 'product', light: 'balanced' };
const DEFAULT = Object.keys(VIEW).find((k) => VIEW[k] === (site.defaultView || 'marketing')) || 'ember';
const num = (v, d) => (v === '' || v == null || isNaN(+v) ? d : +v);
const ord = (p, v) => num(p['order_' + VIEW[v]], 999);
const byView = (arr, v) => arr.slice().sort((a, b) => ord(a, v) - ord(b, v) || a.title.localeCompare(b.title));
const N = Math.max(1, num(site.featuredCount, 5));
const featuredSlugs = new Set(byView(projects.filter((p) => p.thumb), DEFAULT).slice(0, N).map((p) => p.slug));
const kicker = (p) => [p.role, p.company, p.period].filter(Boolean).join(' · ');
const initials = (s) => (String(s).match(/\b\w/g) || []).slice(0, 2).join('').toUpperCase();
const slugify = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const fmtDate = (d) => { const t = new Date(d); return isNaN(t) ? '' : t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); };
const list = (a) => (Array.isArray(a) ? a.filter((x) => x != null && x !== '') : []);
const routes = [];
function write(route, html) {
  const f = route.endsWith('/') ? path.join(OUT, route, 'index.html') : path.join(OUT, route);
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); if (/\/$/.test(route) || route.endsWith('.html')) routes.push(route);
}
const mdOpts = { resolve: u };

/* ---------------- shared layout ---------------- */
const hasPosts = site.blog?.enabled !== false && posts.length > 0;
const spotifyAt = site.spotify?.placement === 'section' ? 'section' : 'hero';
const spotifyList = site.spotify?.enabled ? list(site.spotify.playlists).map((p) => ({ ...p, embed: spotifyEmbed(p.url) })).filter((p) => p.embed) : [];
function spotifyEmbed(url = '') {
  const m = String(url).match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(playlist|album|track|artist|show|episode)\/([A-Za-z0-9]+)/);
  if (!m) { if (url) warn(`Spotify link not recognised: ${url}`); return ''; }
  return `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator`;
}
const assetHash = crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, 'assets/css/style.css'))).update(fs.readFileSync(path.join(ROOT, 'assets/js/main.js'))).digest('hex').slice(0, 8);

function header(home) {
  const s = (id) => (home ? '#' + id : u('/#' + id));
  const n = site.nav || {};
  const on = (k, d = true) => (n[k] === undefined || n[k] === null ? d : n[k] !== false);
  const nav = [];
  if (on('about')) nav.push(['About', s('about')]);
  if (on('work')) nav.push(['Work', s('work')]);
  if (on('experience')) nav.push([n.experience_label || 'Experience & Skills', s('experience')]);  // one button for both sections
  if (on('playlist', false) && spotifyList.length) nav.push([n.playlist_label || 'Playlist', s('music')]);
  if (on('writing') && hasPosts) nav.push([site.blog?.navLabel || 'Writing', u('/blog/')]);
  if (on('contact')) nav.push(['Contact', '#contact']);
  return `<header class="wrap"><div class="bar"><a class="brand" href="${u('/')}" aria-label="${esc(site.name)}, home">CK<span>.</span></a><nav aria-label="Main">${nav.map(([t, h]) => `<a href="${esc(h)}">${esc(t)}</a>`).join('')}</nav></div></header>`;
}
const switcher = `<div class="sw" role="group" aria-label="View"><button type="button" data-t="ember" aria-pressed="false" aria-label="Orange view: marketing, creative, user"><i style="background:#FF5E00"></i><span>Marketing</span></button><button type="button" data-t="blue" aria-pressed="false" aria-label="Blue view: product, data, technical"><i style="background:#ADE1FB"></i><span>Product</span></button><button type="button" data-t="light" aria-pressed="false" aria-label="Light view: balanced"><i style="background:#F2F3FB"></i><span>Balanced</span></button></div>`;
const footer = () => `<footer class="band contact" id="contact"><div class="wrap">
  <p class="kicker">Contact</p>
  <h2>Let’s build<br>something <span>great.</span></h2>
  <a class="big" href="mailto:${esc(site.email)}">${esc(site.email)}</a>
  <p class="cl">${site.phone ? `<a href="tel:${esc(site.phone)}">${esc(site.phoneDisplay || site.phone)}</a>` : ''}${site.linkedin ? `<a href="${esc(site.linkedin)}" rel="noopener">${esc(site.linkedin.replace(/^https?:\/\/(www\.)?/, ''))}</a>` : ''}</p>
  <p class="note">${esc(site.footerNote || '')}</p>
</div></footer>`;

function page({ route, title, desc, body, og, type = 'website', jsonld, home = false, noindex = false }) {
  const full = title === site.title ? title : `${title} – ${site.name}`;
  const description = stripMd(desc || site.description).slice(0, 300);
  const canon = siteUrl ? `<link rel="canonical" href="${esc(abs(route))}">` : '';
  const ogImg = og || site.ogImage;
  const ogUrl = ogImg ? esc(/^https?:/.test(ogImg) ? ogImg : abs(ogImg)) : '';
  const ld = jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : '';
  return `<!DOCTYPE html>
<html lang="${esc(site.lang || 'en')}" data-theme="${DEFAULT}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(full)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex">' : ''}${canon}
<meta property="og:type" content="${type}"><meta property="og:title" content="${esc(full)}"><meta property="og:description" content="${esc(description)}">${siteUrl ? `<meta property="og:url" content="${esc(abs(route))}">` : ''}${ogUrl ? `<meta property="og:image" content="${ogUrl}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' fill='%23FF5E00'/%3E%3Ctext x='50' y='66' font-size='46' font-family='Arial Black,sans-serif' font-weight='900' text-anchor='middle' fill='%230E0E12'%3ECK%3C/text%3E%3C/svg%3E">
${hasPosts ? `<link rel="alternate" type="application/rss+xml" title="${esc(site.name)}" href="${u('/feed.xml')}">` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&family=DM+Sans:wght@400;500;700&display=swap">
<link rel="stylesheet" href="${u('/assets/css/style.css')}?v=${assetHash}">
<script>try{var t=localStorage.getItem('ck-theme2');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
${ld}
</head>
<body>
${header(home)}
${switcher}
<main>
${body}
</main>
${footer()}
<script src="${u('/assets/js/main.js')}?v=${assetHash}" defer></script>
</body>
</html>`;
}

/* ---------------- project pieces ---------------- */
function detail(p) {
  const metrics = list(p.metrics).slice(0, 4);
  const slides = list(p.slides).filter((s) => s && s.image);
  const results = list(p.results), tags = list(p.tags);
  const section = (h, txt) => (txt ? `<h4>${h}</h4>${md(txt, mdOpts)}` : '');
  const desc = `${section('Challenge', p.challenge)}${section('What I did', p.actions)}${results.length ? `<h4>Results</h4><ul>${results.map((r) => `<li>${inline(r)}</li>`).join('')}</ul>` : ''}${tags.length ? `<ul class="chips" aria-label="Tags">${tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}`;
  return `<div class="inner${slides.length ? '' : ' noslide'}">${metrics.length ? `<div class="metrics">${metrics.map((m) => `<div class="mt"><b>${esc(m.value)}</b><span>${esc(m.label)}</span></div>`).join('')}</div>` : ''}${slides.length ? `<div class="slider" role="group" aria-roledescription="carousel" aria-label="Project images"><div class="track">${slides.map((s) => `<img src="${img(s.image, p.slug)}" alt="${esc(s.alt || p.title)}" width="1920" height="1080" loading="lazy">`).join('')}</div><div class="dots"></div></div>` : ''}${desc ? `<div class="desc">${desc}</div>` : ''}</div>`;
}
const orderAttrs = (p) => Object.keys(VIEW).map((v) => `data-o-${v}="${ord(p, v)}"`).join(' ');
function card(p) {
  const hidden = featuredSlugs.has(p.slug) ? '' : ' hidden';
  const name = p.card_name || p.company || p.title;
  return `<article class="bc" data-slug="${esc(p.slug)}" ${orderAttrs(p)}${hidden}>
  <div class="top"><p class="k">${esc(kicker(p))}</p><h3>${esc(p.title)}</h3></div>
  <div class="media"><img src="${img(p.thumb, p.slug)}" alt="${esc(p.thumb_alt || p.title)}" width="800" height="800" loading="lazy"></div>
  <div class="foot"><span class="ic" aria-hidden="true">${esc(p.icon || initials(name))}</span><div><b>${esc(name)}</b><span>${esc(p.card_note || '')}</span></div><button class="view" type="button" aria-label="View project: ${esc(p.title)}">VIEW</button></div>
  <dialog class="dlg" aria-label="${esc(p.title)}"><button class="x" type="button" aria-label="Close">×</button><p class="k">${esc(kicker(p))}</p><h3>${esc(p.title)}</h3><a class="dlg-link" href="${u('/work/' + p.slug + '/')}">OPEN FULL PAGE →</a>${detail(p)}</dialog>
</article>`;
}
function moreItem(p) {
  const hidden = featuredSlugs.has(p.slug) ? ' hidden' : '';
  const name = p.card_name || p.company;
  return `<li data-slug="${esc(p.slug)}" ${orderAttrs(p)}${hidden}><a href="${u('/work/' + p.slug + '/')}"><span class="ic" aria-hidden="true">${esc(p.icon || initials(p.title))}</span><div><b>${esc(p.title)}</b><span>${esc(p.card_note || name || '')}</span></div></a></li>`;
}

/* ---------------- products & posts ---------------- */
const NETWORK = { shopee: 'Shopee', amazon: 'Amazon', lazada: 'Lazada', tiktok: 'TikTok Shop', other: '' };
function productCard(p) {
  const net = NETWORK[p.network] ?? '';
  const label = p.button_label || (net ? `View on ${net}` : 'View product');
  const im = p.image ? `<div class="pr-i"><img src="${img(p.image, 'product ' + p.slug)}" alt="${esc(p.name)}" loading="lazy"></div>` : '';
  return `<div class="pr${im ? '' : ' noimg'}">${im}<div>${net ? `<span class="pr-badge">${esc(net)}</span>` : ''}<h4>${esc(p.name)}</h4>${p.note ? `<p>${inline(p.note)}</p>` : ''}${p.price ? `<span class="pr-price">${esc(p.price)}</span>` : ''}<a class="pr-go" href="${esc(p.url)}" target="_blank" rel="sponsored nofollow noopener">${esc(label)} →</a></div></div>`;
}
const postCard = (p) => `<a class="post-card" href="${u('/blog/' + p.slug + '/')}"><div class="pc-img${p.cover ? '' : ' none'}">${p.cover ? `<img src="${img(p.cover, 'post ' + p.slug)}" alt="${esc(p.cover_alt || '')}" width="1920" height="1080" loading="lazy">` : ''}</div><div class="pc-body"><span class="meta">${fmtDate(p.date)}</span><h3>${esc(p.title)}</h3>${p.excerpt ? `<p>${esc(p.excerpt)}</p>` : ''}</div></a>`;
const tagsOf = (p) => list(p.tags);
const allTags = [...new Set(posts.flatMap(tagsOf))].sort((a, b) => a.localeCompare(b));

/* ---------------- HOME ---------------- */
function home() {
  let n = 1; const num2 = () => String(++n).padStart(2, '0');
  const stats = (cls, arr) => `<dl class="stats sv sv-${cls}">${list(arr).slice(0, 4).map((s) => `<div><dt>${esc(s.value)}</dt><dd>${esc(s.label)}</dd></div>`).join('')}</dl>`;
  const sorted = byView(projects, DEFAULT);
  const withThumb = sorted.filter((p) => p.thumb);
  const work = site.work || {};
  const sections = [];
  sections.push(`<section id="work"><div class="wrap">
  <div class="sh"><h2 class="rv"><span class="n">${num2()}</span>My work</h2><p class="sub rv">${esc(work.intro || '')}</p></div>
  ${list(work.how).length ? `<p class="lbl rv">How I work</p><div class="pill how rv">${list(work.how).map((h) => `<div><b>${esc(h.title)}</b>${esc(h.text)}</div>`).join('')}</div>` : ''}
  <div class="bento" data-n="${N}">
${[...withThumb.filter((p) => featuredSlugs.has(p.slug)), ...withThumb.filter((p) => !featuredSlugs.has(p.slug))].map(card).join('\n')}
<article class="bl"><div class="top"><p class="k">${esc(work.moreKicker || 'Beyond the case studies')}</p><h3>${esc(work.moreTitle || 'More things I shipped')}</h3></div><ul class="more">${[...sorted.filter((p) => !featuredSlugs.has(p.slug)), ...sorted.filter((p) => featuredSlugs.has(p.slug))].map(moreItem).join('')}</ul></article>
  </div>
</div></section>`);
  sections.push(`<section id="experience"><div class="wrap sh">
  <h2 class="rv"><span class="n">${num2()}</span>Experience</h2>
  <ol class="tl rv">${experience.map((e) => `<li><div class="d">${esc(e.period)}</div><div><h3>${esc(e.title)}</h3><p class="co">${esc(e.company)}</p><ul>${list(e.bullets).map((b) => `<li>${inline(b)}</li>`).join('')}</ul></div></li>`).join('')}</ol>
</div></section>`);
  sections.push(`<section id="skills"><div class="wrap sh">
  <h2 class="rv"><span class="n">${num2()}</span>Skills</h2>
  <div class="sk rv">${skills.map((g) => `<div class="${g.wide ? 'wide' : ''}" style="--om:${num(g.order_marketing, 9)};--op:${num(g.order_product, 9)};--ob:${num(g.order_balanced, 9)}"><h3>${esc(g.title)}</h3><ul class="chips">${list(g.items).map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join('')}</div>
</div></section>`);
  if (spotifyList.length && spotifyAt === 'section') sections.push(`<section id="music"><div class="wrap">
  <div class="sh"><h2 class="rv"><span class="n">${num2()}</span>${esc(site.spotify.title || 'Playlist')}</h2><p class="sub rv">${esc(site.spotify.intro || '')}</p></div>
  <div class="sp rv">${spotifyList.map((p) => `<div>${p.title ? `<h3>${esc(p.title)}</h3>` : ''}<iframe src="${esc(p.embed)}" height="${num(p.height, 352)}" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" title="${esc(p.title || 'Spotify player')}"></iframe></div>`).join('')}</div>
</div></section>`);
  if (hasPosts) sections.push(`<section id="writing"><div class="wrap">
  <div class="sh"><h2 class="rv"><span class="n">${num2()}</span>${esc(site.blog.title || 'Writing')}</h2><p class="sub rv">${esc(site.blog.intro || '')}</p></div>
  <div class="posts rv">${posts.slice(0, num(site.blog.latestCount, 3)).map(postCard).join('')}</div>
  <p style="margin-top:28px"><a class="btn" href="${u('/blog/')}">All posts</a></p>
</div></section>`);

  const summary = list(hero.summary).map((s) => `<li>${md(s, mdOpts).replace(/^<p>([\s\S]*?)<\/p>(?![\s\S]*<p>)/, '$1')}</li>`).join('');
  const introDef = hero.default_intro === 'summary' ? 'tldr' : 'full';
  const sp1 = spotifyAt === 'hero' ? spotifyList[0] : null;
  const heroSp = sp1 ? `<div class="hero-sp" id="music">${site.spotify.title ? `<p class="sp-k">${esc(site.spotify.title)}</p>` : ''}<iframe src="${esc(sp1.embed)}" height="${Math.min(num(sp1.height, 352), 352)}" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" title="${esc(sp1.title || 'Spotify player')}"></iframe>${site.spotify.intro ? `<p class="sp-i">${esc(site.spotify.intro)}</p>` : ''}</div>` : '';
  const body = `<div class="band hero" id="top"><div class="wrap">
  <div class="hero-split">
    <div class="hero-txt">
      <h1 class="nm"><span class="nl"><span class="ln"><span>Hung</span></span><span class="ln o"><span>Nguyen</span></span></span><span class="ck"><span class="vh">(</span><span class="ckt">CK</span><span class="vh">)</span></span></h1>
      <p class="role fd" style="animation-delay:.8s">${esc(hero.role || '')}</p>
      <div class="intro fd" id="about" style="animation-delay:.9s">
        <div class="seg" role="group" aria-label="Introduction length"><button type="button" data-v="full" aria-pressed="${introDef === 'full'}">Full story</button><button type="button" data-v="tldr" aria-pressed="${introDef === 'tldr'}">Summary</button></div>
        <div class="pn${introDef === 'tldr' ? ' on' : ''}" id="p-tldr" aria-hidden="${introDef !== 'tldr'}"><div><ul>${summary}</ul></div></div>
        <div class="pn${introDef === 'full' ? ' on' : ''}" id="p-full" aria-hidden="${introDef !== 'full'}"><div><div class="full">${md(hero.full_story, mdOpts)}</div></div></div>
      </div>
      <div class="fd" style="animation-delay:1s"><a class="btn" href="#work">See my work</a><a class="btn o" href="#contact">Contact me</a></div>
    </div>
    <div class="hero-side"><div class="hero-fig"><figure class="hero-img"><img src="${img(hero.image, 'hero')}" width="640" height="800" alt="${esc(hero.image_alt || '')}" fetchpriority="high"></figure></div>${heroSp}</div>
  </div>
  ${stats('light', hero.stats_balanced)}${stats('ember', hero.stats_marketing)}${stats('blue', hero.stats_product)}
</div></div>
<div class="mq" aria-hidden="true"><div>${[...list(site.marquee), ...list(site.marquee)].map((m) => `<span>${esc(m)}</span>`).join('')}</div></div>
${sections.join('\n')}`;
  write('/', page({
    route: '/', title: site.title, desc: site.description, body, home: true,
    jsonld: { '@context': 'https://schema.org', '@type': 'Person', name: site.name, alternateName: site.alias, jobTitle: site.jobTitle, email: site.email, telephone: site.phone, sameAs: [site.linkedin].filter(Boolean), knowsAbout: ['Product management', 'Product marketing', 'Esports marketing', 'Business development', 'Go-to-market strategy', 'Community and KOL marketing'] },
  }));
}

/* ---------------- PROJECT pages ---------------- */
function projectPages() {
  for (const p of projects) {
    const others = byView(projects.filter((x) => x.slug !== p.slug), DEFAULT).slice(0, 4);
    const body = `<div class="wrap page">
  <a class="back" href="${u('/#work')}">← ALL WORK</a>
  ${kicker(p) ? `<p class="k">${esc(kicker(p))}</p>` : ''}
  <h1>${esc(p.title)}</h1>
  ${!p.challenge && !p.actions && p.card_note ? `<p class="lead">${esc(p.card_note)}</p>` : ''}
  ${detail(p)}
  ${p.body ? `<div class="prose" style="margin-top:40px">${md(p.body, mdOpts)}</div>` : ''}
  ${others.length ? `<div class="other"><p class="lbl">More work</p><ul class="more">${others.map((o) => `<li><a href="${u('/work/' + o.slug + '/')}"><span class="ic" aria-hidden="true">${esc(o.icon || initials(o.title))}</span><div><b>${esc(o.title)}</b><span>${esc(o.card_note || o.company || '')}</span></div></a></li>`).join('')}</ul></div>` : ''}
</div>`;
    write(`/work/${p.slug}/`, page({ route: `/work/${p.slug}/`, title: p.title, desc: [p.challenge, p.card_note, p.title].find(Boolean), body, og: list(p.slides)[0]?.image || p.thumb, jsonld: { '@context': 'https://schema.org', '@type': 'CreativeWork', name: p.title, author: { '@type': 'Person', name: site.name }, description: stripMd(p.challenge || p.card_note || '') } }));
  }
}

/* ---------------- BLOG ---------------- */
function blogPages() {
  if (!hasPosts) return;
  const b = site.blog;
  const tagRow = (cur) => `<ul class="tags" aria-label="Tags"><li><a href="${u('/blog/')}"${!cur ? ' aria-current="true"' : ''}>All</a></li>${allTags.map((t) => `<li><a href="${u('/blog/tag/' + slugify(t) + '/')}"${cur === t ? ' aria-current="true"' : ''}>${esc(t)}</a></li>`).join('')}</ul>`;
  const index = (cur, arr, route) => page({ route, title: cur ? `${b.title}: ${cur}` : b.title || 'Writing', desc: b.intro, body: `<div class="wrap page"><a class="back" href="${u('/')}">← HOME</a><p class="k">${esc(cur ? 'Tag' : 'Blog')}</p><h1>${esc(cur || b.title || 'Writing')}</h1>${cur ? '' : `<p class="lead">${esc(b.intro || '')}</p>`}${tagRow(cur)}<div class="posts">${arr.map(postCard).join('')}</div></div>` });
  write('/blog/', index('', posts, '/blog/'));
  for (const t of allTags) write(`/blog/tag/${slugify(t)}/`, index(t, posts.filter((p) => tagsOf(p).includes(t)), `/blog/tag/${slugify(t)}/`));
  for (const p of posts) {
    const used = new Set();
    const html = md(p.body, { ...mdOpts, block: (line) => { const m = line.match(/^\[\[product:([\w-]+)\]\]$/); if (!m) return null; if (!products[m[1]]) { warn(`Post "${p.slug}": product "${m[1]}" does not exist`); return '<!-- missing product -->'; } used.add(m[1]); return productCard(products[m[1]]); } });
    const listed = list(p.products).filter((id) => { if (!products[id]) { warn(`Post "${p.slug}": product "${id}" does not exist`); return false; } return true; });
    const hasAff = used.size > 0 || listed.length > 0;
    const mins = Math.max(1, Math.round(stripMd(p.body).split(/\s+/).length / 200));
    const body = `<article class="wrap page">
  <a class="back" href="${u('/blog/')}">← ${esc((b.title || 'Writing').toUpperCase())}</a>
  <p class="k">${fmtDate(p.date)} · ${mins} min read</p>
  <h1>${esc(p.title)}</h1>
  ${p.excerpt ? `<p class="lead">${esc(p.excerpt)}</p>` : ''}
  ${p.cover ? `<div class="post-cover"><img src="${img(p.cover, 'post ' + p.slug)}" alt="${esc(p.cover_alt || '')}" width="1920" height="1080"></div>` : ''}
  ${hasAff ? `<p class="aff-note">${esc(b.disclosure || '')}</p>` : ''}
  <div class="prose">${html}</div>
  ${listed.length ? `<div class="pr-box prose"><h2>Products in this post</h2>${listed.map((id) => productCard(products[id])).join('')}</div>` : ''}
  ${tagsOf(p).length ? `<ul class="tags">${tagsOf(p).map((t) => `<li><a href="${u('/blog/tag/' + slugify(t) + '/')}">${esc(t)}</a></li>`).join('')}</ul>` : ''}
</article>`;
    write(`/blog/${p.slug}/`, page({ route: `/blog/${p.slug}/`, title: p.title, desc: p.excerpt || p.body, body, og: p.cover, type: 'article', jsonld: { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, datePublished: p.date, author: { '@type': 'Person', name: site.name }, description: p.excerpt || '' } }));
  }
  if (siteUrl) {
    const items = posts.slice(0, 20).map((p) => `<item><title>${esc(p.title)}</title><link>${esc(abs('/blog/' + p.slug + '/'))}</link><guid>${esc(abs('/blog/' + p.slug + '/'))}</guid><pubDate>${new Date(p.date).toUTCString()}</pubDate><description>${esc(p.excerpt || '')}</description></item>`).join('');
    write('/feed.xml', `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(site.name)}</title><link>${esc(abs('/'))}</link><description>${esc(b.intro || site.description)}</description>${items}</channel></rss>`);
  }
}

/* ---------------- run ---------------- */
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const d of ['assets', 'admin']) fs.cpSync(path.join(ROOT, d), path.join(OUT, d), { recursive: true });
if (fs.existsSync(path.join(ROOT, 'CNAME'))) fs.copyFileSync(path.join(ROOT, 'CNAME'), path.join(OUT, 'CNAME'));
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
home(); projectPages(); blogPages();
write('/404.html', page({ route: '/404.html', title: 'Page not found', noindex: true, body: `<div class="wrap page"><p class="k">404</p><h1>Page not found</h1><p class="lead">That page doesn’t exist (anymore).</p><a class="btn" href="${u('/')}">Back to home</a></div>` }));
routes.splice(routes.indexOf('/404.html'), 1);
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin/\n${siteUrl ? `Sitemap: ${abs('/sitemap.xml')}\n` : ''}`);
if (siteUrl) fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map((r) => `<url><loc>${esc(abs(r))}</loc></url>`).join('')}</urlset>`);
console.log(`Built ${routes.length} pages -> dist/  (base "${BASE}", ${warns.length} warning${warns.length === 1 ? '' : 's'})`);
if (warns.length && process.env.STRICT) process.exit(1);
