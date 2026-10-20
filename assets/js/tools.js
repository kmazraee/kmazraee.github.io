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
    'wacc': function () {
      var rf = num($('rf').value) / 100, b = num($('beta').value), mrp = num($('mrp').value) / 100,
          kd = num($('kd').value) / 100, t = num($('tax').value) / 100, e = num($('e').value), d = num($('d').value);
      if ([rf, b, mrp, kd, t, e, d].some(isNaN) || e + d <= 0) { ['o-wacc', 'o-ke', 'o-kd', 'o-dv'].forEach(function (id) { set(id, '—'); }); return; }
      var ke = rf + b * mrp, kdt = kd * (1 - t), wd = d / (e + d), w = (1 - wd) * ke + wd * kdt;
      set('o-wacc', pct(w)); set('o-ke', pct(ke)); set('o-kd', pct(kdt)); set('o-dv', pct(wd));
      $('o-note').textContent = 'هر پروژه‌ای که بازده آن کمتر از ' + pct(w) + ' باشد، برای این شرکت ارزش نمی‌سازد.';
    },
    'dcf': function () {
      var fcf = $('fcf').value.split(/\n|;/).map(num).filter(function (x) { return !isNaN(x); });
      var w = num($('w').value) / 100, g = num($('g').value) / 100, nd = num($('nd').value), sh = num($('sh').value);
      var ids = ['o-eq', 'o-ev', 'o-tv', 'o-ps'];
      if (!fcf.length || isNaN(w) || isNaN(g)) { ids.forEach(function (id) { set(id, '—'); }); return; }
      if (g >= w) { ids.forEach(function (id) { set(id, '—'); }); $('o-note').textContent = 'رشد بلندمدت باید کمتر از WACC باشد.'; return; }
      var pv = fcf.reduce(function (s, c, i) { return s + c / Math.pow(1 + w, i + 1); }, 0);
      var n = fcf.length, tv = fcf[n - 1] * (1 + g) / (w - g), pvtv = tv / Math.pow(1 + w, n);
      var ev = pv + pvtv, eq = ev - (isNaN(nd) ? 0 : nd);
      set('o-eq', fa(eq, 1) + ' میلیارد تومان', eq < 0); set('o-ev', fa(ev, 1) + ' میلیارد تومان');
      set('o-tv', pct(pvtv / ev));
      set('o-ps', isNaN(sh) || sh <= 0 ? '—' : fa(eq * 1000 / sh) + ' تومان', eq < 0);
      $('o-note').textContent = pvtv / ev > 0.75 ? 'بیش از سه‌چهارم ارزش از ارزش پایانی می‌آید؛ نتیجه به رشد بلندمدت و WACC بسیار حساس است.' : '';
    },
    'ccc': function () {
      var rev = num($('rev').value), cogs = num($('cogs').value), ar = num($('ar').value), inv = num($('inv').value), ap = num($('ap').value);
      var ids = ['o-ccc', 'o-dso', 'o-dio', 'o-dpo', 'o-free'];
      if ([rev, cogs, ar, inv, ap].some(isNaN) || rev <= 0 || cogs <= 0) { ids.forEach(function (id) { set(id, '—'); }); return; }
      var dso = ar / rev * 365, dio = inv / cogs * 365, dpo = ap / cogs * 365, c = dso + dio - dpo;
      var day = function (x) { return fa(x) + ' روز'; };
      set('o-ccc', day(c), c > 90); set('o-dso', day(dso)); set('o-dio', day(dio)); set('o-dpo', day(dpo));
      set('o-free', fa(cogs / 365 * 10, 1) + ' میلیارد تومان');
      $('o-note').textContent = c < 0 ? 'چرخه منفی است: تأمین‌کننده‌ها پیش از وصول از مشتری، کار شما را تأمین مالی می‌کنند.'
        : 'حدود ' + fa(cogs / 365 * c, 1) + ' میلیارد تومان نقدینگی در این چرخه گیر کرده است.';
    },
    'break-even': function () {
      var fc = num($('fc').value), price = num($('price').value), vc = num($('vc').value), q = num($('q').value);
      var ids = ['o-bep', 'o-bepr', 'o-mos', 'o-ebit', 'o-dol'];
      if ([fc, price, vc].some(isNaN)) { ids.forEach(function (id) { set(id, '—'); }); return; }
      var cm = price - vc;
      if (cm <= 0) { ids.forEach(function (id) { set(id, '—'); }); $('o-note').textContent = 'قیمت فروش باید از هزینه‌ی متغیر هر واحد بیشتر باشد.'; return; }
      // fc in million toman, price/vc in thousand toman per unit → units = fc*1000/cm
      var bep = fc * 1000 / cm;
      set('o-bep', fa(Math.ceil(bep)) + ' واحد'); set('o-bepr', fa(bep * price / 1000) + ' میلیون تومان');
      if (isNaN(q) || q <= 0) { ['o-mos', 'o-ebit', 'o-dol'].forEach(function (id) { set(id, '—'); }); $('o-note').textContent = ''; return; }
      var ebit = q * cm / 1000 - fc, mos = (q - bep) / q;
      set('o-mos', pct(mos), mos < 0); set('o-ebit', fa(ebit) + ' میلیون تومان', ebit < 0);
      set('o-dol', ebit > 0 ? fa(q * cm / 1000 / ebit, 2) : '—');
      $('o-note').textContent = ebit > 0 ? 'با این اهرم، ۱۰ درصد افت فروش سود عملیاتی را حدود ' + fa(q * cm / 1000 / ebit * 10) + ' درصد کم می‌کند.' : 'در این حجم فروش، شرکت زیر نقطه‌ی سربه‌سر است.';
    },
    'dupont': function () {
      var ni = num($('ni').value), s = num($('sales').value), ta = num($('ta').value), e = num($('eq').value);
      var ids = ['o-roe', 'o-npm', 'o-at', 'o-em', 'o-roa'];
      if ([ni, s, ta, e].some(isNaN) || s <= 0 || ta <= 0 || e <= 0) { ids.forEach(function (id) { set(id, '—'); }); return; }
      var npm = ni / s, at = s / ta, em = ta / e;
      set('o-roe', pct(npm * at * em), ni < 0); set('o-npm', pct(npm), ni < 0); set('o-at', fa(at, 2) + ' بار');
      set('o-em', fa(em, 2) + ' برابر'); set('o-roa', pct(ni / ta), ni < 0);
      $('o-note').textContent = em > 3 ? 'بخش بزرگی از ROE از اهرم مالی می‌آید؛ بازده بالا با ریسک بالای بدهی همراه است.' : '';
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
