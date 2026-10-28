(function () {
  var KEY = "veckolista-v2";
  var DAYS = ["MÅNDAG","TISDAG","ONSDAG","TORSDAG","FREDAG","LÖRDAG","SÖNDAG"];
  var LET = ["M","T","O","T","F","L","S"];
  var MON = ["JAN","FEB","MAR","APR","MAJ","JUN","JUL","AUG","SEP","OKT","NOV","DEC"];
  var MONTHS = ["JANUARI","FEBRUARI","MARS","APRIL","MAJ","JUNI","JULI","AUGUSTI","SEPTEMBER","OKTOBER","NOVEMBER","DECEMBER"];
  var MAXDOTS = 6;
  var CLOCK = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6.5"/><path d="M8 4.5V8l2.5 1.5"/></svg>';
  var BELL = '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-label="Påminnelse"><path d="M3 12h10l-1.2-2V7a3.8 3.8 0 0 0-7.6 0v3z"/><path d="M6.5 14h3"/></svg>';
  var SUGG = ["Handla mat", "Träning", "Läs 10 sidor"];

  function $(id) { return document.getElementById(id); }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function key(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function mondayOf(d) { return addDays(d, -((d.getDay() + 6) % 7)); }
  function fromKey(k) { return new Date(k + "T12:00:00"); }
  function isoWeek(date) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    var w1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - w1) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7);
  }
  /* "Ring tandläkaren 14:30" or "Träning kl 7" -> title + time. Only a trailing time counts. */
  var TIME_RE = /\s*(?:\bkl\.?\s*([01]?\d|2[0-3])(?:[:.]([0-5]\d))?|\b([01]?\d|2[0-3]):([0-5]\d))\s*$/i;
  function parseTime(s) {
    var m = TIME_RE.exec(s), t = m ? s.slice(0, m.index).trim() : "";
    if (!m || !t) return { t: s.trim(), time: "" };
    return { t: t, time: pad(+(m[1] || m[3])) + ":" + (m[2] || m[4] || "00") };
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  var today = new Date(), todayKey = key(today);
  var state = { users: {}, session: null, theme: "system" };
  var weekStart = mondayOf(today), openKey = todayKey, focusKey = null, pulseId = null, flashKey = null;
  /* a short tick where the device can vibrate; silent elsewhere */
  function buzz(p) { try { if (navigator.vibrate && !(reduceMq && reduceMq.matches)) navigator.vibrate(p); } catch (e) {} }
  var reduceMq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function scrollOpenDay() { var o = document.querySelector(".day.open"); if (o) o.scrollIntoView({ block: "nearest", behavior: reduceMq && reduceMq.matches ? "auto" : "smooth" }); }

  /* ---------- storage ---------- */
  function load() {
    try { var raw = localStorage.getItem(KEY); if (raw) { var s = JSON.parse(raw); if (s && s.users) state = s; } } catch (e) {}
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function cur() { return (state.session && state.users[state.session]) || null; }
  function allTasks() { var u = cur(); return u ? u.tasks : {}; }
  function list(k) { return allTasks()[k] || []; }
  function totalTasks() { var n = 0, t = allTasks(); for (var k in t) n += t[k].length; return n; }
  function push(k, t) { var all = allTasks(); (all[k] = all[k] || []).push(t); }

  async function hash(pw, email) {
    try {
      var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("vl:" + email + ":" + pw));
      return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
    } catch (e) { return "x" + btoa(unescape(encodeURIComponent(email + pw))); }
  }
  function seedTasks(t) {
    var m = mondayOf(new Date());
    function put(off, text, done) { var k = key(addDays(m, off)); (t[k] = t[k] || []).push({ id: uid(), t: text, d: !!done }); }
    put(0, "Skicka offert till kund", true); put(0, "Läs 10 sidor", false); put(0, "Handla mat", false); put(0, "Skissa onboarding-flödet", false);
    put(1, "Designa startskärmen", false); put(1, "Ring bankärendet", false); put(2, "Träning", false); put(4, "Planera nästa vecka", false);
  }
  async function ensureDemo() {
    var em = "yazan@epost.se";
    if (state.users[em]) return;
    var h = await hash("veckolista1", em), t = {};
    seedTasks(t);
    state.users[em] = { name: "Yazan Alhom", hash: h, tasks: t };
    save();
  }

  /* ---------- theme, toast, screens ---------- */
  /* UI settings live in their own key, apart from the account data */
  var SKEY = "veckolista-settings", ACC = { orange: "ORANGE", red: "RÖD", blue: "BLÅ", mono: "MONO" };
  var settings = { theme: "system", accent: "orange", remind: true, defTime: "09:00" };
  function loadSettings() {
    try {
      var s = JSON.parse(localStorage.getItem(SKEY));
      if (s) { for (var k in settings) if (k in s) settings[k] = s[k]; }
      else if (state.theme) settings.theme = state.theme;
    } catch (e) {}
  }
  function saveSettings() { try { localStorage.setItem(SKEY, JSON.stringify(settings)); } catch (e) {} }
  var darkMq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  function isDark() { return settings.theme === "dark" || (settings.theme === "system" && !!darkMq && darkMq.matches); }
  function applyTheme() {
    var r = document.documentElement;
    if (settings.theme === "system") r.removeAttribute("data-theme"); else r.setAttribute("data-theme", settings.theme);
    if (settings.accent === "orange") r.removeAttribute("data-accent"); else r.setAttribute("data-accent", settings.accent);
    r.toggleAttribute("data-norem", !settings.remind);
    var label = isDark() ? "MÖRK" : "LJUS";
    Array.prototype.forEach.call(document.querySelectorAll(".themebtn"), function (b) { b.textContent = label; b.setAttribute("aria-label", "Tema: " + label.toLowerCase() + ". Tryck för att byta"); });
    if (!$("settings").hidden) renderSettings();
  }
  if (darkMq && darkMq.addEventListener) darkMq.addEventListener("change", applyTheme);
  Array.prototype.forEach.call(document.querySelectorAll(".themebtn"), function (b) {
    b.onclick = function () { settings.theme = isDark() ? "light" : "dark"; applyTheme(); saveSettings(); };
  });
  var toastT = null;
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 2400);
  }
  function show(name) {
    ["welcome", "login", "signup"].forEach(function (s) { $("s-" + s).hidden = s !== name; });
    if (name !== "home") { $("s-over").hidden = true; $("s-home").hidden = true; $("s-add").hidden = true; document.body.classList.remove("adding"); setTabsVisible(false); }
    window.scrollTo(0, 0);
    if (name === "welcome") renderWelcome();
    if (name === "home") { enterHome(); setTab("over"); }
    if (name === "login") { $("li-err").textContent = ""; $("li-f1").classList.remove("bad"); $("li-f2").classList.remove("bad"); }
    if (name === "signup") { $("su-err").textContent = ""; ["su-f1", "su-f2", "su-f3"].forEach(function (i) { $(i).classList.remove("bad"); }); }
  }
  /* ---------- tabs ---------- */
  var tab = "over";
  function setTabsVisible(v) { $("tabbar").hidden = !v; document.querySelector(".tabfade").hidden = !v; }
  function setTab(name) {
    var changed = name !== tab || $("tabbar").hidden || !$("s-add").hidden;
    tab = name;
    $("s-add").hidden = true; document.body.classList.remove("adding");
    var over = name === "over", scr = $(over ? "s-over" : "s-home");
    $("s-over").hidden = !over; $("s-home").hidden = over;
    setTabsVisible(true);
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (b) {
      var on = b.getAttribute("data-tab") === name;
      b.classList.toggle("on", on);
      if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    if (changed) { window.scrollTo(0, 0); scr.classList.remove("tabin"); void scr.offsetWidth; scr.classList.add("tabin"); }
    if (over) renderOver(); else render();
  }

  /* ---------- översikt ---------- */
  var QUOTES = [
    "Det räcker att börja. Resten kommer.",
    "En liten uppgift i taget.",
    "Gör det enkla först.",
    "Lugn och framåt.",
    "Idag är en bra dag att börja.",
    "Små steg räknas också.",
    "Planera lite, gör lite mer.",
    "Det viktiga får plats i dag.",
    "Färdigt är bättre än perfekt.",
    "Ta en sak åt gången."
  ];
  function dayOfYear(d) { return Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(d.getFullYear(), 0, 0)) / 864e5); }
  function plural(n) { return n + (n === 1 ? " UPPGIFT" : " UPPGIFTER"); }
  function dotsHtml(ts, cls) {
    var h = "";
    ts.slice(0, MAXDOTS).forEach(function (t) { h += '<i class="' + cls(t) + '"></i>'; });
    return h;
  }
  function renderOver() {
    var u = cur(); if (!u) return;
    var now = new Date(), nk = key(now), idx = (now.getDay() + 6) % 7, hr = now.getHours();
    var ms = mondayOf(now), i;
    $("o-greet").textContent = hr < 10 ? "GOD MORGON" : hr < 18 ? "GOD DAG" : "GOD KVÄLL";
    $("o-name").textContent = u.name.split(" ")[0].toUpperCase();
    var dl = DAYS[idx] + " · " + now.getDate() + " " + MON[now.getMonth()];
    $("o-date").textContent = dl + " · VECKA " + isoWeek(now);
    $("o-quote").textContent = QUOTES[dayOfYear(now) % QUOTES.length];
    $("o-quote-d").textContent = now.getDate() + " " + MON[now.getMonth()] + " · NYTT VARJE DAG";

    var ts = list(nk), dn = ts.filter(function (t) { return t.d; }).length, n = ts.length, left = n - dn;
    var box = $("o-idag"), st = !n ? "empty" : left ? "tasks" : "done";
    box.className = "tile idag " + st;
    $("o-done").textContent = dn;
    $("o-of").textContent = "/ " + n + " KLARA";
    $("o-right").textContent = st === "done" ? "ALLT KLART" : left + " KVAR";
    $("o-add").hidden = st === "empty";
    $("o-plan").hidden = st !== "empty";
    $("o-right").hidden = st === "empty";
    $("o-dots").innerHTML = st === "empty" ? "<i class=\"ring\"></i><i class=\"ring\"></i><i class=\"ring\"></i><i class=\"ring\"></i>"
      : dotsHtml(ts, function (t) { return st === "tasks" && t.d ? "fin" : "rem"; });

    $("o-wknum").textContent = pad(isoWeek(now));
    var me = addDays(ms, 6);
    $("o-range").textContent = ms.getDate() + " " + MON[ms.getMonth()] + " – " + me.getDate() + " " + MON[me.getMonth()];

    var hm = pad(hr) + ":" + pad(now.getMinutes()), timed = sorted(ts).filter(function (t) { return !t.d && t.time; });
    var nx = timed.filter(function (t) { return t.time >= hm; })[0] || timed[0], a, b, c;
    if (nx) { a = nx.t; b = "IDAG · " + nx.time; c = settings.remind ? "MED PÅMINNELSE" : "PÅMINNELSER AV"; }
    else if (n && !left) {
      var nd = null;
      for (i = 1; i < 7 && !nd; i++) { var dk = addDays(now, i), rem = list(key(dk)).filter(function (t) { return !t.d; }).length; if (rem) nd = { d: dk, n: rem }; }
      a = "INGET MER"; b = nd ? "NÄSTA: " + DAYS[(nd.d.getDay() + 6) % 7] : "NÄSTA: INGET PLANERAT"; c = nd ? plural(nd.n) : "NJUT AV DAGEN";
    } else { a = "INGET ÄNNU"; b = "ÄNNU INGEN TID"; c = "TID = PÅMINNELSE"; }
    $("o-n1").textContent = a; $("o-n2").textContent = b; $("o-n3").textContent = c;

    var tot = 0, tdn = 0, mh = "", streak = 0, dates = [];
    for (i = 0; i < 7; i++) {
      var d = addDays(ms, i), k = key(d), wt = list(k), wd = wt.filter(function (t) { return t.d; }).length, isT = k === nk;
      tot += wt.length; tdn += wd; dates.push(wt);
      var dh = "";
      if (!wt.length) dh = '<i class="dot ring"></i>';
      else dh = dotsHtml(wt, function (t) { return "dot" + (t.d ? " done" : ""); }) + (wt.length > MAXDOTS ? '<span class="more">+' + (wt.length - MAXDOTS) + "</span>" : "");
      mh += '<span class="mcol' + (isT ? " today" : "") + '"><span class="l">' + LET[i] + "</span>" + dh + "</span>";
    }
    $("o-matrix").innerHTML = mh;
    $("o-wsum").textContent = tdn + " / " + tot + " KLARA";
    for (i = idx; i >= 0; i--) {
      var w = dates[i], full = w.length && w.every(function (t) { return t.d; });
      if (full) streak++; else if (i !== idx) break;
    }
    $("o-streak").textContent = streak ? "SERIE: " + streak + (streak === 1 ? " DAG" : " DAGAR") : "INGEN SERIE ÄNNU";
  }
  function goPlanToday(addFocus) {
    var now = new Date(); todayKey = key(now); weekStart = mondayOf(now); openKey = todayKey;
    if (addFocus) focusKey = todayKey;
    setTab("plan");
  }
  Array.prototype.forEach.call(document.querySelectorAll("[data-plan]"), function (b) { b.onclick = function () { goPlanToday(false); }; });
  $("o-add").onclick = function () { openAdd(key(new Date()), "over"); };
  $("o-plan").onclick = function () { openAdd(key(new Date()), "over"); };
  Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (b) {
    b.onclick = function () { setTab(b.getAttribute("data-tab")); };
  });

  Array.prototype.forEach.call(document.querySelectorAll("[data-go]"), function (b) { b.onclick = function () { show(b.getAttribute("data-go")); }; });
  $("wl-login").onclick = function () { show("login"); };
  $("wl-signup").onclick = function () { show("signup"); };

  function renderWelcome() {
    var t = new Date(), idx = (t.getDay() + 6) % 7, h = "";
    $("wl-num").textContent = pad(isoWeek(t));
    for (var i = 0; i < 7; i++) h += '<i class="' + (i < idx ? "on" : i === idx ? "now" : "") + '"></i>';
    $("wl-dots").innerHTML = h;
  }

  /* ---------- auth ---------- */
  Array.prototype.forEach.call(document.querySelectorAll("[data-show]"), function (b) {
    b.onclick = function () {
      var inp = $(b.getAttribute("data-show")), vis = inp.type === "password";
      inp.type = vis ? "text" : "password"; b.textContent = vis ? "DÖLJ" : "VISA";
    };
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-social]"), function (b) {
    b.onclick = function () { toast(b.getAttribute("data-social").toUpperCase() + " ÄR INTE KOPPLAT I DEMON ÄN"); };
  });
  $("li-forgot").onclick = function () { toast("ÅTERSTÄLLNING ÄR INTE KOPPLAD I DEMON ÄN"); };
  $("li-demo").onclick = function () { $("li-email").value = "yazan@epost.se"; $("li-pw").value = "veckolista1"; $("li-err").textContent = ""; toast("DEMOKONTO IFYLLT. TRYCK LOGGA IN"); };
  var EMAIL_RE = /^\S+@\S+\.\S+$/;

  $("f-login").addEventListener("submit", async function (e) {
    e.preventDefault();
    var em = $("li-email").value.trim().toLowerCase(), pw = $("li-pw").value, err = $("li-err");
    $("li-f1").classList.remove("bad"); $("li-f2").classList.remove("bad"); err.textContent = "";
    if (!em || !pw) { err.textContent = "FYLL I E-POST OCH LÖSENORD"; (em ? $("li-f2") : $("li-f1")).classList.add("bad"); return; }
    if (!EMAIL_RE.test(em)) { err.textContent = "E-POSTEN VERKAR INTE RÄTT"; $("li-f1").classList.add("bad"); return; }
    await ensureDemo();
    var u = state.users[em];
    if (!u) { err.textContent = "INGEN ANVÄNDARE MED DEN E-POSTEN. SKAPA KONTO?"; $("li-f1").classList.add("bad"); return; }
    if ((await hash(pw, em)) !== u.hash) { err.textContent = "FEL LÖSENORD. FÖRSÖK IGEN"; $("li-f2").classList.add("bad"); return; }
    state.session = em; save(); $("li-pw").value = ""; show("home");
  });

  function strength(pw) {
    var s = 0;
    if (pw.length >= 8) s++;
    if (pw.length >= 12) s++;
    if (/[a-zåäö]/.test(pw) && /[A-ZÅÄÖ]/.test(pw)) s++;
    if (/\d/.test(pw) && /[^A-Za-z0-9åäöÅÄÖ]/.test(pw)) s++;
    return pw.length < 8 ? Math.min(s, 0) : Math.max(s, 1);
  }
  $("su-pw").addEventListener("input", function () {
    var pw = $("su-pw").value, s = strength(pw), dots = $("su-str").querySelectorAll("i");
    for (var i = 0; i < 4; i++) dots[i].className = i < s ? "on" : "";
    $("su-strl").textContent = pw.length < 8 ? "MIN. 8 TECKEN" : ["", "SVAGT", "OK", "BRA", "STARKT"][s];
  });
  $("f-signup").addEventListener("submit", async function (e) {
    e.preventDefault();
    var nm = $("su-name").value.trim(), em = $("su-email").value.trim().toLowerCase(), pw = $("su-pw").value, err = $("su-err");
    ["su-f1", "su-f2", "su-f3"].forEach(function (i) { $(i).classList.remove("bad"); }); err.textContent = "";
    if (!nm) { err.textContent = "SKRIV ETT NAMN"; $("su-f1").classList.add("bad"); return; }
    if (!EMAIL_RE.test(em)) { err.textContent = "E-POSTEN VERKAR INTE RÄTT"; $("su-f2").classList.add("bad"); return; }
    await ensureDemo();
    if (state.users[em]) { err.textContent = "DEN E-POSTEN HAR REDAN ETT KONTO. LOGGA IN?"; $("su-f2").classList.add("bad"); return; }
    if (pw.length < 8) { err.textContent = "LÖSENORDET MÅSTE VARA MINST 8 TECKEN"; $("su-f3").classList.add("bad"); return; }
    state.users[em] = { name: nm, hash: await hash(pw, em), tasks: {} };
    state.session = em; save();
    $("su-name").value = ""; $("su-email").value = ""; $("su-pw").value = "";
    $("su-str").querySelectorAll("i").forEach(function (i) { i.className = ""; });
    show("home");
    toast("KONTO SKAPAT. VÄLKOMMEN, " + nm.split(" ")[0].toUpperCase());
  });

  /* ---------- home ---------- */
  function enterHome() {
    today = new Date(); todayKey = key(today);
    weekStart = mondayOf(today); openKey = firstMissedOr(todayKey);
    var u = cur();
    $("over-prof").textContent = u ? u.name.charAt(0).toUpperCase() : "?";
    render();
  }
  function sorted(ts) {
    return ts.slice().sort(function (a, b) {
      if (a.time && b.time) return a.time < b.time ? -1 : a.time > b.time ? 1 : 0;
      return a.time ? -1 : b.time ? 1 : 0;
    });
  }
  function firstMissedOr(k) {
    var nowK = key(new Date()), m = mondayOf(new Date());
    for (var i = 0; i < 7; i++) { var dk = key(addDays(m, i)); if (dk >= nowK) break; if (list(dk).some(function (t) { return !t.d; })) return dk; }
    return k;
  }
  function weekKind() { var cm = key(mondayOf(new Date())), w = key(weekStart); return w < cm ? -1 : w > cm ? 1 : 0; }
  function render() {
    var u = cur(); if (!u) return;
    var dates = [], i, kind = weekKind(), past = kind < 0, future = kind > 0, nowD = new Date(), nowK = key(nowD), ydK = key(addDays(nowD, -1));
    var ahead = Math.round((weekStart - mondayOf(nowD)) / (7 * 864e5));
    $("today").classList.toggle("on", kind !== 0);
    for (i = 0; i < 7; i++) dates.push(addDays(weekStart, i));
    $("wknum").textContent = pad(isoWeek(weekStart));
    var a = dates[0], b = dates[6];
    $("range").textContent = a.getDate() + " " + MON[a.getMonth()] + " – " + b.getDate() + " " + MON[b.getMonth()] + " " + addDays(weekStart, 3).getFullYear();
    var none = totalTasks() === 0, head = !past && (future || none);
    $("hello").hidden = !head; $("range").hidden = head;
    if (future) { $("hello-n").innerHTML = (ahead === 1 ? "NÄSTA VECKA" : "OM " + ahead + " VECKOR") + "<em>!</em>"; $("hello-s").textContent = "PLANERA I FÖRTID"; }
    else if (none) { $("hello-n").innerHTML = "HEJ " + esc(u.name.split(" ")[0].toUpperCase()) + "<em>!</em>"; $("hello-s").textContent = "DIN FÖRSTA VECKA BÖRJAR HÄR"; }

    var total = 0, done = 0, missed = 0, mh = "", dh = "";
    dates.forEach(function (d, idx) {
      var k = key(d), ts = list(k), isToday = k === nowK, dayMiss = kind === 0 && k < nowK, mn = 0;
      total += ts.length;
      if (dayMiss) ts.forEach(function (t) { if (!t.d) mn++; });
      missed += mn;
      ts.forEach(function (t) { if (t.d) done++; });
      var dots = "";
      if (!ts.length) dots = '<span class="dot ring"></span>';
      else {
        ts.slice(0, MAXDOTS).forEach(function (t) { dots += '<span class="dot' + (t.d ? " done" : "") + (t.id === pulseId ? " pulse" : "") + '"></span>'; });
        if (ts.length > MAXDOTS) dots += '<span class="more">+' + (ts.length - MAXDOTS) + "</span>";
      }
      mh += '<button class="mcol' + (k === openKey ? " on" : "") + (k === flashKey ? " flash" : "") + (k === openKey || (future && idx === 0) ? " sel" : "") + '" data-pick="' + k + '" aria-label="' + DAYS[idx] + '"><span class="l">' + LET[idx] + "</span>" + dots + "</button>";

      var open = k === openKey, dn = ts.filter(function (t) { return t.d; }).length;
      var meta = (isToday ? '<span class="now">IDAG</span> · ' : k === ydK && kind === 0 ? "IGÅR · " : "") + d.getDate() + " " + MON[d.getMonth()] + (mn && !open ? ' · <span class="miss">' + mn + " MISSADE</span>" : ts.length ? " · " + dn + "/" + ts.length : "");
      dh += '<div class="day' + (open ? " open" : "") + (k === flashKey ? " flash" : "") + '"><button class="dayhead" data-head="' + k + '" aria-expanded="' + open + '"><span class="name">' + DAYS[idx] + '</span><span class="meta">' + meta + "</span></button>";
      if (open) {
        var allDone = ts.length > 0 && dn === ts.length;
        if (mn) dh += '<div class="missbar">' + mn + " MISSADE · TRYCK → FÖR ATT FLYTTA TILL IDAG</div>";
        if (allDone && !past) dh += '<div class="allclear"><div class="ac-n">0</div><div class="ac-t"><b>ALLT</b><b class="a">KLART</b></div></div><div class="ac-cap">0 KVAR · ' + dn + " / " + ts.length + " KLARA</div>";
        dh += '<ul class="tasks">';
        sorted(ts).forEach(function (t) {
          var ms = dayMiss && !t.d;
          dh += '<li class="task' + (t.d ? " done" : "") + (t.d && t.id === pulseId ? " just" : "") + (ms ? " missed" : "") + '" data-id="' + t.id + '" data-k="' + k + '">' +
            '<button class="chk' + (t.id === pulseId ? " pulse" : "") + '" data-act="tog" aria-label="Klar: ' + esc(t.t) + '" aria-pressed="' + t.d + '"' + (past ? " disabled" : "") + "></button>" +
            '<span class="txt">' + (t.time ? '<span class="tm">' + esc(t.time) + BELL + "</span>" : "") + '<span class="tt">' + esc(t.t) + "</span></span>" +
            (past ? "" : '<button class="act' + (ms ? " mvm" : "") + '" data-act="mv" aria-label="' + (ms ? "Flytta till idag" : "Flytta till nästa dag") + '" title="' + (ms ? "Flytta till idag" : "Flytta till nästa dag") + '">→</button>' +
            '<button class="act" data-act="del" aria-label="Ta bort" title="Ta bort">×</button>' +
            '<button class="swdel" data-act="del" aria-label="Ta bort" tabindex="-1">×</button>') + "</li>";
        });
        dh += "</ul>";
        if (past) {
          if (!ts.length) dh += '<div class="note">INGET PLANERAT</div>';
          dh += '<div class="rofoot">SKRIVSKYDDAD · VECKAN ÄR AVSLUTAD</div></div>';
          return;
        }
        if (!ts.length) {
          dh += '<div class="ghosts"><div class="ghost" style="opacity:.75"><i></i><b style="width:130px"></b></div><div class="ghost" style="opacity:.45"><i></i><b style="width:90px"></b></div><div class="ghost" style="opacity:.25"><i></i><b style="width:150px"></b></div></div>';
          dh += '<div class="note">INGET PLANERAT ÄNNU</div><div class="sugg"><span class="sl">KOM IGÅNG MED ETT FÖRSLAG</span><div class="chips">';
          SUGG.forEach(function (s) { dh += '<button class="chip" data-sug="' + esc(s) + '" data-k="' + k + '">+ ' + esc(s) + "</button>"; });
          dh += "</div></div>";
        }
        dh += '<form class="add' + (none ? " first" : "") + '" data-k="' + k + '"' + (none ? "" : ' style="margin-top:' + (ts.length ? "2px" : "14px") + '"') + '><input id="add-' + k + '" type="text" autocomplete="off" placeholder="' + (none ? "Första uppgiften..." : "Lägg till en uppgift...") + '" maxlength="140"><button class="opt" type="button" data-opt="' + k + '" aria-label="Tid, påminnelse och upprepning" title="Tid, påminnelse och upprepning">' + CLOCK + '</button><button class="go" type="submit" aria-label="Lägg till">+</button></form>';
        if (none) dh += '<div class="addhint">↑ BÖRJA HÄR. KLOCKAN = PÅMINNELSE</div>';
        dh += '<div class="opts" id="opts-' + k + '" hidden><span class="sl" style="margin:0">TID = PÅMINNELSE</span><div class="chips">' + ["INGEN", "09:00", "12:00", "17:00"].map(function (x) { return '<button type="button" class="chip" data-pt="' + x + '" data-k="' + k + '">' + x + '</button>'; }).join("") + '</div><div class="optrow"><input class="tinp" type="time" id="tm-' + k + '" data-k="' + k + '" aria-label="Egen tid"></div></div>';
        if (dn) dh += '<button class="clear" data-clear="' + k + '">RENSA KLARA</button>';
        if (allDone) {
          if (idx < 6) {
            var nk = key(dates[idx + 1]), left = list(nk).filter(function (t) { return !t.d; }).length;
            dh += '<button class="nextbtn" data-goto="' + nk + '"><span>NÄSTA: ' + DAYS[idx + 1] + " · " + (left ? left + (left === 1 ? " UPPGIFT" : " UPPGIFTER") : "INGET PLANERAT") + '</span><span aria-hidden="true">→</span></button>';
          } else dh += '<button class="nextbtn" data-nextweek="1"><span>NÄSTA VECKA · V' + pad(isoWeek(addDays(weekStart, 7))) + '</span><span aria-hidden="true">→</span></button>';
        }
      }
      dh += "</div>";
    });
    $("matrix").innerHTML = mh;
    $("days").innerHTML = dh;
    var rt = past ? '<span class="fin">AVSLUTAD</span>' : missed ? '<span class="miss">' + missed + " MISSADE</span>" : total ? "<span>" + (total - done) + " KVAR</span>" : "<span>TOM VECKA</span>";
    $("sum").innerHTML = "<span><b>" + done + " / " + total + "</b> KLARA</span>" + rt;
    if (focusKey) { var inp = $("add-" + focusKey); if (inp) inp.focus(); focusKey = null; }
    pulseId = null; flashKey = null;
  }

  function setWeek(ws) {
    weekStart = ws;
    var mk = key(ws), end = key(addDays(ws, 6));
    openKey = (todayKey >= mk && todayKey <= end) ? firstMissedOr(todayKey) : mk > todayKey ? null : mk;
    render();
  }
  $("prev").onclick = function () { setWeek(addDays(weekStart, -7)); };
  $("next").onclick = function () { setWeek(addDays(weekStart, 7)); };
  $("today").onclick = function () { todayKey = key(new Date()); setWeek(mondayOf(new Date())); };

  $("matrix").addEventListener("click", function (e) {
    var b = e.target.closest("[data-pick]"); if (!b) return;
    openKey = b.getAttribute("data-pick"); render();
    scrollOpenDay();
  });

  var pend = { k: null, time: "", rem: false };
  function pendFor(k) { if (pend.k !== k) pend = { k: k, time: "", rem: false }; }
  function updatePend(k) {
    var box = $("opts-" + k); if (!box) return;
    Array.prototype.forEach.call(box.querySelectorAll("[data-pt]"), function (c) {
      var v = c.getAttribute("data-pt");
      c.classList.toggle("sel", v === (pend.time || "INGEN"));
    });
    var ti = $("tm-" + k); if (ti && ti.value !== pend.time) ti.value = pend.time;
    var ob = document.querySelector('[data-opt="' + k + '"]'); if (ob) ob.classList.toggle("on", !!pend.time);
  }
  var daysEl = $("days");
  daysEl.addEventListener("click", function (e) {
    var swl = daysEl.querySelector(".task.swiped");
    if (swl && !e.target.closest(".swdel")) { swl.classList.remove("swiped"); if (swl.contains(e.target)) return; }
    if (Date.now() < swUntil) return;
    var row = e.target.closest(".task");
    if (row && !e.target.closest("button") && weekKind() >= 0) { openEdit(row.getAttribute("data-k"), row.getAttribute("data-id")); return; }
    var h = e.target.closest("[data-head]");
    if (h) {
      var k = h.getAttribute("data-head");
      if (weekKind() > 0) { openKey = k; openAdd(k, "plan"); return; }
      openKey = openKey === k ? null : k;
      render(); return;
    }
    var op = e.target.closest("[data-opt]");
    if (op) { var ok = op.getAttribute("data-opt"), bx = $("opts-" + ok); pendFor(ok); bx.hidden = !bx.hidden; updatePend(ok); return; }
    var pt = e.target.closest("[data-pt]");
    if (pt) { var pk = pt.getAttribute("data-k"), pv = pt.getAttribute("data-pt"); pendFor(pk); pend.time = pv === "INGEN" ? "" : pv; if (!pend.time) pend.rem = false; updatePend(pk); return; }
    var c = e.target.closest("[data-clear]");
    if (c) { clearDone(c.getAttribute("data-clear")); return; }
    var sg = e.target.closest("[data-sug]");
    if (sg) { push(sg.getAttribute("data-k"), { id: uid(), t: sg.getAttribute("data-sug"), d: false }); save(); render(); return; }
    var gt = e.target.closest("[data-goto]");
    if (gt) { openKey = gt.getAttribute("data-goto"); render(); scrollOpenDay(); return; }
    if (e.target.closest("[data-nextweek]")) { setWeek(addDays(weekStart, 7)); return; }
    var btn = e.target.closest("[data-act]"); if (!btn || weekKind() < 0) return;
    var li = btn.closest(".task"), k2 = li.getAttribute("data-k"), id = li.getAttribute("data-id");
    var arr = list(k2), idx = arr.findIndex(function (t) { return t.id === id; });
    if (idx < 0) return;
    var act = btn.getAttribute("data-act");
    if (act === "del") { delTask(k2, id); return; }
    if (act === "tog") {
      arr[idx].d = !arr[idx].d; pulseId = arr[idx].d ? id : null;
      var dayDone = arr[idx].d && arr.every(function (t) { return t.d; });
      if (dayDone) flashKey = k2;
      if (arr[idx].d) buzz(dayDone ? [8, 70, 8, 70, 8] : 8);
      save(); render();
      var nc = daysEl.querySelector('.task[data-id="' + id + '"] .chk'); if (nc) nc.focus({ preventScroll: true });
      return;
    }
    if (act === "mv") moveTask(k2, id, btn.classList.contains("mvm") ? key(new Date()) : key(addDays(fromKey(k2), 1)));
  });
  daysEl.addEventListener("change", function (e) {
    var ti = e.target.closest(".tinp"); if (!ti) return;
    var k = ti.getAttribute("data-k"); pendFor(k); pend.time = ti.value; if (!pend.time) pend.rem = false; updatePend(k);
  });
  daysEl.addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target, k = f.getAttribute("data-k"), inp = f.querySelector("input");
    var p = parseTime(inp.value); if (!p.t) { openAdd(k, "plan"); return; }
    var nt = { id: uid(), t: p.t, d: false };
    if (p.time) nt.time = p.time; else if (pend.k === k && pend.time) nt.time = pend.time;
    pend = { k: null, time: "", rem: false };
    push(k, nt); save(); focusKey = k; render();
    if (nt.time) toast("TILLAGD · PÅMINNELSE " + nt.time);
  });

  /* ---------- swipe, delete, undo ---------- */
  var sw = null, swUntil = 0;
  daysEl.addEventListener("pointerdown", function (e) {
    var li = e.target.closest(".task");
    sw = li && weekKind() >= 0 && !e.target.closest(".swdel") ? { li: li, x: e.clientX, y: e.clientY } : null;
  });
  daysEl.addEventListener("pointermove", function (e) {
    if (!sw) return;
    var dx = e.clientX - sw.x, dy = e.clientY - sw.y;
    if (Math.abs(dy) > 24 && Math.abs(dy) > Math.abs(dx)) { sw = null; return; }
    if (dx < -30 || dx > 30) {
      Array.prototype.forEach.call(daysEl.querySelectorAll(".task.swiped"), function (o) { if (o !== sw.li) o.classList.remove("swiped"); });
      sw.li.classList.toggle("swiped", dx < 0); swUntil = Date.now() + 350; sw = null;
    }
  });
  ["pointerup", "pointercancel"].forEach(function (ev) { daysEl.addEventListener(ev, function () { sw = null; }); });

  /* every destructive or moving action offers ÅNGRA for 6 s; restore puts things back in place */
  var undoT = null, undoFn = null;
  function offerUndo(msg, restore) {
    undoFn = restore; $("toast").hidden = true;
    $("undo-t").textContent = msg; $("undo").hidden = false;
    clearTimeout(undoT); undoT = setTimeout(function () { $("undo").hidden = true; undoFn = null; }, 6000);
  }
  function insertAt(k, i, t) { var a = list(k); a.splice(Math.min(i, a.length), 0, t); allTasks()[k] = a; }
  function takeOut(k, id) { var a = list(k), i = a.findIndex(function (t) { return t.id === id; }); return i < 0 ? null : { i: i, t: a.splice(i, 1)[0] }; }
  function delTask(k, id) {
    var g = takeOut(k, id); if (!g) return;
    save(); render();
    offerUndo(g.t.t.toUpperCase() + " BORTTAGEN", function () { insertAt(k, g.i, g.t); });
  }
  function clearDone(k) {
    var gone = [];
    list(k).forEach(function (t, i) { if (t.d) gone.push({ i: i, t: t }); });
    allTasks()[k] = list(k).filter(function (t) { return !t.d; }); save(); render();
    offerUndo(gone.length + (gone.length === 1 ? " KLAR RENSAD" : " KLARA RENSADE"), function () { gone.forEach(function (g) { insertAt(k, g.i, g.t); }); });
  }
  function moveTask(k, id, to) {
    var g = takeOut(k, id); if (!g) return;
    push(to, g.t); pulseId = g.t.id; save(); render();
    var d = fromKey(to), other = key(mondayOf(d)) !== key(weekStart);
    offerUndo("FLYTTAD TILL " + (to === key(new Date()) ? "IDAG" : DAYS[(d.getDay() + 6) % 7]) + (other ? " · V" + isoWeek(d) : ""),
      function () { var b = takeOut(to, id); if (b) insertAt(k, g.i, b.t); });
  }
  $("undo-b").onclick = function () {
    if (!undoFn) return;
    undoFn(); undoFn = null; save(); render();
    clearTimeout(undoT); $("undo").hidden = true;
  };

  /* ---------- redigera uppgift ---------- */
  var ed = null, ED_CHIPS = ["09:00", "12:00", "18:00"];
  function openEdit(k, id) {
    var t = list(k).filter(function (x) { return x.id === id; })[0]; if (!t) return;
    ed = { k: k, id: id, day: k, time: t.time || "", done: !!t.d };
    $("ed-title").value = t.t; $("ed-done").checked = ed.done; $("ed-time").hidden = true;
    renderEdit(); $("edit").hidden = false; $("ed-title").focus();
  }
  function closeEdit() { $("edit").hidden = true; ed = null; }
  function renderEdit() {
    var d = fromKey(ed.day), m = mondayOf(d), nowK = key(new Date()), h = "", i;
    $("ed-wk").textContent = "VECKA " + isoWeek(d);
    for (i = 0; i < 7; i++) {
      var dd = addDays(m, i), dk = key(dd);
      h += '<button type="button" class="adday' + (dk === ed.day ? " sel" : "") + '" data-ed="' + dk + '" aria-pressed="' + (dk === ed.day) + '" aria-label="' + DAYS[i] + " " + dd.getDate() + " " + MON[dd.getMonth()] + '"' + (dk < nowK && dk !== ed.k ? " disabled" : "") + ">" + LET[i] + "</button>";
    }
    $("ed-days").innerHTML = h;
    var other = ed.time && ED_CHIPS.indexOf(ed.time) < 0;
    Array.prototype.forEach.call($("ed-chips").querySelectorAll("[data-et]"), function (c) {
      var v = c.getAttribute("data-et"), on = v === "other" ? !!other : v === ed.time;
      c.classList.toggle("sel", on); c.setAttribute("aria-pressed", on);
    });
    $("ed-clock").textContent = ed.time || "--:--";
    var di = (d.getDay() + 6) % 7;
    $("ed-cap").textContent = ed.time && !settings.remind ? "PÅMINNELSER AV" : ed.time ? "PÅMINNER DIG " + (ed.day === nowK ? "IDAG" : DAYS[di]) : "INGEN PÅMINNELSE";
    $("ed-cap").classList.toggle("on", !!ed.time && settings.remind);
  }
  function stepTime(min) {
    var p = (ed.time || settings.defTime).split(":"), t = ed.time ? +p[0] * 60 + +p[1] + min : +p[0] * 60 + +p[1];
    t = (Math.round(t / 15) * 15 + 1440) % 1440;
    ed.time = pad(Math.floor(t / 60)) + ":" + pad(t % 60); renderEdit();
  }
  $("ed-minus").onclick = function () { stepTime(-15); };
  $("ed-plus").onclick = function () { stepTime(15); };
  $("ed-days").addEventListener("click", function (e) {
    var b = e.target.closest("[data-ed]"); if (!b || b.disabled) return;
    ed.day = b.getAttribute("data-ed"); renderEdit();
  });
  $("ed-chips").addEventListener("click", function (e) {
    var c = e.target.closest("[data-et]"); if (!c) return;
    var v = c.getAttribute("data-et"), ti = $("ed-time");
    if (v === "other") { ti.hidden = false; ti.value = ed.time || settings.defTime; ed.time = ti.value; }
    else { ti.hidden = true; ed.time = v; }
    renderEdit();
  });
  $("ed-time").addEventListener("change", function () { ed.time = $("ed-time").value; renderEdit(); });
  $("ed-done").addEventListener("change", function () { ed.done = $("ed-done").checked; });
  $("ed-save").onclick = function () {
    var arr = list(ed.k), idx = arr.findIndex(function (t) { return t.id === ed.id; }); if (idx < 0) { closeEdit(); return; }
    var t = arr[idx], v = $("ed-title").value.trim();
    if (v) t.t = v;
    if (ed.time) t.time = ed.time; else delete t.time;
    if (ed.done && !t.d) pulseId = t.id;
    t.d = ed.done;
    if (ed.day !== ed.k) { arr.splice(idx, 1); allTasks()[ed.k] = arr; push(ed.day, t); }
    save(); closeEdit(); render();
  };
  $("ed-del").onclick = function () { var k = ed.k, id = ed.id; closeEdit(); delTask(k, id); };
  $("ed-close").onclick = closeEdit;
  $("ed-title").addEventListener("keydown", function (e) { if (e.key === "Enter") $("ed-save").click(); });
  $("edit").addEventListener("click", function (e) { if (e.target === $("edit")) closeEdit(); });

  /* sheets close on a downward swipe */
  function swipeDown(panel, close, canStart) {
    var y0 = null, dy = 0;
    panel.addEventListener("pointerdown", function (e) {
      if (e.target.closest("input, button, select, label") || (canStart && !canStart())) return;
      y0 = e.clientY; dy = 0;
    });
    panel.addEventListener("pointermove", function (e) {
      if (y0 === null) return;
      dy = Math.max(0, e.clientY - y0); panel.style.transform = dy ? "translateY(" + dy + "px)" : "";
    });
    function end() { if (y0 === null) return; y0 = null; panel.style.transform = ""; if (dy > 90) close(); dy = 0; }
    panel.addEventListener("pointerup", end); panel.addEventListener("pointercancel", end);
  }
  swipeDown(document.querySelector("#edit .panel"), closeEdit);

  /* ---------- lägg till ---------- */
  var addKey = null, addFrom = "plan", addTime = "", addOkT = null;
  function openAdd(k, from) {
    var nowK = key(new Date());
    addKey = k < nowK ? nowK : k; addFrom = from; addTime = "";
    $("s-over").hidden = true; $("s-home").hidden = true;
    var s = $("s-add"); s.hidden = false; document.body.classList.add("adding");
    setTabsVisible(true); window.scrollTo(0, 0);
    s.classList.remove("slidein"); void s.offsetWidth; s.classList.add("slidein");
    $("ad-inp").value = ""; $("ad-time").hidden = true;
    renderAdd(); $("ad-inp").focus();
  }
  function closeAdd() {
    if (addFrom === "plan") { weekStart = mondayOf(fromKey(addKey)); openKey = addKey; }
    setTab(addFrom);
  }
  function renderAdd() {
    var d = fromKey(addKey), idx = (d.getDay() + 6) % 7, nowK = key(new Date()), n = list(addKey).length, m = mondayOf(d), h = "";
    $("ad-name").textContent = DAYS[idx];
    $("ad-sub").textContent = d.getDate() + " " + MON[d.getMonth()] + " · VECKA " + isoWeek(d) + " · " + (n ? plural(n) : "INGA UPPGIFTER ÄNNU");
    $("ad-when").textContent = (addKey === nowK ? "IDAG" : d.getDate() + " " + MON[d.getMonth()]) + " · " + DAYS[idx];
    $("ad-today").classList.toggle("on", addKey !== nowK);
    addChips();
    for (var i = 0; i < 7; i++) {
      var dk = key(addDays(m, i)), dd = addDays(m, i);
      h += '<button type="button" class="adday' + (dk === addKey ? " sel" : "") + '" data-ad="' + dk + '" aria-pressed="' + (dk === addKey) + '" aria-label="' + DAYS[i] + " " + dd.getDate() + " " + MON[dd.getMonth()] + '"' + (dk < nowK ? " disabled" : "") + ">" + LET[i] + "</button>";
    }
    $("ad-days").innerHTML = h;
  }
  function addChips() {
    var at = parseTime($("ad-inp").value).time || addTime, other = at && at !== "09:00" && at !== "17:00";
    $("ad-chips").querySelector('[data-at="other"]').textContent = other ? at : "ANNAN TID";
    Array.prototype.forEach.call($("ad-chips").querySelectorAll("[data-at]"), function (c) {
      var v = c.getAttribute("data-at"), on = v === "other" ? !!other : v === at;
      c.classList.toggle("sel", on); c.setAttribute("aria-pressed", on);
    });
  }
  $("ad-back").onclick = closeAdd;
  $("ad-today").onclick = function () { addKey = key(new Date()); renderAdd(); $("ad-inp").focus(); };
  $("ad-days").addEventListener("click", function (e) {
    var b = e.target.closest("[data-ad]"); if (!b || b.disabled) return;
    addKey = b.getAttribute("data-ad"); renderAdd(); $("ad-inp").focus();
  });
  $("ad-chips").addEventListener("click", function (e) {
    var c = e.target.closest("[data-at]"); if (!c) return;
    var v = c.getAttribute("data-at"), ti = $("ad-time");
    if (v === "other") { ti.hidden = false; if (!ti.value) ti.value = settings.defTime; addTime = ti.value; }
    else { ti.hidden = true; addTime = v; }
    renderAdd();
  });
  $("ad-time").addEventListener("change", function () { addTime = $("ad-time").value; renderAdd(); });
  $("ad-inp").addEventListener("input", addChips);
  $("f-add").addEventListener("submit", function (e) {
    e.preventDefault();
    var inp = $("ad-inp"), p = parseTime(inp.value); if (!p.t) { inp.focus(); return; }
    var nt = { id: uid(), t: p.t, d: false };
    if (p.time || addTime) nt.time = p.time || addTime;
    push(addKey, nt); save(); inp.value = ""; renderAdd(); inp.focus();
    var lbl = $("ad-lbl"), sel = $("ad-days").querySelector(".sel");
    lbl.textContent = "TILLAGD" + (nt.time ? " · " + nt.time : ""); lbl.classList.add("ok");
    if (sel) sel.classList.add("pulse");
    clearTimeout(addOkT); addOkT = setTimeout(function () { lbl.textContent = "NY UPPGIFT"; lbl.classList.remove("ok"); }, 1600);
  });
  if (window.visualViewport) {
    var vv = window.visualViewport;
    var kb = function () { document.documentElement.style.setProperty("--kb", Math.max(0, window.innerHeight - vv.height - vv.offsetTop) + "px"); };
    vv.addEventListener("resize", kb); vv.addEventListener("scroll", kb);
  }

  /* ---------- inställningar ---------- */
  function renderSettings() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-set-theme]"), function (b) {
      var on = b.getAttribute("data-set-theme") === settings.theme; b.classList.toggle("on", on); b.setAttribute("aria-checked", on);
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-acc]"), function (b) {
      var on = b.getAttribute("data-acc") === settings.accent; b.classList.toggle("on", on); b.setAttribute("aria-checked", on);
    });
    $("st-acc-n").textContent = ACC[settings.accent];
    $("st-rem").setAttribute("aria-checked", settings.remind);
    $("st-def").value = settings.defTime;
  }
  function openSettings() {
    var u = cur(); if (!u) return;
    $("st-av").textContent = u.name.charAt(0).toUpperCase(); $("st-name").textContent = u.name.split(" ")[0].toUpperCase();
    $("settings").hidden = false; $("settings").scrollTop = 0; renderSettings(); $("st-close").focus();
  }
  function closeSettings() { $("settings").hidden = true; $("over-prof").focus(); }
  $("over-prof").onclick = openSettings;
  $("st-close").onclick = closeSettings;
  $("st-done").onclick = closeSettings;
  swipeDown(document.querySelector("#settings .panel"), closeSettings, function () { return $("settings").scrollTop === 0; });
  Array.prototype.forEach.call(document.querySelectorAll("[data-set-theme]"), function (b) {
    b.onclick = function () { settings.theme = b.getAttribute("data-set-theme"); applyTheme(); saveSettings(); };
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-acc]"), function (b) {
    b.onclick = function () { settings.accent = b.getAttribute("data-acc"); applyTheme(); saveSettings(); };
  });
  $("st-rem").onclick = function () { settings.remind = !settings.remind; applyTheme(); saveSettings(); renderSettings(); };
  $("st-def").addEventListener("change", function () { if ($("st-def").value) { settings.defTime = $("st-def").value; saveSettings(); } });
  $("st-out").onclick = function () { state.session = null; save(); $("settings").hidden = true; show("welcome"); toast("DU ÄR UTLOGGAD"); };

  /* ---------- calendar ---------- */
  var cal = $("cal"), calMonth = null;
  function monthOfWeek() { var th = addDays(weekStart, 3); return new Date(th.getFullYear(), th.getMonth(), 1); }
  function renderCal() {
    var y = calMonth.getFullYear(), m = calMonth.getMonth();
    $("calyear").textContent = y; $("calmonth").textContent = MONTHS[m];
    var start = mondayOf(new Date(y, m, 1)), last = new Date(y, m + 1, 0), curKey = key(weekStart), h = "", r, c;
    for (r = 0; addDays(start, r * 7) <= last; r++) {
      var mon = addDays(start, r * 7), mk = key(mon);
      h += '<button class="crow' + (mk === curKey ? " cur" : "") + '" data-w="' + mk + '" aria-label="Vecka ' + isoWeek(mon) + '"><span class="cw">' + pad(isoWeek(mon)) + "</span>";
      for (c = 0; c < 7; c++) {
        var d = addDays(mon, c), k = key(d), ts = list(k), all = ts.length && ts.every(function (t) { return t.d; });
        h += '<span class="cd' + (d.getMonth() !== m ? " out" : "") + (k === todayKey ? " today" : "") + (ts.length ? " has" : "") + (all ? " alldone" : "") + '"><b>' + d.getDate() + "</b><i></i></span>";
      }
      h += "</button>";
    }
    $("calgrid").innerHTML = h;
    var a = weekStart, b = addDays(weekStart, 6);
    $("calfoot").textContent = "VALD: VECKA " + pad(isoWeek(weekStart)) + " · " + addDays(weekStart, 3).getFullYear() + " · " + a.getDate() + " " + MON[a.getMonth()] + " – " + b.getDate() + " " + MON[b.getMonth()];
  }
  function openCal() { calMonth = monthOfWeek(); renderCal(); cal.hidden = false; $("calclose").focus(); }
  function closeCal() { cal.hidden = true; $("wkbtn").focus(); }
  $("wkbtn").onclick = openCal;
  $("o-wk").onclick = openCal;
  $("o-matrix").onclick = openCal;
  $("calclose").onclick = closeCal;
  $("caltoday").onclick = function () { todayKey = key(new Date()); setWeek(mondayOf(new Date())); closeCal(); if (tab === "over") setTab("plan"); };
  $("calprev").onclick = function () { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); renderCal(); };
  $("calnext").onclick = function () { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); renderCal(); };
  $("calgrid").addEventListener("click", function (e) {
    var row = e.target.closest("[data-w]"); if (!row) return;
    setWeek(fromKey(row.getAttribute("data-w"))); closeCal(); if (tab === "over") setTab("plan");
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (!$("edit").hidden) closeEdit(); else if (!$("settings").hidden) closeSettings(); else if (!cal.hidden) closeCal(); else if (!$("s-add").hidden) closeAdd();
  });

  /* ---------- start ---------- */
  load(); loadSettings(); applyTheme();
  show(cur() ? "home" : "welcome");
  ensureDemo();
})();
