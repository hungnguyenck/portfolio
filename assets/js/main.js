/* One script for every page. Each feature checks that its elements exist, so it is safe on all pages. */
(function () {
  var root = document.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || document).querySelectorAll(s)); };

  /* ---------- Views (themes): ember = Marketing, blue = Product, light = Balanced ---------- */
  var VIEWS = ['ember', 'blue', 'light'];
  var btns = $$('.sw button');
  var layoutHooks = [];
  function setView(t) {
    if (VIEWS.indexOf(t) < 0) t = 'ember';
    root.setAttribute('data-theme', t);
    btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-t') === t)); });
    try { localStorage.setItem('ck-theme2', t); } catch (e) {}
    layoutHooks.forEach(function (f) { f(t); });
  }
  var start = root.getAttribute('data-theme') || 'ember';
  try { start = localStorage.getItem('ck-theme2') || start; } catch (e) {}
  btns.forEach(function (b) { b.addEventListener('click', function () { setView(b.getAttribute('data-t')); }); });
  function fromHash() { var m = { orange: 'ember', marketing: 'ember', blue: 'blue', product: 'blue', light: 'light', balanced: 'light' }[location.hash.slice(1)]; if (m) setView(m); }

  /* ---------- Hero: rotated "CK" fitted to the Hung / Nguyen stack ---------- */
  function fit() {
    var n = $('.nl'), c = $('.ck'), t = $('.ckt'); if (!n || !c || !t) return;
    c.style.fontSize = '100px';
    c.style.fontSize = (100 * n.offsetHeight / t.getBoundingClientRect().height) + 'px';
  }
  if ($('.ck')) { fit(); addEventListener('resize', fit); addEventListener('load', fit); if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit); }

  /* ---------- Intro: Full story / Summary ---------- */
  var seg = $$('.seg button');
  seg.forEach(function (b) {
    b.addEventListener('click', function () {
      var v = b.getAttribute('data-v');
      seg.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      [['tldr', 'p-tldr'], ['full', 'p-full']].forEach(function (p) {
        var el = document.getElementById(p[1]), on = p[0] === v;
        el.classList.toggle('on', on); el.setAttribute('aria-hidden', String(!on));
      });
    });
  });

  /* ---------- Work grid: cards + "More things I shipped" ordered per view ---------- */
  var grid = $('.bento'), more = $('.more'), moreBox = $('.bl');
  if (grid) {
    var N = +grid.getAttribute('data-n') || 5;
    var cards = $$('.bc', grid), items = more ? $$('li', more) : [];
    var ord = function (el, t) { var v = parseFloat(el.getAttribute('data-o-' + t)); return isNaN(v) ? 999 : v; };
    var sizeFeat = function () {
      var f = $('.bc:not([hidden])', grid), n = f && f.nextElementSibling;
      if (!f) return;
      f.style.removeProperty('--ms');
      if (!n || !n.classList.contains('bc') || matchMedia('(max-width:820px)').matches) return;
      var ff = $('.foot', f), nf = $('.foot', n); ff.style.alignSelf = 'start';
      var fh = ff.getBoundingClientRect().height; ff.style.alignSelf = '';
      var s = $('.top', n).getBoundingClientRect().height + n.getBoundingClientRect().width + nf.getBoundingClientRect().height - fh;
      f.style.setProperty('--ms', Math.min(s, f.clientWidth - 250) + 'px');
    };
    layoutHooks.push(function (t) {
      var sorted = cards.slice().sort(function (a, b) { return ord(a, t) - ord(b, t); });
      var top = {};
      sorted.forEach(function (c, i) { c.hidden = i >= N; if (i < N) top[c.getAttribute('data-slug')] = 1; grid.insertBefore(c, moreBox); });
      if (more) {
        items.slice().sort(function (a, b) { return ord(a, t) - ord(b, t); }).forEach(function (li) { li.hidden = !!top[li.getAttribute('data-slug')]; more.appendChild(li); });
        if (moreBox) moreBox.hidden = items.every(function (li) { return li.hidden; });
      }
      sizeFeat();
    });
    addEventListener('resize', sizeFeat); addEventListener('load', sizeFeat);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(sizeFeat);
    cards.forEach(function (c) {
      var d = $('dialog', c); if (!d) return;
      c.addEventListener('click', function (e) { if (e.target.closest('dialog')) return; d.showModal(); root.style.overflow = 'hidden'; });
      d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
      $('.x', d).addEventListener('click', function () { d.close(); });
      d.addEventListener('close', function () { root.style.overflow = ''; });
    });
  }

  /* ---------- Project sliders: drag, swipe, dots, auto-advance ---------- */
  var sliders = [];
  $$('.slider').forEach(function (s) {
    var t = $('.track', s), n = t.children.length, d = $('.dots', s), st = { vis: false, hold: false };
    [].forEach.call(t.children, function (im) { im.draggable = false; });
    if (n < 2) { s.classList.add('single'); return; }
    function cur() { return Math.round(t.scrollLeft / t.clientWidth); }
    function go(i) { t.scrollTo({ left: i * t.clientWidth, behavior: reduce ? 'auto' : 'smooth' }); }
    for (var i = 0; i < n; i++) (function (i) { var x = document.createElement('button'); x.type = 'button'; x.setAttribute('aria-label', 'Image ' + (i + 1)); x.onclick = function () { go(i); }; d.appendChild(x); })(i);
    function upd() { [].forEach.call(d.children, function (x, k) { x.setAttribute('aria-current', String(k === cur())); }); }
    t.addEventListener('scroll', upd); upd();
    var down = false, x0 = 0, l0 = 0;
    t.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') return; down = true; x0 = e.clientX; l0 = t.scrollLeft; t.classList.add('drag'); t.setPointerCapture(e.pointerId); });
    t.addEventListener('pointermove', function (e) { if (down) t.scrollLeft = l0 - (e.clientX - x0); });
    function end() { if (!down) return; down = false; t.classList.remove('drag'); go(cur()); }
    t.addEventListener('pointerup', end); t.addEventListener('pointercancel', end);
    s.addEventListener('mouseenter', function () { st.hold = true; }); s.addEventListener('mouseleave', function () { st.hold = false; });
    s.next = function () { go(cur() >= n - 1 ? 0 : cur() + 1); };
    sliders.push({ s: s, st: st });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { st.vis = es[0].isIntersecting; }, { threshold: .5 }).observe(s);
  });
  if (sliders.length && !reduce) setInterval(function () { if (document.hidden) return; sliders.forEach(function (o) { if (o.st.vis && !o.st.hold) o.s.next(); }); }, 5000);

  /* ---------- Card footer text: one line, scrolls sideways on hover / focus ---------- */
  if (!reduce) (function () {
    var touch = matchMedia('(hover:none)').matches, raf = new WeakMap();
    function stop(el) { var r = raf.get(el); if (r) { cancelAnimationFrame(r.id); clearTimeout(r.t); } raf.delete(el); el.classList.remove('run'); el.scrollLeft = 0; }
    function run(el) {
      if (raf.has(el) || el.scrollWidth <= el.clientWidth + 1) return;
      var max = el.scrollWidth - el.clientWidth, dir = 1, pos = 0, last = 0, st = { id: 0, t: 0 };
      raf.set(el, st); el.classList.add('run');
      function wait() { last = 0; st.t = setTimeout(function () { st.id = requestAnimationFrame(tick); }, 900); }
      function tick(ts) {
        if (!last) last = ts;
        pos += dir * (ts - last) * 0.04; last = ts;
        if (dir > 0 && pos >= max) { pos = max; dir = -1; el.scrollLeft = pos; return wait(); }
        if (dir < 0 && pos <= 0) { pos = 0; dir = 1; el.scrollLeft = 0; return wait(); }
        el.scrollLeft = pos; st.id = requestAnimationFrame(tick);
      }
      st.t = setTimeout(function () { st.id = requestAnimationFrame(tick); }, 350);
    }
    $$('.foot').forEach(function (f) {
      var els = $$('b,div>span', f), card = f.closest('.bc') || f;
      els.forEach(function (e) { e.classList.add('ov'); e.title = e.textContent; });
      card.addEventListener('mouseenter', function () { els.forEach(run); });
      card.addEventListener('mouseleave', function () { els.forEach(stop); });
      card.addEventListener('focusin', function () { els.forEach(run); });
      card.addEventListener('focusout', function () { els.forEach(stop); });
      if (touch && 'IntersectionObserver' in window) new IntersectionObserver(function (es) { es.forEach(function (x) { els.forEach(x.isIntersecting ? run : stop); }); }, { threshold: .6 }).observe(f);
    });
  })();

  /* ---------- Fade-in on scroll ---------- */
  if ('IntersectionObserver' in window) {
    root.classList.add('js');
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: .08 });
    $$('.rv').forEach(function (el) { io.observe(el); });
  }

  setView(start); fromHash(); addEventListener('hashchange', fromHash);
})();
