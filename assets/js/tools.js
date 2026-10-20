(function () {
  var form = document.querySelector('.tool-form');
  if (!form) return;
  var $ = function (id) { return document.getElementById(id); };

  // Accept Persian/Arabic digits, thousands separators and the Persian decimal mark.
  var num = function (s) {
    s = String(s).replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); })
                 .replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); })
                 .replace(/[,٬،\s]/g, '').replace('٫', '.').replace(/[−–]/g, '-');
    return s === '' ? NaN : Number(s);
  };
  var fa = function (x, digits) { return x.toLocaleString('fa-IR', { maximumFractionDigits: digits == null ? 0 : digits }); };
  var pct = function (x) { return fa(x * 100, 1) + '٪'; };
  var money = function (x) { return fa(Math.round(x)) + ' تومان'; };
  var set = function (id, text, bad) { var el = $(id); el.textContent = text; el.classList.toggle('neg', !!bad); };

  var tools = {
    'real-return': function () {
      var n = num($('n').value) / 100, i = num($('i').value) / 100, a = num($('a').value), y = num($('y').value);
      if ([n, i].some(isNaN) || i <= -1) return set('o-real', '—');
      var real = (1 + n) / (1 + i) - 1;
      set('o-real', pct(real), real < 0);
      if (isNaN(a) || isNaN(y)) { set('o-nom', '—'); set('o-pp', '—'); return; }
      var nom = a * Math.pow(1 + n, y), pp = a * Math.pow(1 + real, y);
      set('o-nom', money(nom)); set('o-pp', money(pp), pp < a);
      $('o-note').textContent = real < 0
        ? 'با این نرخ‌ها، قدرت خرید پولتان در ' + fa(y) + ' سال حدود ' + fa((1 - pp / a) * 100) + ' درصد کم می‌شود.'
        : 'با این نرخ‌ها، قدرت خرید پولتان در ' + fa(y) + ' سال حدود ' + fa((pp / a - 1) * 100) + ' درصد بیشتر می‌شود.';
    },
    'npv-irr': function () {
      var r = num($('r').value) / 100;
      var cf = $('cf').value.split(/\n|;/).map(num).filter(function (x) { return !isNaN(x); });
      if (cf.length < 2) { set('o-npv', '—'); set('o-irr', '—'); set('o-pb', '—'); $('o-note').textContent = 'دست‌کم دو جریان نقدی وارد کنید.'; return; }
      var npvAt = function (rate) { return cf.reduce(function (s, c, t) { return s + c / Math.pow(1 + rate, t); }, 0); };
      if (!isNaN(r)) { var v = npvAt(r); set('o-npv', fa(v, 1), v < 0); } else set('o-npv', '—');
      var lo = -0.99, hi = 10, flo = npvAt(lo), fhi = npvAt(hi), irr = NaN;
      if (flo * fhi < 0) {
        for (var k = 0; k < 200; k++) { var mid = (lo + hi) / 2, fm = npvAt(mid); if (flo * fm <= 0) { hi = mid; } else { lo = mid; flo = fm; } }
        irr = (lo + hi) / 2;
      }
      set('o-irr', isNaN(irr) ? 'محاسبه‌پذیر نیست' : pct(irr), !isNaN(irr) && !isNaN(r) && irr < r);
      var cum = 0, pb = NaN;
      for (var t = 0; t < cf.length; t++) {
        var prev = cum; cum += cf[t];
        if (t > 0 && prev < 0 && cum >= 0) { pb = t - 1 + (-prev / cf[t]); break; }
      }
      set('o-pb', isNaN(pb) ? 'در این دوره برنمی‌گردد' : fa(pb, 1) + ' سال', isNaN(pb));
      var signs = 0; for (var j = 1; j < cf.length; j++) if (cf[j] * cf[j - 1] < 0) signs++;
      $('o-note').textContent = signs > 1 ? 'علامت جریان‌ها بیش از یک بار عوض شده؛ ممکن است بیش از یک IRR وجود داشته باشد.'
        : (!isNaN(irr) && !isNaN(r) ? (irr >= r ? 'IRR از نرخ تنزیل بیشتر است؛ پروژه ارزش‌آفرین است.' : 'IRR از نرخ تنزیل کمتر است؛ پروژه ارزش را از بین می‌برد.') : '');
    },
    'loan': function () {
      var p = num($('p').value), y = num($('rate').value) / 100, n = Math.round(num($('m').value));
      if ([p, y, n].some(isNaN) || n <= 0) { ['o-pay', 'o-total', 'o-int', 'o-eff'].forEach(function (id) { set(id, '—'); }); return; }
      var r = y / 12, pay = r === 0 ? p / n : p * r / (1 - Math.pow(1 + r, -n));
      set('o-pay', money(pay)); set('o-total', money(pay * n)); set('o-int', money(pay * n - p));
      set('o-eff', pct(Math.pow(1 + r, 12) - 1));
      $('o-note').textContent = 'سود کل ' + fa((pay * n - p) / p * 100) + ' درصدِ اصل وام است.';
    }
  };

  var run = tools[form.getAttribute('data-tool')];
  form.addEventListener('input', run);
  run();
})();
