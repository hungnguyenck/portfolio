// Tiny zero-dependency Markdown -> HTML (headings, lists, quotes, code, images, links, bold/italic).
// Raw HTML in the source is escaped, so editors can't break the page by accident.
export const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ext = (u) => /^https?:\/\//i.test(u);

export function inline(s, resolve = (x) => x) {
  const stash = [];
  s = String(s).replace(/`([^`]+)`/g, (_, c) => `\u0000${stash.push(`<code>${esc(c)}</code>`) - 1}\u0000`);
  s = s.replace(/\\([\\*_\[\]()#`>~|+.!-])/g, (_, c) => `\u0000${stash.push(esc(c)) - 1}\u0000`); // \* \_ escapes from rich-text editors
  s = esc(s).replace(/&lt;br\s*\/?&gt;/gi, '\n');
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, a, u) => `<img src="${resolve(u.replace(/&amp;/g, '&'))}" alt="${a}" loading="lazy">`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
    u = u.replace(/&amp;/g, '&');
    return `<a href="${resolve(u)}"${ext(u) ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_, a, b) => `<strong>${a || b}</strong>`)
       .replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>').replace(/(^|[^\w])_([^_\n]+)_(?!\w)/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => stash[+i]);
}

// opts.resolve: rewrite URLs (base path); opts.block: (line) => html|null for custom block shortcodes
export function md(src = '', opts = {}) {
  const resolve = opts.resolve || ((x) => x);
  const lines = String(src).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;
  const isBlank = (l) => !l.trim();
  const blk = (t) => (opts.block && opts.block(t)) || embedBlock(t);
  while (i < lines.length) {
    const l = lines[i];
    if (isBlank(l)) { i++; continue; }
    const custom = blk(l.trim());
    if (custom) { out.push(custom); i++; continue; }
    let m;
    if (/^```/.test(l)) {
      const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++; out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`); continue;
    }
    if ((m = l.match(/^(#{1,4})\s+(.*)$/))) { const n = Math.min(m[1].length + 1, 4); out.push(`<h${n}>${inline(m[2], resolve)}</h${n}>`); i++; continue; }
    if (/^(-{3,}|\*{3,})\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
    if (/^>\s?/.test(l)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${md(buf.join('\n'), opts)}</blockquote>`); continue;
    }
    if (/^\s*([-*+]|\d+\.)\s+/.test(l)) {
      const ordered = /^\s*\d+\./.test(l), buf = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) buf.push(`<li>${inline(lines[i++].replace(/^\s*([-*+]|\d+\.)\s+/, ''), resolve)}</li>`);
      out.push(`<${ordered ? 'ol' : 'ul'}>${buf.join('')}</${ordered ? 'ol' : 'ul'}>`); continue;
    }
    const buf = [];
    while (i < lines.length && !isBlank(lines[i]) && !/^(#{1,4}\s|```|>\s?|\s*([-*+]|\d+\.)\s+)/.test(lines[i]) && !blk(lines[i].trim())) buf.push(lines[i++]);
    out.push(`<p>${inline(buf.join('\n'), resolve).replace(/(?:\\| {2,})?\n/g, '<br>')}</p>`);
  }
  return out.join('\n');
}
export const stripMd = (s = '') => String(s).replace(/\[\[product:[^\]]+\]\]/g, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[#>*_`]/g, '').replace(/\s+/g, ' ').trim();

/* ---- YouTube embeds ----
   A line that is ONLY a YouTube link (bare, <link>, or [link](link)) or [[youtube:LINK-or-ID]] becomes a responsive 16:9 player. */
function ytParse(u) {
  u = String(u).trim();
  if (/^[\w-]{11}$/.test(u)) return { id: u, start: 0 };
  let x; try { x = new URL(u); } catch { return null; }
  const h = x.hostname.replace(/^(www\.|m\.|music\.)/, '');
  let id = null;
  if (h === 'youtu.be') id = x.pathname.slice(1).split('/')[0];
  else if (h === 'youtube.com' || h === 'youtube-nocookie.com') {
    if (x.pathname === '/watch') id = x.searchParams.get('v');
    else { const m = x.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/); id = m && m[1]; }
  }
  if (!id || !/^[\w-]{11}$/.test(id)) return null;
  const t = x.searchParams.get('t') || x.searchParams.get('start') || '';
  const start = /^\d+$/.test(t) ? +t : (t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/) || []).slice(1).reduce((a, v, i) => a + (+v || 0) * [3600, 60, 1][i], 0);
  return { id, start: start || 0 };
}
export function embedBlock(line) {
  const s = String(line).replace(/\\([_*\[\]()])/g, '$1').trim();
  let url = null, m;
  if ((m = s.match(/^\[\[youtube:\s*(.+?)\s*\]\]$/i))) url = m[1];
  else if ((m = s.match(/^<?(https?:\/\/[^\s<>]+)>?$/))) url = m[1];
  else if ((m = s.match(/^\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)$/)) && (/^https?:/.test(m[1]) || m[1] === '')) url = m[2];
  const v = url && ytParse(url);
  if (!v) return null;
  return `<div class="yt"><iframe src="https://www.youtube-nocookie.com/embed/${v.id}${v.start ? '?start=' + v.start : ''}" title="YouTube video" loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
}
