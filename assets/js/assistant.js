// Site assistant: finds the site pages that match a question (from /assets/ai-index.json),
// sends the question and those page addresses to the assistant service, and shows the streamed answer.
(function () {
  var panel = document.getElementById('ai-panel');
  var fab = document.querySelector('[data-ai-open]');
  if (!panel || !fab) return;
  var endpoint = panel.getAttribute('data-ai-endpoint');
  var here = panel.getAttribute('data-ai-here');
  var log = panel.querySelector('[data-ai-log]');
  var form = panel.querySelector('[data-ai-form]');
  var box = form.querySelector('textarea');
  var sendBtn = form.querySelector('button');
  var STORE = 'ai-chat';
  var history = []; // {r:'u'|'m', t, refs?}
  var index = null, indexing = null, busy = false;

  // ---------- search over the site index ----------
  var STOP = ' و در به از که این را با است برای آن یک تا هم ها های می نمی شود شده کند کنم کنید چه چی چیست چطور چگونه کجا آیا یا اگر بر هر ما من شما او ولی اما پس نیز باید دارد دارم بود هست نیست درباره توضیح بده بگو لطفا خیلی چند کدام فرق بین مثال ‌';
  var stop = {};
  STOP.split(' ').forEach(function (w) { if (w) stop[w] = 1; });
  function norm(s) {
    return (s || '').toLowerCase()
      .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[ۀة]/g, 'ه').replace(/[أإآ]/g, 'ا')
      .replace(/[ً-ٰٟـ]/g, '')
      .replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); })
      .replace(/‌/g, ' ');
  }
  function stem(w) {
    if (w.length > 5) w = w.replace(/(هایی|های|ها|ترین|تر)$/, '');
    if (w.length > 4) w = w.replace(/ی$/, '');
    return w;
  }
  function tokens(s) {
    var out = [];
    norm(s).split(/[^0-9a-z؀-ۿ]+/).forEach(function (w) {
      if (w.length < 2 || stop[w]) return;
      out.push(stem(w));
    });
    return out;
  }
  function loadIndex() {
    if (indexing) return indexing;
    indexing = fetch(panel.getAttribute('data-ai-index')).then(function (r) { return r.json(); }).then(function (docs) {
      var df = {};
      docs.forEach(function (d) {
        d.T = {}; d.K = {}; d.D = {};
        tokens(d.t).forEach(function (w) { d.T[w] = 1; });
        tokens(d.k).forEach(function (w) { d.K[w] = 1; });
        tokens(d.d).forEach(function (w) { d.D[w] = 1; });
        var seen = {};
        [d.T, d.K, d.D].forEach(function (m) { for (var w in m) seen[w] = 1; });
        for (var w in seen) df[w] = (df[w] || 0) + 1;
      });
      index = { docs: docs, df: df, byUrl: docs.reduce(function (m, d) { m[d.u] = d; return m; }, {}) };
      return index;
    }).catch(function () { indexing = null; return null; });
    return indexing;
  }
  function search(q, n) {
    if (!index) return [];
    var qt = tokens(q), N = index.docs.length;
    if (!qt.length) return [];
    var res = [];
    index.docs.forEach(function (d) {
      var s = 0, matched = 0;
      qt.forEach(function (w) {
        var df = index.df[w];
        if (!df) return;
        var idf = Math.log(1 + N / df), hit = 0;
        if (d.T[w]) hit += 3;
        if (d.K[w]) hit += 2;
        if (d.D[w]) hit += 1;
        if (hit) { s += hit * idf; matched++; }
      });
      if (s) res.push({ d: d, s: s * (0.5 + matched / qt.length) });
    });
    res.sort(function (a, b) { return b.s - a.s; });
    return res.slice(0, n).map(function (x) { return x.d; });
  }

  // ---------- rendering ----------
  function esc(s) { return s.replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function safeUrl(u) {
    if (/^\/(?!\/)/.test(u)) return u;
    try { var x = new URL(u); if (x.origin === location.origin) return x.pathname + x.search + x.hash; } catch (e) {}
    return null;
  }
  function inline(s) {
    return s
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, t, u) { var v = safeUrl(u); return v ? '<a href="' + v + '">' + t + '</a>' : t; })
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }
  // the model sometimes writes LaTeX formulas; turn the common parts into plain text
  function plainMath(t) {
    for (var i = 0; i < 3; i++) t = t.replace(/\\(?:d?frac)\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1) ÷ ($2)');
    return t
      .replace(/\\(?:text|textbf|mathrm|mathbf|operatorname)\s*\{([^{}]*)\}/g, '$1')
      .replace(/\\times/g, '×').replace(/\\cdot/g, '·').replace(/\\div/g, '÷').replace(/\\pm/g, '±')
      .replace(/\\(?:leq|le)\b/g, '≤').replace(/\\(?:geq|ge)\b/g, '≥').replace(/\\neq/g, '≠').replace(/\\approx/g, '≈')
      .replace(/\\sum/g, 'Σ').replace(/\\(?:left|right|displaystyle)/g, '').replace(/\\[,;! ]/g, ' ')
      .replace(/\\[\[\]()]/g, '').replace(/\$\$?/g, '').replace(/\\%/g, '%')
      .replace(/([_^])\{([^{}]*)\}/g, '$1$2');
  }
  function md(text) {
    var html = '', list = null;
    esc(plainMath(text)).split('\n').forEach(function (line) {
      var m = line.match(/^\s*(?:[-*•]|(\d+|[۰-۹]+)[.)])\s+(.*)$/);
      if (m) {
        var tag = m[1] ? 'ol' : 'ul';
        if (list !== tag) { if (list) html += '</' + list + '>'; html += '<' + tag + '>'; list = tag; }
        html += '<li>' + inline(m[2]) + '</li>';
        return;
      }
      if (list) { html += '</' + list + '>'; list = null; }
      var h = line.match(/^#{1,4}\s+(.*)$/);
      if (h) html += '<p><b>' + inline(h[1]) + '</b></p>';
      else if (line.trim()) html += '<p>' + inline(line) + '</p>';
    });
    if (list) html += '</' + list + '>';
    return html;
  }
  function bubble(role, text, refs) {
    var el = document.createElement('div');
    el.className = 'ai-msg ' + (role === 'u' ? 'ai-user' : 'ai-bot');
    var body = document.createElement('div');
    body.className = 'ai-body';
    if (role === 'u') body.textContent = text; else body.innerHTML = md(text);
    el.appendChild(body);
    if (refs && refs.length) addRefs(el, refs);
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }
  function addRefs(el, refs) {
    var box = document.createElement('div');
    box.className = 'ai-refs';
    box.appendChild(document.createTextNode('برای خواندن بیشتر:'));
    refs.forEach(function (r) {
      var a = document.createElement('a');
      a.href = r.u; a.textContent = r.t;
      box.appendChild(a);
    });
    el.appendChild(box);
  }
  var ERR = {
    rate: 'پرسش‌ها کمی سریع بود. یک دقیقه صبر کنید و دوباره بپرسید.',
    quota: 'سهمیه‌ی رایگان امروز دستیار تمام شده است. لطفاً بعداً دوباره سر بزنید.',
    region: 'سرویس هوش مصنوعی فعلاً از این مسیر در دسترس نیست. کمی بعد دوباره امتحان کنید.',
    net: 'ارتباط با دستیار برقرار نشد. اتصال اینترنت را بررسی کنید و دوباره امتحان کنید.'
  };

  // ---------- saving the conversation for this browser tab ----------
  function save() { try { sessionStorage.setItem(STORE, JSON.stringify(history.slice(-12))); } catch (e) {} }
  function restore() {
    try { history = JSON.parse(sessionStorage.getItem(STORE) || '[]') || []; } catch (e) { history = []; }
    history.forEach(function (h) { bubble(h.r, h.t, h.refs); });
  }

  // ---------- asking ----------
  function ask(q) {
    q = q.trim();
    if (!q || busy) return;
    busy = true; sendBtn.disabled = true;
    var prior = history.slice(-6).map(function (h) { return { r: h.r, t: h.t.slice(0, 1500) }; });
    history.push({ r: 'u', t: q }); save();
    bubble('u', q);
    box.value = ''; grow();
    var el = bubble('m', '');
    el.classList.add('ai-wait');
    var body = el.querySelector('.ai-body');
    body.innerHTML = '<span class="ai-dots"><i></i><i></i><i></i></span>';

    loadIndex().then(function () {
      // the current page first, then the best matches for this question (and the previous one, for follow-ups)
      var lastQ = '';
      for (var i = history.length - 2; i >= 0; i--) if (history[i].r === 'u') { lastQ = history[i].t; break; }
      var found = search(q, 4);
      if (found.length < 2 && lastQ) found = found.concat(search(lastQ + ' ' + q, 3));
      var refs = [], seen = {};
      if (here) { refs.push(here); seen[here] = 1; }
      found.forEach(function (d) { if (!seen[d.u] && refs.length < 5) { refs.push(d.u); seen[d.u] = 1; } });
      return fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: q, history: prior, refs: refs })
      }).then(function (res) {
        if (!res.ok) return res.json().catch(function () { return {}; }).then(function (j) { throw new Error(j.error || 'net'); });
        var reader = res.body.getReader(), dec = new TextDecoder(), text = '';
        el.classList.remove('ai-wait');
        function pump() {
          return reader.read().then(function (r) {
            if (r.done) return text;
            text += dec.decode(r.value, { stream: true });
            body.innerHTML = md(text);
            log.scrollTop = log.scrollHeight;
            return pump();
          });
        }
        return pump().then(function (answer) {
          var cited = {};
          (answer.match(/\]\((\/[^)\s]+)\)/g) || []).forEach(function (m) { cited[m.slice(2, -1).split('#')[0]] = 1; });
          var more = refs.filter(function (u) { return u !== here && !cited[u]; }).map(function (u) { return index && index.byUrl[u]; }).filter(Boolean).slice(0, 3)
            .map(function (d) { return { u: d.u, t: d.t }; });
          if (more.length) addRefs(el, more);
          history.push({ r: 'm', t: answer, refs: more }); save();
        });
      });
    }).catch(function (e) {
      el.classList.remove('ai-wait');
      el.classList.add('ai-error');
      body.textContent = ERR[e && e.message] || 'دستیار الان پاسخ نداد. کمی بعد دوباره امتحان کنید.';
      history.pop(); save();
    }).then(function () {
      busy = false; sendBtn.disabled = false;
      log.scrollTop = log.scrollHeight;
    });
  }

  // ---------- opening, closing, typing ----------
  function open() {
    panel.hidden = false; fab.setAttribute('aria-expanded', 'true'); fab.hidden = true;
    loadIndex();
    setTimeout(function () { box.focus(); }, 30);
  }
  function close() { panel.hidden = true; fab.hidden = false; fab.setAttribute('aria-expanded', 'false'); fab.focus(); }
  function grow() { box.style.height = 'auto'; box.style.height = Math.min(box.scrollHeight, 140) + 'px'; }
  fab.addEventListener('click', open);
  panel.querySelector('[data-ai-close]').addEventListener('click', close);
  panel.querySelector('[data-ai-reset]').addEventListener('click', function () {
    history = []; save();
    log.querySelectorAll('.ai-msg:not(.ai-welcome)').forEach(function (m) { m.remove(); });
    box.focus();
  });
  panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  panel.querySelectorAll('[data-ai-ask]').forEach(function (b) { b.addEventListener('click', function () { ask(b.textContent); }); });
  form.addEventListener('submit', function (e) { e.preventDefault(); ask(box.value); });
  box.addEventListener('input', grow);
  box.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(box.value); } });
  restore();
})();
