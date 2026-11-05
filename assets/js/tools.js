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
    },
    'margins': function () {
      var s = num($('sales').value), c = num($('cogs').value), o = num($('opex').value), da = num($('da').value), i = num($('int').value), t = num($('tax').value) / 100;
      var ids = ['o-gm', 'o-ebitda', 'o-ebit', 'o-ni', 'o-nm'];
      if ([s, c, o, da, i].some(isNaN) || s <= 0) { ids.forEach(function (id) { set(id, '—'); }); return; }
      if (isNaN(t) || t < 0) t = 0;
      var gp = s - c, ebitda = gp - o, ebit = ebitda - da, ebt = ebit - i, ni = ebt - Math.max(ebt, 0) * t;
      var b = ' میلیارد تومان';
      set('o-gm', pct(gp / s), gp < 0); set('o-ebitda', fa(ebitda, 1) + b + ' (' + pct(ebitda / s) + ')', ebitda < 0);
      set('o-ebit', fa(ebit, 1) + b + ' (' + pct(ebit / s) + ')', ebit < 0);
      set('o-ni', fa(ni, 1) + b, ni < 0); set('o-nm', pct(ni / s), ni < 0);
      $('o-note').textContent = ebit > 0 && i > 0 ? 'بهره ' + fa(ebit / i, 1) + ' بار از سود عملیاتی پوشش داده می‌شود.' : (ebit <= 0 ? 'سود عملیاتی صفر یا منفی است.' : '');
    },
    'ratios': function () {
      var ca = num($('ca').value), inv = num($('inv').value), cash = num($('cash').value), cl = num($('cl').value),
          debt = num($('debt').value), eq = num($('eq').value), ebit = num($('ebit').value), int = num($('int').value),
          ebitda = num($('ebitda').value), cf = num($('cfads').value), ds = num($('ds').value);
      var ratio = function (a, b, d) { return isNaN(a) || isNaN(b) || b === 0 ? '—' : fa(a / b, d == null ? 2 : d); };
      set('o-cr', ratio(ca, cl)); set('o-qr', ratio(ca - inv, cl)); set('o-cash', ratio(cash, cl));
      set('o-de', ratio(debt, eq)); set('o-ic', ratio(ebit, int, 1)); set('o-nde', ratio(debt - cash, ebitda, 1));
      set('o-dscr', ratio(cf, ds));
      var cr = ca / cl, dscr = cf / ds, msg = [];
      if (cr < 1) msg.push('نسبت جاری کمتر از یک است؛ فشار نقدینگی کوتاه‌مدت.');
      if (dscr < 1.2) msg.push('پوشش خدمت بدهی کمتر از ۱٫۲ است؛ بیشتر وام‌دهندگان حاشیه‌ی بیشتری می‌خواهند.');
      $('o-note').textContent = msg.join(' ');
    },
    'cagr': function () {
      var a = num($('a').value), b = num($('b').value), y = num($('y').value);
      var ids = ['o-cagr', 'o-tot', 'o-dbl', 'o-r72'];
      if ([a, b, y].some(isNaN) || a <= 0 || b <= 0 || y <= 0) { ids.forEach(function (id) { set(id, '—'); }); return; }
      var g = Math.pow(b / a, 1 / y) - 1;
      set('o-cagr', pct(g), g < 0); set('o-tot', pct(b / a - 1), b < a);
      if (g > 0) { set('o-dbl', fa(Math.log(2) / Math.log(1 + g), 1) + ' سال'); set('o-r72', fa(72 / (g * 100), 1) + ' سال'); }
      else { set('o-dbl', '—'); set('o-r72', '—'); }
      $('o-note').textContent = 'اگر رشد هر سال دقیقاً ' + pct(g) + ' بود، از ' + fa(a) + ' به ' + fa(b) + ' می‌رسیدید. رشد واقعی سال‌به‌سال نوسان دارد.';
    },
    'fv': function () {
      var p = num($('p').value), m = num($('m').value), r = num($('r').value) / 100, y = num($('y').value);
      var ids = ['o-fv', 'o-in', 'o-int', 'o-real'];
      if ([p, m, r, y].some(isNaN) || y <= 0) { ids.forEach(function (id) { set(id, '—'); }); return; }
      var i = r / 12, n = Math.round(y * 12);
      var fv = i === 0 ? p + m * n : p * Math.pow(1 + i, n) + m * (Math.pow(1 + i, n) - 1) / i;
      var paid = p + m * n;
      set('o-fv', money(fv)); set('o-in', money(paid)); set('o-int', money(fv - paid));
      var inf = num($('inf').value) / 100;
      set('o-real', isNaN(inf) ? '—' : money(fv / Math.pow(1 + inf, y)));
      $('o-note').textContent = 'سود ' + fa((fv - paid) / fv * 100) + ' درصد مبلغ نهایی را می‌سازد؛ هرچه افق بلندتر، سهم سود بیشتر.';
    },
    'goal': function () {
      var g = num($('g').value), p = num($('p').value), r = num($('r').value) / 100, y = num($('y').value);
      if ([g, p, r, y].some(isNaN) || y <= 0) { ['o-m', 'o-tot', 'o-gain'].forEach(function (id) { set(id, '—'); }); return; }
      var i = r / 12, n = Math.round(y * 12);
      var need = g - p * Math.pow(1 + i, n);
      var m = need <= 0 ? 0 : (i === 0 ? need / n : need * i / (Math.pow(1 + i, n) - 1));
      set('o-m', money(m)); set('o-tot', money(m * n + p));
      set('o-gain', money(g - m * n - p), g - m * n - p < 0);
      $('o-note').textContent = need <= 0 ? 'موجودی فعلی با همین بازده به تنهایی به هدف می‌رسد.' : 'فرض بر واریز در پایان هر ماه و بازده ثابت است.';
    },
    'ddm': function () {
      var d = num($('d').value), g = num($('g').value) / 100, r = num($('r').value) / 100, p = num($('price').value);
      var ids = ['o-v', 'o-y', 'o-imp'];
      if ([d, g, r].some(isNaN)) { ids.forEach(function (id) { set(id, '—'); }); return; }
      if (r <= g) { ids.forEach(function (id) { set(id, '—'); }); $('o-note').textContent = 'بازده مورد انتظار باید از رشد سود نقدی بیشتر باشد.'; return; }
      var d1 = d * (1 + g), v = d1 / (r - g);
      set('o-v', fa(v) + ' تومان'); set('o-y', pct(d1 / v));
      if (!isNaN(p) && p > 0) { set('o-imp', pct(d1 / p + g)); $('o-note').textContent = p < v ? 'قیمت بازار کمتر از ارزش ذاتی این مدل است (با فرض‌های ورودی).' : 'قیمت بازار بیشتر از ارزش ذاتی این مدل است (با فرض‌های ورودی).'; }
      else { set('o-imp', '—'); $('o-note').textContent = ''; }
    },
    'multiples': function () {
      var e = num($('e').value), m = num($('m').value), nd = num($('nd').value), sh = num($('sh').value), ni = num($('ni').value);
      var ids = ['o-ev', 'o-eq', 'o-ps', 'o-pe'];
      if ([e, m].some(isNaN)) { ids.forEach(function (id) { set(id, '—'); }); return; }
      var ev = e * m, eq = ev - (isNaN(nd) ? 0 : nd);
      set('o-ev', fa(ev, 1) + ' میلیارد تومان'); set('o-eq', fa(eq, 1) + ' میلیارد تومان', eq < 0);
      set('o-ps', isNaN(sh) || sh <= 0 ? '—' : fa(eq * 1000 / sh) + ' تومان', eq < 0);
      set('o-pe', isNaN(ni) || ni <= 0 ? '—' : fa(eq / ni, 1));
      $('o-note').textContent = 'ضریب باید از شرکت‌های قابل‌مقایسه از نظر صنعت، رشد و اندازه گرفته شود.';
    },
    'bond': function () {
      var f = num($('f').value), c = num($('c').value) / 100, y = num($('y').value) / 100, n = num($('n').value), k = Math.round(num($('k').value));
      var ids = ['o-p', 'o-cy', 'o-mac', 'o-mod'];
      if ([f, c, y, n].some(isNaN) || !(k > 0) || n <= 0) { ids.forEach(function (id) { set(id, '—'); }); return; }
      var N = Math.round(n * k), cp = f * c / k, r = y / k, pv = 0, w = 0;
      for (var t = 1; t <= N; t++) { var cf = cp + (t === N ? f : 0), d = cf / Math.pow(1 + r, t); pv += d; w += (t / k) * d; }
      var mac = w / pv, mod = mac / (1 + r);
      set('o-p', fa(pv, 2)); set('o-cy', pct(f * c / pv)); set('o-mac', fa(mac, 2) + ' سال'); set('o-mod', fa(mod, 2));
      $('o-note').textContent = 'با دیرش اصلاح‌شده‌ی ' + fa(mod, 2) + '، یک درصد افزایش نرخ بازده قیمت را حدود ' + fa(mod, 1) + ' درصد کم می‌کند. ' + (pv > f ? 'اوراق با صرف معامله می‌شود.' : pv < f ? 'اوراق با تخفیف معامله می‌شود.' : '');
    },
    'runway': function () {
      var cash = num($('cash').value), exp = num($('exp').value), rev = num($('rev').value), g = num($('g').value) / 100;
      var ids = ['o-burn', 'o-run', 'o-days', 'o-zero'];
      if ([cash, exp, rev].some(isNaN) || cash < 0) { ids.forEach(function (id) { set(id, '—'); }); return; }
      var burn = exp - rev;
      set('o-days', exp > 0 ? fa(cash / (exp / 30)) + ' روز' : '—');
      if (burn <= 0) { set('o-burn', 'مثبت (بدون سوزاندن)'); set('o-run', 'نامحدود'); set('o-zero', '—'); $('o-note').textContent = 'درآمد ماهانه از هزینه بیشتر است.'; return; }
      set('o-burn', fa(burn, 1) + ' میلیون تومان در ماه', true);
      set('o-run', fa(cash / burn, 1) + ' ماه', cash / burn < 6);
      var left = cash, m = 0, r = rev;
      if (isNaN(g)) g = 0;
      while (left > 0 && m < 120) { left -= exp - r; r *= 1 + g; m++; if (exp - r <= 0) { m = -1; break; } }
      set('o-zero', m < 0 ? 'با این رشد درآمد، به سربه‌سر می‌رسید' : (m >= 120 ? '—' : fa(m) + ' ماه'), m >= 0 && m < 6);
      $('o-note').textContent = 'سناریوی دوم درآمد را هر ماه ' + fa(g * 100, 1) + ' درصد رشد می‌دهد و هزینه را ثابت می‌گیرد.';
    },
    'compound': function () {
      var p = num($('p').value), r = num($('r').value) / 100, y = num($('y').value), k = Math.round(num($('k').value));
      var ids = ['o-fv', 'o-int', 'o-eff', 'o-simple'];
      if ([p, r, y].some(isNaN) || !(k > 0) || y <= 0) { ids.forEach(function (id) { set(id, '—'); }); return; }
      var fv = p * Math.pow(1 + r / k, k * y);
      set('o-fv', money(fv)); set('o-int', money(fv - p)); set('o-eff', pct(Math.pow(1 + r / k, k) - 1)); set('o-simple', money(p * (1 + r * y)));
      $('o-note').textContent = 'سود مرکب نسبت به سود ساده ' + money(fv - p * (1 + r * y)) + ' بیشتر می‌سازد.';
    },
    'fire': function () {
      var inc = num($('inc').value), ex = num($('ex').value), cur = num($('cur').value), r = num($('r').value) / 100, w = num($('w').value) / 100;
      var ids = ['o-target', 'o-sr', 'o-yrs'];
      if ([inc, ex, cur, r, w].some(isNaN) || w <= 0 || ex < 0 || inc <= 0) { ids.forEach(function (id) { set(id, '—'); }); return; }
      var target = ex * 12 / w, s = inc - ex, i = r / 12;
      set('o-target', fa(target) + ' میلیون تومان'); set('o-sr', pct(s / inc), s <= 0);
      if (cur >= target) { set('o-yrs', 'همین حالا'); $('o-note').textContent = 'موجودی فعلی از سرمایه‌ی هدف بیشتر است.'; return; }
      if (s <= 0 && i <= 0) { set('o-yrs', 'نمی‌رسید', true); $('o-note').textContent = 'هزینه از درآمد کمتر نیست.'; return; }
      var n = i === 0 ? (target - cur) / s : Math.log((target * i + s) / (cur * i + s)) / Math.log(1 + i);
      if (!isFinite(n) || n < 0) { set('o-yrs', 'نمی‌رسید', true); return; }
      set('o-yrs', fa(n / 12, 1) + ' سال', n / 12 > 40);
      $('o-note').textContent = 'فرض: هزینه‌ها و درآمد ثابت و بازده بعد از تورم. نرخ برداشت ۴ درصد برای افق‌های بلند محافظه‌کارانه است.';
    },
    'emergency': function () {
      var ex = num($('ex').value), m = num($('m').value), cur = num($('cur').value), s = num($('s').value);
      var ids = ['o-t', 'o-gap', 'o-cov', 'o-time'];
      if ([ex, m, cur].some(isNaN) || ex <= 0) { ids.forEach(function (id) { set(id, '—'); }); return; }
      var t = ex * m, gap = Math.max(t - cur, 0);
      set('o-t', fa(t) + ' میلیون تومان'); set('o-gap', fa(gap) + ' میلیون تومان', gap > 0); set('o-cov', fa(cur / ex, 1) + ' ماه', cur / ex < 3);
      set('o-time', gap === 0 ? 'کامل است' : (isNaN(s) || s <= 0 ? '—' : fa(gap / s, 1) + ' ماه'));
      $('o-note').textContent = 'صندوق اضطراری را جدا از سرمایه‌گذاری نگه دارید تا هنگام نیاز بدون ضرر قابل‌برداشت باشد.';
    },
    'debt-payoff': function () {
      var bal = num($('bal').value), y = num($('rate').value) / 100, pay = num($('pay').value), ex = num($('extra').value);
      var ids = ['o-n', 'o-int', 'o-min', 'o-n2', 'o-save'];
      if ([bal, y, pay].some(isNaN) || bal <= 0 || pay <= 0) { ids.forEach(function (id) { set(id, '—'); }); return; }
      var i = y / 12; if (isNaN(ex) || ex < 0) ex = 0;
      var months = function (pm) { if (i === 0) return bal / pm; if (pm <= bal * i) return Infinity; return -Math.log(1 - bal * i / pm) / Math.log(1 + i); };
      var n = months(pay), n2 = months(pay + ex);
      set('o-min', money(bal * i + 1));
      if (!isFinite(n)) { set('o-n', 'هرگز', true); set('o-int', '—'); set('o-n2', isFinite(n2) ? fa(n2, 1) + ' ماه' : 'هرگز'); set('o-save', '—'); $('o-note').textContent = 'قسط حتی سود ماهانه را پوشش نمی‌دهد.'; return; }
      var int1 = pay * n - bal, int2 = (pay + ex) * n2 - bal;
      set('o-n', fa(n, 1) + ' ماه (' + fa(n / 12, 1) + ' سال)'); set('o-int', money(int1));
      set('o-n2', ex > 0 ? fa(n2, 1) + ' ماه' : '—'); set('o-save', ex > 0 ? money(int1 - int2) : '—');
      $('o-note').textContent = 'تقریب پیوسته: ماه آخر را کامل حساب می‌کند و ممکن است چند ریال با جدول بانک فرق کند.';
    },
    'retirement': function () {
      var age = num($('age').value), ra = num($('ra').value), life = num($('life').value), exp = num($('exp').value), inf = num($('inf').value) / 100,
          r = num($('r').value) / 100, rr = num($('rr').value) / 100, cs = num($('cs').value);
      var ids = ['o-exp', 'o-corpus', 'o-m'];
      if ([age, ra, life, exp, inf, r, rr].some(isNaN) || ra <= age || life <= ra) { ids.forEach(function (id) { set(id, '—'); }); return; }
      if (isNaN(cs)) cs = 0;
      var yrs = ra - age, n = life - ra, e = exp * Math.pow(1 + inf, yrs);
      var real = (1 + rr) / (1 + inf) - 1;
      var af = real === 0 ? n : (1 - Math.pow(1 + real, -n)) / real;
      var corpus = e * 12 * af;
      var i = r / 12, N = yrs * 12, need = corpus - cs * Math.pow(1 + i, N);
      var m = need <= 0 ? 0 : (i === 0 ? need / N : need * i / (Math.pow(1 + i, N) - 1));
      set('o-exp', fa(e) + ' میلیون تومان'); set('o-corpus', fa(corpus) + ' میلیون تومان'); set('o-m', need <= 0 ? 'لازم نیست' : fa(m, 1) + ' میلیون تومان');
      $('o-note').textContent = 'اعداد به پول آینده‌اند؛ برداشت هر سال با تورم بالا می‌رود و بازده بعد از بازنشستگی باید از تورم بیشتر بماند.';
    },
    'sharpe': function () {
      var r = num($('r').value) / 100, rf = num($('rf').value) / 100, sd = num($('sd').value) / 100;
      if ([r, rf, sd].some(isNaN) || sd <= 0) { set('o-s', '—'); set('o-ex', '—'); return; }
      var s = (r - rf) / sd;
      set('o-s', fa(s, 2), s < 0); set('o-ex', pct(r - rf), r < rf);
      $('o-note').textContent = s < 0 ? 'بازده سبد از نرخ بدون ریسک کمتر بوده است.' : (s < 1 ? 'بازده به ازای ریسک ضعیف است.' : (s < 2 ? 'بازده به ازای ریسک خوب است.' : 'بازده به ازای ریسک بسیار خوب است.'));
    },
    'portfolio': function () {
      var w1 = num($('w1').value) / 100, r1 = num($('r1').value) / 100, s1 = num($('s1').value) / 100, r2 = num($('r2').value) / 100, s2 = num($('s2').value) / 100, c = num($('c').value);
      var ids = ['o-r', 'o-sd', 'o-avg', 'o-div'];
      if ([w1, r1, s1, r2, s2, c].some(isNaN) || w1 < 0 || w1 > 1 || c < -1 || c > 1) { ids.forEach(function (id) { set(id, '—'); }); return; }
      var w2 = 1 - w1, ret = w1 * r1 + w2 * r2, v = w1 * w1 * s1 * s1 + w2 * w2 * s2 * s2 + 2 * w1 * w2 * c * s1 * s2, sd = Math.sqrt(Math.max(v, 0)), avg = w1 * s1 + w2 * s2;
      set('o-r', pct(ret)); set('o-sd', pct(sd)); set('o-avg', pct(avg)); set('o-div', pct(avg - sd));
      $('o-note').textContent = 'وزن دارایی دوم ' + fa(w2 * 100, 1) + ' درصد است. همبستگی را از داده‌ی تاریخی بازده‌ها تخمین بزنید؛ در بحران‌ها معمولاً بالاتر می‌رود.';
    },
    'capm': function () {
      var rf = num($('rf').value) / 100, b = num($('beta').value), mrp = num($('mrp').value) / 100, er = num($('er').value) / 100;
      if ([rf, b, mrp].some(isNaN)) { set('o-req', '—'); set('o-alpha', '—'); return; }
      var req = rf + b * mrp;
      set('o-req', pct(req));
      if (isNaN(er)) { set('o-alpha', '—'); $('o-note').textContent = ''; return; }
      set('o-alpha', pct(er - req), er < req);
      $('o-note').textContent = er >= req ? 'بازده مورد انتظار از بازده لازم بیشتر است؛ با این فرض‌ها دارایی جذاب است.' : 'بازده مورد انتظار ریسک دارایی را جبران نمی‌کند.';
    },
    'dividend': function () {
      var p = num($('price').value), d = num($('dps').value), e = num($('eps').value);
      var ids = ['o-y', 'o-pe', 'o-ey', 'o-po'];
      if ([p, d, e].some(isNaN) || p <= 0) { ids.forEach(function (id) { set(id, '—'); }); return; }
      set('o-y', pct(d / p)); set('o-pe', e > 0 ? fa(p / e, 1) : 'سود منفی', e <= 0); set('o-ey', pct(e / p), e < 0); set('o-po', e > 0 ? pct(d / e) : '—', e > 0 && d > e);
      $('o-note').textContent = e > 0 && d > e ? 'سود نقدی از سود هر سهم بیشتر است؛ این وضعیت پایدار نیست.' : (e > 0 ? 'سود تقسیم‌نشده ' + pct(1 - d / e) + ' سود را در شرکت نگه می‌دارد.' : '');
    },
    'position-size': function () {
      var cap = num($('cap').value), risk = num($('risk').value) / 100, en = num($('entry').value), st = num($('stop').value);
      var ids = ['o-q', 'o-val', 'o-pct', 'o-loss'];
      if ([cap, risk, en, st].some(isNaN) || cap <= 0 || en <= 0 || en === st) { ids.forEach(function (id) { set(id, '—'); }); return; }
      var per = Math.abs(en - st), amt = cap * risk, q = Math.floor(amt / per), val = q * en;
      set('o-q', fa(q) + ' واحد'); set('o-val', money(val)); set('o-pct', pct(val / cap), val > cap); set('o-loss', money(q * per));
      $('o-note').textContent = val > cap ? 'ارزش معامله از سرمایه بیشتر است؛ اهرم لازم است یا حد ضرر را نزدیک‌تر بگذارید.' : 'حد ضرر باید پیش از ورود و بر اساس تحلیل تعیین شود، نه برای رسیدن به یک عدد دلخواه.';
    },
    'dca': function () {
      var cp = num($('cp').value), rows = $('lines').value.split(/\n/).map(function (l) { return l.trim().split(/[\s,،;]+/).map(num); }).filter(function (a) { return a.length >= 2 && !isNaN(a[0]) && !isNaN(a[1]) && a[0] > 0; });
      var ids = ['o-avg', 'o-u', 'o-inv', 'o-pl', 'o-simple'];
      if (!rows.length) { ids.forEach(function (id) { set(id, '—'); }); return; }
      var inv = 0, u = 0, ps = 0;
      rows.forEach(function (a) { inv += a[1]; u += a[1] / a[0]; ps += a[0]; });
      var avg = inv / u;
      set('o-avg', fa(avg, 1) + ' تومان'); set('o-u', fa(u, 2)); set('o-inv', money(inv)); set('o-simple', fa(ps / rows.length, 1) + ' تومان');
      if (isNaN(cp) || cp <= 0) { set('o-pl', '—'); $('o-note').textContent = ''; return; }
      var val = u * cp; set('o-pl', money(val - inv) + ' (' + pct(val / inv - 1) + ')', val < inv);
      $('o-note').textContent = fa(rows.length) + ' خرید ثبت شده است.';
    },
    'ytm': function () {
      var P = num($('price').value), f = num($('f').value), c = num($('c').value) / 100, n = num($('n').value), k = Math.round(num($('k').value));
      var ids = ['o-ytm', 'o-cy', 'o-gain'];
      if ([P, f, c, n].some(isNaN) || !(k > 0) || n <= 0 || P <= 0 || f <= 0) { ids.forEach(function (id) { set(id, '—'); }); return; }
      var N = Math.round(n * k), cp = f * c / k;
      var pv = function (r) { var s = 0; for (var t = 1; t <= N; t++) s += (cp + (t === N ? f : 0)) / Math.pow(1 + r, t); return s; };
      var lo = 0, hi = 5;
      if (pv(lo) < P) { ids.forEach(function (id) { set(id, '—'); }); $('o-note').textContent = 'قیمت بالاتر از جمع کل جریان‌های اوراق است؛ بازده منفی می‌شود.'; return; }
      for (var j = 0; j < 200; j++) { var mid = (lo + hi) / 2; if (pv(mid) > P) lo = mid; else hi = mid; }
      var y = (lo + hi) / 2 * k;
      set('o-ytm', pct(y)); set('o-cy', pct(f * c / P)); set('o-gain', fa(f - P, 2));
      $('o-note').textContent = P < f ? 'اوراق با تخفیف معامله می‌شود؛ بازده تا سررسید از نرخ کوپن بالاتر است.' : (P > f ? 'اوراق با صرف معامله می‌شود؛ بازده تا سررسید از نرخ کوپن پایین‌تر است.' : '');
    },
    'discounted-payback': function () {
      var r = num($('r').value) / 100, cf = $('cf').value.split(/\n|;/).map(num).filter(function (x) { return !isNaN(x); });
      var ids = ['o-dpb', 'o-pb', 'o-npv'];
      if (isNaN(r) || cf.length < 2) { ids.forEach(function (id) { set(id, '—'); }); return; }
      var pbOf = function (arr) { var cum = 0; for (var t = 0; t < arr.length; t++) { var prev = cum; cum += arr[t]; if (t > 0 && prev < 0 && cum >= 0) return t - 1 + (-prev / arr[t]); } return NaN; };
      var d = cf.map(function (c, t) { return c / Math.pow(1 + r, t); });
      var npv = d.reduce(function (s, x) { return s + x; }, 0), a = pbOf(cf), b = pbOf(d);
      set('o-dpb', isNaN(b) ? 'در این دوره برنمی‌گردد' : fa(b, 1) + ' سال', isNaN(b)); set('o-pb', isNaN(a) ? 'در این دوره برنمی‌گردد' : fa(a, 1) + ' سال', isNaN(a)); set('o-npv', fa(npv, 1), npv < 0);
      $('o-note').textContent = npv < 0 ? 'NPV منفی است؛ پروژه در این نرخ تنزیل ارزش نمی‌سازد.' : 'پروژه سرمایه را با بازده بیش از نرخ تنزیل برمی‌گرداند.';
    },
    'dfl': function () {
      var ebit = num($('ebit').value), i = num($('int').value), pref = num($('pref').value), t = num($('t').value) / 100;
      var ids = ['o-dfl', 'o-chg', 'o-cov'];
      if ([ebit, i].some(isNaN) || ebit <= 0) { ids.forEach(function (id) { set(id, '—'); }); return; }
      if (isNaN(pref)) pref = 0; if (isNaN(t) || t < 0 || t >= 1) t = 0;
      var base = ebit - i - pref / (1 - t);
      if (base <= 0) { ids.forEach(function (id) { set(id, '—'); }); $('o-note').textContent = 'سود قبل از مالیات پس از بهره و سود ممتاز صفر یا منفی است.'; return; }
      var dfl = ebit / base;
      set('o-dfl', fa(dfl, 2), dfl > 2); set('o-chg', fa(dfl * 10, 1) + ' درصد'); set('o-cov', i > 0 ? fa(ebit / i, 1) + ' بار' : '—');
      $('o-note').textContent = dfl > 2 ? 'اهرم مالی بالاست؛ افت سود عملیاتی با شدت بیشتری به سهامداران می‌رسد.' : '';
    },
    'sgr': function () {
      var roe = num($('roe').value) / 100, po = num($('po').value) / 100;
      var ids = ['o-sgr', 'o-b', 'o-simple'];
      if ([roe, po].some(isNaN) || po < 0 || po > 1) { ids.forEach(function (id) { set(id, '—'); }); return; }
      var b = 1 - po, x = roe * b;
      if (x >= 1) { ids.forEach(function (id) { set(id, '—'); }); $('o-note').textContent = 'ROE × b باید کمتر از ۱ باشد.'; return; }
      set('o-sgr', pct(x / (1 - x)), x < 0); set('o-b', pct(b)); set('o-simple', pct(x), x < 0);
      $('o-note').textContent = 'اگر فروش سریع‌تر از ' + pct(x / (1 - x)) + ' رشد کند، تأمین مالی بیرونی یا افزایش حاشیه سود لازم است.';
    },
    'depreciation': function () {
      var cost = num($('cost').value), sal = num($('sal').value), n = Math.round(num($('n').value)), y = Math.round(num($('y').value));
      var ids = ['o-sl', 'o-ddb', 'o-syd', 'o-bv'];
      if ([cost, sal].some(isNaN) || !(n > 0) || !(y >= 1) || y > n || sal > cost) { ids.forEach(function (id) { set(id, '—'); }); return; }
      var sl = (cost - sal) / n, syd = (cost - sal) * (n - y + 1) / (n * (n + 1) / 2);
      var bv = cost, dep = 0, bvs = [];
      for (var t = 1; t <= y; t++) { dep = Math.min(bv * 2 / n, Math.max(bv - sal, 0)); bv -= dep; }
      var f = function (x) { return fa(x, 1) + ' میلیون تومان'; };
      set('o-sl', f(sl)); set('o-ddb', f(dep)); set('o-syd', f(syd));
      set('o-bv', fa(cost - sl * y, 1) + ' / ' + fa(bv, 1));
      $('o-note').textContent = 'روش‌های شتابان در سال‌های اول استهلاک بیشتر ثبت می‌کنند و سود حسابداری را زودتر کاهش می‌دهند؛ جمع کل استهلاک در پایان عمر برابر است.';
    },
    'markup-margin': function () {
      var c = num($('cost').value), mk = num($('mk').value) / 100, tm = num($('tm').value) / 100;
      var ids = ['o-price', 'o-m', 'o-req', 'o-tp'];
      if (isNaN(c) || c <= 0) { ids.forEach(function (id) { set(id, '—'); }); return; }
      if (isNaN(mk)) { set('o-price', '—'); set('o-m', '—'); } else { set('o-price', money(c * (1 + mk))); set('o-m', pct(mk / (1 + mk))); }
      if (isNaN(tm) || tm <= 0 || tm >= 1) { set('o-req', '—'); set('o-tp', '—'); } else { set('o-req', pct(tm / (1 - tm))); set('o-tp', money(c / (1 - tm))); }
      $('o-note').textContent = 'قیمت با حاشیه‌ی هدف را می‌توان به‌صورت بها ÷ (۱ − حاشیه) نوشت.';
    },
    'unit-economics': function () {
      var arpu = num($('arpu').value), gm = num($('gm').value) / 100, cac = num($('cac').value), ch = num($('ch').value) / 100;
      var ids = ['o-ltv', 'o-ratio', 'o-pb', 'o-life'];
      if ([arpu, gm, cac, ch].some(isNaN) || arpu <= 0 || gm <= 0 || ch <= 0 || cac <= 0) { ids.forEach(function (id) { set(id, '—'); }); return; }
      var life = 1 / ch, margin = arpu * gm, ltv = margin * life, pb = cac / margin;
      set('o-ltv', money(ltv)); set('o-ratio', fa(ltv / cac, 1) + ' برابر', ltv / cac < 3); set('o-pb', fa(pb, 1) + ' ماه', pb > 12); set('o-life', fa(life, 1) + ' ماه');
      $('o-note').textContent = ltv / cac < 3 ? 'نسبت LTV به CAC کمتر از ۳ است؛ یا باید جذب ارزان‌تر یا ریزش کمتر شود.' : 'نسبت LTV به CAC در محدوده‌ی سالم است.';
    },
    'saas-metrics': function () {
      var m0 = num($('m0').value), nw = num($('nw').value), ex = num($('ex').value), co = num($('co').value), ch = num($('chn').value);
      var ids = ['o-nrr', 'o-grr', 'o-end', 'o-arr', 'o-g'];
      if ([m0, ex, co, ch].some(isNaN) || m0 <= 0) { ids.forEach(function (id) { set(id, '—'); }); return; }
      if (isNaN(nw)) nw = 0;
      var nrr = (m0 + ex - co - ch) / m0, grr = (m0 - co - ch) / m0, end = m0 + nw + ex - co - ch;
      set('o-nrr', pct(nrr), nrr < 1); set('o-grr', pct(grr), grr < 0.9); set('o-end', fa(end, 1) + ' میلیون تومان'); set('o-arr', fa(end * 12, 1) + ' میلیون تومان'); set('o-g', pct(end / m0 - 1), end < m0);
      $('o-note').textContent = nrr >= 1 ? 'NRR بالای ۱۰۰ درصد است؛ حتی بدون مشتری جدید درآمد رشد می‌کند.' : 'NRR زیر ۱۰۰ درصد است؛ رشد فقط با جذب مشتری جدید ممکن است.';
    },
    'eva': function () {
      var n = num($('nopat').value), ic = num($('ic').value), w = num($('w').value) / 100;
      var ids = ['o-eva', 'o-roic', 'o-sp'];
      if ([n, ic, w].some(isNaN) || ic <= 0) { ids.forEach(function (id) { set(id, '—'); }); return; }
      var roic = n / ic, eva = n - w * ic;
      set('o-eva', fa(eva, 1) + ' میلیارد تومان', eva < 0); set('o-roic', pct(roic), roic < w); set('o-sp', pct(roic - w), roic < w);
      $('o-note').textContent = eva >= 0 ? 'بازده سرمایه از هزینه‌ی آن بیشتر است؛ رشد با این بازده ارزش می‌سازد.' : 'بازده سرمایه کمتر از هزینه‌ی آن است؛ رشد بیشتر ارزش را کم می‌کند.';
    },
    'eoq': function () {
      var d = num($('d').value), s = num($('s').value), h = num($('h').value), lt = num($('lt').value);
      var ids = ['o-q', 'o-n', 'o-tc', 'o-rop'];
      if ([d, s, h].some(isNaN) || d <= 0 || s <= 0 || h <= 0) { ids.forEach(function (id) { set(id, '—'); }); return; }
      var q = Math.sqrt(2 * d * s / h), n = d / q, tc = n * s + q / 2 * h;
      set('o-q', fa(q) + ' واحد'); set('o-n', fa(n, 1) + ' بار در سال'); set('o-tc', money(tc));
      set('o-rop', isNaN(lt) ? '—' : fa(d / 365 * lt) + ' واحد');
      $('o-note').textContent = 'در EOQ هزینه‌ی سفارش‌دهی و نگهداری سالانه تقریباً برابرند (هرکدام حدود ' + money(tc / 2) + ').';
    }
  };

  var run = tools[form.getAttribute('data-tool')];
  form.addEventListener('input', run);
  run();
})();
