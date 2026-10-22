(function () {
  var fa = function (opts) { try { return new Intl.DateTimeFormat('fa-IR-u-ca-persian', opts); } catch (e) { return null; } };
  var full = fa({ day: 'numeric', month: 'long', year: 'numeric' });
  var short = fa({ day: 'numeric', month: 'long' });
  var yearF = fa({ year: 'numeric' });
  var toDate = function (s) { return new Date(s + 'T12:00:00Z'); };
  var jyear = function (s) { return yearF ? yearF.format(toDate(s)) : s.slice(0, 4); };

  document.querySelectorAll('time.jdate').forEach(function (t) {
    var f = t.hasAttribute('data-short') ? short : full;
    if (f) t.textContent = f.format(toDate(t.getAttribute('datetime')));
  });
  document.querySelectorAll('.jyear').forEach(function (el) {
    el.textContent = yearF ? yearF.format(new Date()) : new Date().getFullYear();
  });

  // mobile menu
  var menu = document.getElementById('menu');
  var openBtn = document.querySelector('[data-menu-open]');
  if (menu && openBtn) {
    openBtn.addEventListener('click', function () { menu.setAttribute('open', ''); openBtn.setAttribute('aria-expanded', 'true'); });
    menu.querySelector('[data-menu-close]').addEventListener('click', function () { menu.removeAttribute('open'); openBtn.setAttribute('aria-expanded', 'false'); });
  }

  // article: reading progress, table of contents, copy link
  var prose = document.getElementById('prose');
  if (prose) {
    var bar = document.getElementById('progress');
    var onScroll = function () {
      var r = prose.getBoundingClientRect();
      var p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
      bar.style.width = (p * 100) + '%';
    };
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
    var toc = document.getElementById('toc');
    var hs = prose.querySelectorAll('h2');
    hs.forEach(function (h, i) {
      if (!h.id) h.id = 's' + (i + 1);
      var a = document.createElement('a');
      a.href = '#' + h.id;
      a.innerHTML = '<span>' + (i + 1).toLocaleString('fa-IR') + '</span>';
      a.appendChild(document.createTextNode(h.textContent.replace(/^گام [^:]+:\s*/, '')));
      toc.appendChild(a);
    });
    if (hs.length) toc.hidden = false;
    var copy = document.querySelector('[data-copy]');
    if (copy) copy.addEventListener('click', function () {
      navigator.clipboard && navigator.clipboard.writeText(location.href).then(function () { copy.textContent = 'کپی شد'; });
    });
  }

  // blog list: group by Persian year, filter by topic, search
  var list = document.getElementById('post-list');
  if (list) {
    var entries = Array.prototype.slice.call(list.querySelectorAll('.entry'));
    var groups = {};
    list.innerHTML = '';
    entries.forEach(function (e) {
      var y = jyear(e.getAttribute('data-date'));
      if (!groups[y]) {
        var sec = document.createElement('section'); sec.className = 'year';
        sec.innerHTML = '<div class="year-num">' + y + '</div><div></div>';
        list.appendChild(sec); groups[y] = sec;
      }
      groups[y].lastChild.appendChild(e);
    });
    var params = new URLSearchParams(location.search);
    var topic = params.get('topic') || '';
    var tag = params.get('tag') || '';
    var q = document.getElementById('q');
    var btns = document.querySelectorAll('.seg [data-topic]');
    if (tag) {
      document.getElementById('tag-name').textContent = tag;
      document.getElementById('tag-filter').hidden = false;
    }
    var tagsOf = function (e) { return (e.getAttribute('data-tags') || '').split('|'); };
    var apply = function () {
      var term = (q.value || '').trim();
      var shown = 0;
      entries.forEach(function (e) {
        var ok = (!topic || e.getAttribute('data-topic') === topic) &&
          (!tag || tagsOf(e).indexOf(tag) !== -1) &&
          (!term || e.textContent.indexOf(term) !== -1 || tagsOf(e).join(' ').indexOf(term) !== -1);
        e.hidden = !ok; if (ok) shown++;
      });
      list.querySelectorAll('.year').forEach(function (s) { s.hidden = !s.querySelector('.entry:not([hidden])'); });
      document.getElementById('empty').style.display = shown ? 'none' : 'block';
      btns.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-topic') === topic ? 'true' : 'false'); });
    };
    btns.forEach(function (b) { b.addEventListener('click', function () { topic = b.getAttribute('data-topic'); apply(); }); });
    q.addEventListener('input', apply);
    apply();
  }
})();
