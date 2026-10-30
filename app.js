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
  /* time pickers: big dot digits you type into (tap the hour or minute and type), or fine-tune with + and −;
     holding + or − repeats. Whatever is typed is clamped to a real time. */
  function tpCol(u, what) {
    return '<div class="tp-col"><button type="button" class="rnd" data-tp="' + u + '+" aria-label="' + what + ' senare">+</button>' +
      '<input class="tp-n" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" autocomplete="off" data-tpv="' + u + '" placeholder="--" aria-label="' + (u === "h" ? "Timme" : "Minut") + '">' +
      '<button type="button" class="rnd" data-tp="' + u + '-" aria-label="' + what + ' tidigare">−</button></div>';
  }
  function tpBody() { return '<div class="tp" role="group" aria-label="Välj tid">' + tpCol("h", "En timme") + '<b class="tp-c" aria-hidden="true">:</b>' + tpCol("m", "Fem minuter") + '</div>'; }
  function tpAct(a, h, m) {
    if (a === "h+") h = (h + 1) % 24; else if (a === "h-") h = (h + 23) % 24;
    else if (a === "m+") m = (Math.floor(m / 5) * 5 + 5) % 60; else if (a === "m-") m = (Math.ceil(m / 5) * 5 + 55) % 60;
    return [h, m];
  }
  function tpHold(host) {
    if (host.__hold) return; host.__hold = true;
    var t1, t2;
    function stop() { clearTimeout(t1); clearInterval(t2); }
    host.addEventListener("pointerdown", function (e) {
      var b = e.target.closest('[data-tp="h+"], [data-tp="h-"], [data-tp="m+"], [data-tp="m-"]'); if (!b) return;
      stop(); t1 = setTimeout(function () { t2 = setInterval(function () { b.click(); }, 110); }, 450);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) { host.addEventListener(ev, stop); });
  }
  /* typing into the digits. t = { cur: () => [h, m] | null, apply: (h, m), start: () => "HH:MM", redraw: () } */
  function tpType(host, t) {
    host.__tt = t;
    if (host.__typing) return; host.__typing = true;
    function inp(u) { return host.querySelector('[data-tpv="' + u + '"]'); }
    function isDigit(el) { return el && el.classList && el.classList.contains("tp-n"); }
    host.addEventListener("focusin", function (e) { var el = e.target; if (isDigit(el)) setTimeout(function () { try { el.select(); } catch (x) {} }, 0); });
    host.addEventListener("input", function (e) {
      var el = e.target; if (!isDigit(el)) return;
      var tt = host.__tt, u = el.getAttribute("data-tpv"), v = el.value.replace(/\D/g, "").slice(0, 2); el.value = v;
      var s = tt.cur(), st = tt.start().split(":"), h = s ? s[0] : +st[0], m = s ? s[1] : (u === "h" ? 0 : +st[1]);
      if (u === "h") {
        if (v.length === 1 && +v > 2) { tt.apply(+v, m); inp("m").focus(); return; }
        if (v.length === 2) { tt.apply(Math.min(23, +v), m); inp("m").focus(); }
        return;
      }
      if (v.length === 2) { tt.apply(h, Math.min(59, +v)); el.blur(); }
    });
    host.addEventListener("focusout", function (e) {
      var el = e.target; if (!isDigit(el)) return;
      var tt = host.__tt, u = el.getAttribute("data-tpv");
      if (el.value === "") { tt.redraw(); return; }
      var s = tt.cur(), st = tt.start().split(":"), h = s ? s[0] : +st[0], m = s ? s[1] : (u === "h" ? 0 : +st[1]), n = +el.value;
      if (u === "h") h = Math.min(23, n); else m = Math.min(59, n);
      tt.apply(h, m);
    });
    host.addEventListener("keydown", function (e) { if (isDigit(e.target) && e.key === "Enter") { e.preventDefault(); e.target.blur(); } });
  }
  function openPicker(host, value, done) {
    var p = (value || settings.defTime).split(":"), h = +p[0], m = +p[1];
    host.innerHTML = tpBody() + '<div class="tp-acts"><button type="button" class="btn out" data-tp="no">AVBRYT</button><button type="button" class="btn pri" data-tp="ok">KLAR</button></div>';
    function draw() { host.querySelector('[data-tpv="h"]').value = pad(h); host.querySelector('[data-tpv="m"]').value = pad(m); }
    function finish(ok) { closePicker(host); done(ok ? pad(h) + ":" + pad(m) : null); }
    host.onclick = function (e) {
      e.stopPropagation();
      var b = e.target.closest("[data-tp]"); if (!b) return;
      var a = b.getAttribute("data-tp");
      if (a === "ok" || a === "no") { finish(a === "ok"); return; }
      var r = tpAct(a, h, m); h = r[0]; m = r[1]; draw();
    };
    host.confirm = function () { finish(true); };
    tpType(host, { cur: function () { return [h, m]; }, apply: function (nh, nm) { h = nh; m = nm; draw(); }, start: function () { return pad(h) + ":" + pad(m); }, redraw: draw });
    tpHold(host); host.hidden = false; draw();
    host.querySelector('[data-tp="ok"]').focus({ preventScroll: true });
    host.scrollIntoView({ block: "nearest", behavior: reduceMq && reduceMq.matches ? "auto" : "smooth" });
  }
  /* inline picker for a new task: empty (no reminder) until a time is typed or stepped, then the shown time is the reminder */
  function inlinePicker(host, get, set, start) {
    host.innerHTML = '<div class="tr-head"><span class="sl">TID = PÅMINNELSE</span><button type="button" class="tr-clear" data-tp="clear">INGEN TID</button></div>' +
      tpBody() + '<div class="ck-cap tp-cap"></div>';
    function draw() {
      var v = get(), p = v ? v.split(":") : ["", ""];
      host.querySelector('[data-tpv="h"]').value = p[0]; host.querySelector('[data-tpv="m"]').value = p[1];
      host.classList.toggle("empty", !v);
      host.querySelector('[data-tp="clear"]').hidden = !v;
      var cap = host.querySelector(".tp-cap");
      cap.textContent = v ? (settings.remind ? "PÅMINNER DIG " + v : "PÅMINNELSER AV · " + v) : "INGEN PÅMINNELSE · SKRIV TIDEN ELLER ANVÄND + OCH −";
      cap.classList.toggle("on", !!v && settings.remind);
    }
    host.onclick = function (e) {
      var b = e.target.closest("[data-tp]"); if (!b) return;
      e.stopPropagation();
      var a = b.getAttribute("data-tp");
      if (a === "clear") { set(""); draw(); return; }
      var v = get() || start(), p = v.split(":"), first = !get();
      var r = first ? [+p[0], +p[1]] : tpAct(a, +p[0], +p[1]);
      set(pad(r[0]) + ":" + pad(r[1])); draw();
    };
    tpType(host, {
      cur: function () { var v = get(); return v ? v.split(":").map(Number) : null; },
      apply: function (h, m) { set(pad(h) + ":" + pad(m)); draw(); },
      start: start, redraw: draw
    });
    tpHold(host); host.draw = draw; draw();
  }
  function closePicker(host) { if (!host || host.hidden) return; host.hidden = true; host.innerHTML = ""; host.onclick = null; host.confirm = null; }
  function pickerOpen(host) { return host && !host.hidden && host.confirm; }
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
  /* tasks never land on a past day: every add and move goes through push, which moves a past day to today.
     Undo restores with insertAt, so an old task can still go back where it was. */
  function notPast(k) { var nk = key(new Date()); return k < nk ? nk : k; }
  function push(k, t) { k = notPast(k); var all = allTasks(); (all[k] = all[k] || []).push(t); return k; }

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
  var SKEY = "veckolista-settings", ACC = { orange: "ORANGE", rosa: "ROSA", korall: "KORALL", mint: "MINT", lime: "LIME", bla: "BLÅ", mono: "MONO" };
  var settings = { theme: "system", accent: "orange", remind: true, defTime: "09:00", figure: 0, view: "desk", lang: "en", quote: null, recap: null };
  function loadSettings() {
    try {
      var s = JSON.parse(localStorage.getItem(SKEY));
      if (s) { for (var k in settings) if (k in s) settings[k] = s[k]; }
      else if (state.theme) settings.theme = state.theme;
      if (!(settings.figure >= 0 && settings.figure < 5)) settings.figure = 0;
      if (settings.lang !== "sv") settings.lang = "en";
      if (!ACC[settings.accent]) settings.accent = { blue: "bla", kobolt: "bla", skiffer: "bla", salvia: "mint", ockra: "lime", red: "korall" }[settings.accent] || "orange";
    } catch (e) {}
  }
  function saveSettings() { try { localStorage.setItem(SKEY, JSON.stringify(settings)); } catch (e) {} }
  /* ---------- language: English by default, Swedish in Inställningar ----------
     the app is written in Swedish; for English, day and month names swap at the source and every other
     UI string is translated as it reaches the DOM (exact phrases, then patterns for built-up text).
     Anything inside [data-notr] (task titles, names) is the user's own text and is never touched. */
  var SV_ARR = { DAYS: DAYS, LET: LET, MON: MON, MONTHS: MONTHS };
  var EN_ARR = {
    DAYS: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"],
    LET: ["M", "T", "W", "T", "F", "S", "S"],
    MON: ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"],
    MONTHS: ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"]
  };
  var EN = {
    "AUTO": "AUTO", "KLARA": "DONE", "VECKA": "WEEK", "VECKAN": "THIS WEEK", "IDAG": "TODAY", "IGÅR": "YESTERDAY", "NÄSTA": "NEXT", "PLAN": "PLAN", "ÖVERSIKT": "OVERVIEW",
    "Planera veckan. En dag i taget.": "Plan the week. One day at a time.", "VAD HETER DU?": "WHAT'S YOUR NAME?",
    "ALLT SPARAS BARA PÅ DEN HÄR ENHETEN": "SAVED ON THIS DEVICE ONLY", "SKRIV DITT NAMN FÖRST": "TYPE YOUR NAME FIRST",
    "Ditt namn": "Your name", "Kom igång": "Get started", "Tillbaka": "Back", "Figur som rör sig. Tryck för nästa": "Moving figure. Tap for the next one",
    "GOD NATT": "GOOD NIGHT", "GOD MORGON": "GOOD MORNING", "GOD DAG": "GOOD AFTERNOON", "GOD KVÄLL": "GOOD EVENING",
    "DAGENS CITAT": "QUOTE OF THE DAY", "KOMMANDE": "COMING UP", "VECKAN SOM GICK": "LAST WEEK", "BÄSTA DAG": "BEST DAY", "NÄSTA: INGET PLANERAT": "NEXT: NONE", "Kommande": "Coming up", "VISA HELA VECKAN": "SHOW THE WHOLE WEEK", "I MORGON": "TOMORROW", "Föregående citat": "Previous quote", "Nästa citat": "Next quote", "PLANERA DAGEN": "PLAN THE DAY", "ALLT KLART": "ALL DONE", "ALLT": "ALL", "KLART": "DONE",
    "MED PÅMINNELSE": "WITH REMINDER", "PÅMINNELSER AV": "REMINDERS OFF", "INGET MER": "NOTHING MORE", "INGET PLANERAT": "NOTHING PLANNED",
    "NJUT AV DAGEN": "ENJOY THE DAY", "INGET ÄNNU": "NOTHING YET", "ÄNNU INGEN TID": "NO TIME YET", "TID = PÅMINNELSE": "TIME = REMINDER",
    "INGEN SERIE ÄNNU": "NO STREAK YET", "DIN FÖRSTA VECKA BÖRJAR HÄR": "YOUR FIRST WEEK STARTS HERE", "NÄSTA VECKA": "NEXT WEEK", "PLANERA I FÖRTID": "PLAN AHEAD",
    "INGET PLANERAT ÄNNU": "NOTHING PLANNED YET", "KOM IGÅNG MED ETT FÖRSLAG": "START WITH A SUGGESTION", "+ Handla mat": "+ Buy groceries", "+ Träning": "+ Workout",
    "+ Läs 10 sidor": "+ Read 10 pages", "Handla mat": "Buy groceries", "Träning": "Workout", "Läs 10 sidor": "Read 10 pages",
    "Lägg till en uppgift...": "Add a task...", "Första uppgiften...": "Your first task...", "↑ BÖRJA HÄR. KLOCKAN = PÅMINNELSE": "↑ START HERE. CLOCK = REMINDER",
    "RENSA KLARA": "CLEAR DONE", "SKRIVSKYDDAD": "READ ONLY", "VECKAN ÄR AVSLUTAD": "THE WEEK IS OVER", "AVSLUTAD": "FINISHED", "TOM VECKA": "EMPTY WEEK",
    "NY UPPGIFT": "NEW TASK", "LÄGG TILL": "ADD", "TILLAGD": "ADDED", "INGA UPPGIFTER ÄNNU": "NO TASKS YET", "Vad ska göras?": "What needs doing?", "Ny uppgift": "New task", "Välj dag": "Pick a day",
    "INGEN TID": "NO TIME", "INGEN PÅMINNELSE": "NO REMINDER", "TRYCK + ELLER −": "TAP + OR −", "SKRIV TIDEN ELLER ANVÄND + OCH −": "TYPE THE TIME OR USE + AND −", "LÄGG TILL PÅMINNELSE": "ADD A REMINDER", "SNYGGT!": "NICE!", "BRA JOBBAT!": "GOOD JOB!", "EN MINDRE!": "ONE LESS!", "TOPPEN!": "GREAT!", "KLART!": "DONE!", "Timme": "Hour", "Minut": "Minute", "AVBRYT": "CANCEL", "KLAR": "DONE", "INGEN": "NONE", "ANNAN": "OTHER",
    "Välj tid": "Pick a time", "Tid": "Time", "En timme senare": "One hour later", "En timme tidigare": "One hour earlier", "Fem minuter senare": "Five minutes later", "Fem minuter tidigare": "Five minutes earlier",
    "REDIGERA UPPGIFT": "EDIT TASK", "DAG": "DAY", "Dag": "Day", "Titel": "Title", "FLYTTA TILL NÄSTA DAG": "MOVE TO NEXT DAY", "MISSADE UPPGIFTER": "MISSED TASKS", "FLYTTA ALLA TILL IDAG": "MOVE ALL TO TODAY", "MARKERA SOM KLAR": "MARK AS DONE",
    "TA BORT": "DELETE", "SPARA": "SAVE", "ÅNGRA": "UNDO", "15 minuter tidigare": "15 minutes earlier", "15 minuter senare": "15 minutes later",
    "FLYTTAR UPPGIFTEN TILL I MORGON. DEN FÖRSVINNER FRÅN IDAG.": "MOVES THE TASK TO TOMORROW. IT DISAPPEARS FROM TODAY.",
    "INSTÄLLNINGAR": "SETTINGS", "KONTO": "ACCOUNT", "UTSEENDE": "APPEARANCE", "TEMA": "THEME", "LJUS": "LIGHT", "MÖRK": "DARK", "FÄRG": "COLOUR",
    "ROSA": "PINK", "KORALL": "CORAL", "MINT": "MINT", "LIME": "LIME", "BLÅ": "BLUE", "PÅMINNELSER": "REMINDERS", "NÄR EN UPPGIFT HAR TID": "WHEN A TASK HAS A TIME", "STANDARDTID": "DEFAULT TIME",
    "LOGGA UT": "LOG OUT", "SPRÅK": "LANGUAGE", "VECKOLISTA · VERSION 1.0": "VECKOLISTA · VERSION 1.0", "DU ÄR UTLOGGAD": "YOU ARE LOGGED OUT",
    "Visning": "View", "Mobilvy": "Phone view", "Datorvy": "Desktop view", "Byt tema": "Change theme", "Inställningar": "Settings", "Huvudmeny": "Main menu",
    "Dagens citat": "Quote of the day", "Idag": "Today", "Öppna idag i Plan": "Open today in Plan", "Lägg till uppgift": "Add task", "Lägg till": "Add", "Vecka": "Week",
    "Öppna kalender": "Open calendar", "Nästa": "Next", "Öppna nästa uppgift i Plan": "Open the next task in Plan", "Veckan": "This week", "Förra veckan": "Previous week",
    "Nästa vecka": "Next week", "Kalender": "Calendar", "Stäng kalendern": "Close calendar", "Förra månaden": "Previous month", "Nästa månad": "Next month", "Stäng": "Close",
    "Tema": "Theme", "Färg": "Colour", "Rosa": "Pink", "Korall": "Coral", "Blå": "Blue", "Påminnelser": "Reminders", "Påminnelse": "Reminder", "Standardtid": "Default time",
    "Flytta till idag": "Move to today", "Ta bort": "Delete", "Tid, påminnelse och upprepning": "Time and reminder", "Språk": "Language",
    "person": "person", "hund": "dog", "robot": "robot", "katt": "cat", "fågel": "bird", "ljus": "light", "mörk": "dark",
  };
  var EN_PAT = [
    [/^(\d+) MISSADE · TRYCK → FÖR ATT FLYTTA TILL IDAG$/, "$1 MISSED · TAP → TO MOVE TO TODAY"],
    [/^FLYTTAR UPPGIFTEN TILL (.+)\. DEN FÖRSVINNER FRÅN (.+)\.$/, function (m, a, b) { return "MOVES THE TASK TO " + tr(a) + ". IT DISAPPEARS FROM " + tr(b) + "."; }],
    [/^(\d+) FLYTTADE TILL IDAG$/, "$1 MOVED TO TODAY"], [/^FRÅN TIDIGARE DAGAR · VECKA (\d+)$/, "FROM EARLIER DAYS · WEEK $1"],
    [/^(\d+) UPPGIFT$/, "$1 TASK"], [/^(\d+) UPPGIFTER$/, "$1 TASKS"], [/^(\d+) MISSADE$/, "$1 MISSED"], [/^(\d+) KVAR$/, "$1 LEFT"], [/^(\d+) KVAR IDAG$/, "$1 LEFT TODAY"],
    [/^\/ (\d+) KLARA$/, "/ $1 DONE"], [/^(\d+) \/ (\d+) KLARA$/, "$1 / $2 DONE"], [/^(\d+) KLARA RENSADE$/, "$1 DONE CLEARED"], [/^(\d+) KLAR RENSAD$/, "$1 DONE CLEARED"],
    [/^SERIE: (\d+) DAG$/, "STREAK: $1 DAY"], [/^SERIE: (\d+) DAGAR$/, "STREAK: $1 DAYS"], [/^OM (\d+) VECKOR$/, "IN $1 WEEKS"], [/^VECKA (\d+)$/, "WEEK $1"],
    [/^VALD: VECKA (\d+)$/, "SELECTED: WEEK $1"], [/^Vecka (\d+)$/, "Week $1"], [/^PLANERA VECKA (\d+)$/, "PLAN WEEK $1"], [/^HEJ (.+)$/, "HI $1"], [/^NÄSTA: (.+)$/, function (m, a) { return "NEXT: " + tr(a); }],
    [/^FLYTTAD TILL (.+)$/, function (m, a) { return "MOVED TO " + tr(a); }], [/^PÅMINNER DIG (.+)$/, function (m, a) { return "REMINDS YOU " + tr(a); }],
    [/^PÅMINNELSE (.+)$/, "REMINDER $1"], [/^(.+) BORTTAGEN$/, "$1 DELETED"], [/^Klar: (.*)$/, "Done: $1"],
    [/^Figur: (.+)\. Tryck för nästa figur$/, function (m, a) { return "Figure: " + tr(a) + ". Tap for the next one"; }],
    [/^Tema: (.+)\. Tryck för att byta$/, function (m, a) { return "Theme: " + tr(a) + ". Tap to switch"; }],
    [/^(\d+) (JAN|FEB|MAR|APR|MAJ|JUN|JUL|AUG|SEP|OKT|NOV|DEC)$/, function (m, d, mo) { return d + " " + EN_ARR.MON[SV_ARR.MON.indexOf(mo)]; }]
  ];
  function trOne(s) {
    if (Object.prototype.hasOwnProperty.call(EN, s)) return EN[s];
    var i = SV_ARR.DAYS.indexOf(s); if (i >= 0) return EN_ARR.DAYS[i];
    i = SV_ARR.MONTHS.indexOf(s); if (i >= 0) return EN_ARR.MONTHS[i];
    for (var p = 0; p < EN_PAT.length; p++) if (EN_PAT[p][0].test(s)) return s.replace(EN_PAT[p][0], EN_PAT[p][1]);
    return null;
  }
  /* whole string first, then each " · " segment, keeping the spacing around it */
  function tr(s) {
    var core = s.trim(); if (!core) return s;
    var w = trOne(core);
    if (w === null && core.indexOf(" · ") >= 0) w = core.split(" · ").map(function (seg) { var x = trOne(seg.trim()); return x === null ? seg : x; }).join(" · ");
    if (w === null || w === core) return s;
    var lead = s.slice(0, s.indexOf(core)), tail = s.slice(s.indexOf(core) + core.length);
    return lead + w + tail;
  }
  function isEn() { return settings.lang !== "sv"; }
  function t(s) { return isEn() ? tr(s) : s; }
  var TR_ATTRS = ["aria-label", "placeholder", "title"];
  function trSkip(el) { return !el || (el.closest && el.closest("[data-notr], script, style")); }
  function trText(n) {
    if (!isEn() || n.__en === n.nodeValue || trSkip(n.parentElement)) return;
    var v = tr(n.nodeValue); if (v === n.nodeValue) return;
    n.__sv = n.nodeValue; n.__en = v; n.nodeValue = v;
  }
  function trAttrs(el) {
    if (!isEn() || trSkip(el)) return;
    TR_ATTRS.forEach(function (a) {
      var cur = el.getAttribute(a); if (cur === null) return;
      el.__en = el.__en || {}; el.__sv = el.__sv || {};
      if (el.__en[a] === cur) return;
      var v = tr(cur); if (v === cur) return;
      el.__sv[a] = cur; el.__en[a] = v; el.setAttribute(a, v);
    });
  }
  function trTree(root) {
    if (root.nodeType === 3) { trText(root); return; }
    if (root.nodeType !== 1 || trSkip(root)) return;
    trAttrs(root);
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT), n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) trText(n); else trAttrs(n); }
  }
  function untrTree() {
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT), n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) { if (n.__sv !== undefined && n.__en === n.nodeValue) n.nodeValue = n.__sv; n.__sv = n.__en = undefined; }
      else if (n.__sv) { for (var a in n.__sv) if (n.getAttribute(a) === n.__en[a]) n.setAttribute(a, n.__sv[a]); n.__sv = n.__en = undefined; }
    }
  }
  if (window.MutationObserver) new MutationObserver(function (ms) {
    if (!isEn()) return;
    ms.forEach(function (m) {
      if (m.type === "characterData") trText(m.target);
      else if (m.type === "attributes") trAttrs(m.target);
      else Array.prototype.forEach.call(m.addedNodes, trTree);
    });
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: TR_ATTRS });
  function applyLang() {
    var A = isEn() ? EN_ARR : SV_ARR;
    DAYS = A.DAYS; LET = A.LET; MON = A.MON; MONTHS = A.MONTHS;
    document.documentElement.lang = isEn() ? "en" : "sv";
    if (isEn()) trTree(document.body); else untrTree();
  }
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
    figColors(); if (fig && !$("s-over").hidden) figStart();
    if (dance && !$("s-welcome").hidden) danceStart();
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
  /* ---------- phone or desktop view: on wide screens the two tabs sit side by side ---------- */
  var wideMq = window.matchMedia ? window.matchMedia("(min-width: 900px)") : null;
  function isDesk() { return settings.view !== "phone" && !!wideMq && wideMq.matches; }
  function applyView() {
    var home = document.body.classList.contains("home");
    document.body.classList.toggle("desk", isDesk());
    $("viewsw").hidden = !(wideMq && wideMq.matches);
    if (!home && !$("s-welcome").hidden) danceStart();
    Array.prototype.forEach.call(document.querySelectorAll("[data-view]"), function (b) {
      var on = b.getAttribute("data-view") === (settings.view === "phone" ? "phone" : "desk");
      b.classList.toggle("on", on); b.setAttribute("aria-checked", on);
    });
    if (home && $("s-add").hidden) setTab(tab);
  }
  Array.prototype.forEach.call(document.querySelectorAll("[data-view]"), function (b) {
    b.onclick = function () { settings.view = b.getAttribute("data-view"); saveSettings(); applyView(); };
  });
  if (wideMq && wideMq.addEventListener) wideMq.addEventListener("change", applyView);
  function show(name) {
    ["welcome", "login", "signup"].forEach(function (s) { $("s-" + s).hidden = s !== name; });
    document.body.classList.toggle("home", name === "home"); applyView();
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
    var over = name === "over", scr = $(over ? "s-over" : "s-home"), desk = isDesk();
    $("s-over").hidden = !over && !desk; $("s-home").hidden = over && !desk;
    if (desk) { renderOver(); render(); return; }
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
  /* dagens citat: four quotes, opens on the first each day; the one picked stays for the rest of the day */
  var QUOTES = [
    { en: "A JOURNEY OF A THOUSAND MILES BEGINS WITH A SINGLE STEP.", sv: "EN RESA PÅ TUSEN MIL BÖRJAR MED ETT STEG.", by: "LAO TZU" },
    { en: "LESS, BUT BETTER.", sv: "MINDRE, MEN BÄTTRE.", by: "DIETER RAMS" },
    { en: "LOST TIME IS NEVER FOUND AGAIN.", sv: "FÖRLORAD TID HITTAR MAN ALDRIG IGEN.", by: "BENJAMIN FRANKLIN" },
    { en: "PLANS ARE WORTHLESS, BUT PLANNING IS EVERYTHING.", sv: "PLANER ÄR VÄRDELÖSA, MEN ATT PLANERA ÄR ALLT.", by: "DWIGHT D. EISENHOWER" }
  ];
  function quoteIdx() { var q = settings.quote; return q && q.day === key(new Date()) && QUOTES[q.i] ? q.i : 0; }
  /* the closing mark is tied to the last word so it never ends up alone on a line */
  function quoteHtml(q) {
    var txt = isEn() ? q.en : q.sv, cut = txt.lastIndexOf(" ") + 1;
    return '<span class="qm qo">' + (isEn() ? "“" : "”") + "</span>" + esc(txt.slice(0, cut)) +
      '<span class="nw">' + esc(txt.slice(cut)) + '<span class="qm">”</span></span>';
  }
  function renderQuote(dir) {
    var el = $("o-quote"), i = quoteIdx(), h = 0;
    if (!el.offsetWidth) return;
    el.style.minHeight = "";
    QUOTES.forEach(function (q) { el.innerHTML = quoteHtml(q); h = Math.max(h, el.offsetHeight); });
    el.style.minHeight = h + "px";
    el.innerHTML = quoteHtml(QUOTES[i]); $("o-quote-d").textContent = QUOTES[i].by;
    if (dir) { el.classList.remove("qin-l", "qin-r"); void el.offsetWidth; el.classList.add(dir > 0 ? "qin-r" : "qin-l"); }
  }
  function stepQuote(d) {
    settings.quote = { day: key(new Date()), i: (quoteIdx() + d + QUOTES.length) % QUOTES.length }; saveSettings();
    renderQuote(d); buzz(6);
  }
  $("o-qprev").onclick = function () { stepQuote(-1); };
  $("o-qnext").onclick = function () { stepQuote(1); };
  (function () {
    var q0 = null, tile = $("o-qtile");
    tile.addEventListener("pointerdown", function (e) { q0 = e.target.closest("button") ? null : { x: e.clientX, y: e.clientY }; });
    tile.addEventListener("pointerup", function (e) {
      if (!q0) return; var dx = e.clientX - q0.x, dy = e.clientY - q0.y; q0 = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) stepQuote(dx < 0 ? 1 : -1);
    });
    tile.addEventListener("pointercancel", function () { q0 = null; });
  })();
  window.addEventListener("resize", function () { if (!$("s-over").hidden) renderQuote(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (!$("s-over").hidden) renderQuote(); });
  function plural(n) { return n + (n === 1 ? " UPPGIFT" : " UPPGIFTER"); }
  function dotsHtml(ts, cls) {
    var h = "";
    ts.slice(0, MAXDOTS).forEach(function (t) { h += '<i class="' + cls(t) + '"></i>'; });
    return h;
  }
  /* the name stays on one line beside the figure; long names step down in size */
  function fitName() {
    var n = document.querySelector(".g-n"), fs = 64;
    n.style.fontSize = "";
    while (n.scrollWidth > n.clientWidth + 1 && fs > 36) { fs -= 4; n.style.fontSize = fs + "px"; }
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (!$("s-over").hidden) fitName(); });
  function renderOver() {
    var u = cur(); if (!u) return;
    var now = new Date(), nk = key(now), idx = (now.getDay() + 6) % 7, hr = now.getHours();
    var ms = mondayOf(now), i;
    $("o-greet").textContent = hr < 5 ? "GOD NATT" : hr < 10 ? "GOD MORGON" : hr < 18 ? "GOD DAG" : "GOD KVÄLL";
    $("o-name").textContent = u.name.split(" ")[0].toUpperCase();
    fitName(); figStart();
    var dl = DAYS[idx] + " · " + now.getDate() + " " + MON[now.getMonth()];
    $("o-date").textContent = dl + " · VECKA " + isoWeek(now);
    renderQuote(); syncMissed();

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
    $("o-n1").toggleAttribute("data-notr", !!nx); $("o-n1").textContent = a; $("o-n2").textContent = b; $("o-n3").textContent = c;

    /* kommande: the week as a 24-dot meter, then the next days you can act on */
    var tot = 0, tdn = 0, streak = 0, dates = [], NB = 24, fill, bh = "", uh = "", shown = 0;
    for (i = 0; i < 7; i++) {
      var wt = list(key(addDays(ms, i)));
      tot += wt.length; tdn += wt.filter(function (t) { return t.d; }).length; dates.push(wt);
    }
    fill = tot ? Math.round(tdn / tot * NB) : 0;
    for (i = 0; i < NB; i++) bh += '<i class="' + (i < fill ? "on" : "") + '"></i>';
    $("o-wbar").innerHTML = bh;
    $("o-wsum").textContent = tdn + " / " + tot + " KLARA · V" + isoWeek(now);
    var upTo = idx < 6 ? 6 - idx : 3, more = 0;
    for (i = 1; i <= upTo; i++) {
      var dd = addDays(now, i), dk = key(dd), ts = list(dk), left = ts.filter(function (t) { return !t.d; }), di = (dd.getDay() + 6) % 7;
      if (shown === 4) { more++; continue; }
      var first = sorted(left)[0], sub = dd.getDate() + " " + MON[dd.getMonth()] + (i === 1 ? " · I MORGON" : "");
      var dots = ""; ts.slice(0, 5).forEach(function (t) { dots += '<i class="' + (t.d ? "on" : "") + '"></i>'; });
      if (ts.length > 5) dots += '<em>+' + (ts.length - 5) + "</em>";
      uh += '<li><button type="button" class="up-r" data-up="' + dk + '" aria-label="' + DAYS[di] + " " + sub + '">' +
        '<span class="up-d"><b>' + DAYS[di] + '</b><span>' + sub + '</span></span>' +
        '<span class="up-t">' + (first ? '<span data-notr>' + (first.time ? first.time + " " : "") + esc(first.t) + "</span>" : "INGET PLANERAT") + '</span>' +
        '<span class="up-n">' + (ts.length ? dots : '<span class="up-add" aria-hidden="true">+</span>') + "</span></button></li>";
      shown++;
    }
    if (idx === 6) uh = '<li class="up-h">NÄSTA VECKA</li>' + uh;
    if (more) uh += '<li><button type="button" class="up-r up-more" data-up="plan"><span class="up-d"><b>+' + more + '</b><span>VISA HELA VECKAN</span></span><span class="up-n"><span aria-hidden="true">→</span></span></button></li>';
    $("o-up").innerHTML = uh;
    for (i = idx; i >= 0; i--) {
      var w = dates[i], full = w.length && w.every(function (t) { return t.d; });
      if (full) streak++; else if (i !== idx) break;
    }
    $("o-streak").hidden = !streak;
    $("o-streak").textContent = "SERIE: " + streak + (streak === 1 ? " DAG" : " DAGAR");
  }
  /* a tap on a coming day: Plan on that day if it has tasks, Lägg till for that day if it is empty */
  $("o-up").addEventListener("click", function (e) {
    var b = e.target.closest("[data-up]"); if (!b) return;
    var k = b.getAttribute("data-up");
    if (k === "plan") { goPlanToday(false); return; }
    if (!list(k).length) { openAdd(k, "over"); return; }
    todayKey = key(new Date()); weekStart = mondayOf(fromKey(k)); openKey = k; setTab("plan"); scrollOpenDay();
  });
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
  /* first version: no login, just a name. Same name on the same device opens the same list. */
  $("f-name").addEventListener("submit", function (e) {
    e.preventDefault();
    var nm = $("wl-name").value.trim().replace(/\s+/g, " ");
    if (!nm) { $("wl-err").textContent = "SKRIV DITT NAMN FÖRST"; $("wl-f").classList.add("bad"); $("wl-name").focus(); return; }
    var id = "namn:" + nm.toLowerCase();
    if (!state.users[id]) state.users[id] = { name: nm, tasks: {} };
    state.session = id; save();
    $("wl-name").value = ""; $("wl-err").textContent = ""; $("wl-f").classList.remove("bad");
    show("home");
  });
  $("wl-name").addEventListener("input", function () { $("wl-err").textContent = ""; $("wl-f").classList.remove("bad"); });

  function renderWelcome() {
    var d = new Date();
    $("wl-wk").textContent = DAYS[(d.getDay() + 6) % 7] + " · " + d.getDate() + " " + MON[d.getMonth()];
    $("wl-num").textContent = pad(isoWeek(d));
    danceStart(true);
  }

  /* ---------- welcome stage: the week number and a dot-matrix figure on one floor of dots ----------
     the figure is a skeleton (neck, hip, elbows, hands, knees, feet) on a 15x17 grid at the right of the stage.
     it loops through scenes, each with its own tempo; joints ease into the next pose on every beat and snap
     to the dots, so it moves fluid but mechanical. Orange hands; the floor ripples from its feet on each beat.
     Tap the figure to skip to the next scene. */
  var DW = 15, DH = 17, DCOLS = 36;
  var DPOSE = {
    stand: { n: [7, 5], h: [7, 9.5], le: [5, 7], lh: [4.6, 9.6], re: [9, 7], rh: [9.4, 9.6], lk: [6, 12.5], lf: [5.6, 15.4], rk: [8, 12.5], rf: [8.4, 15.4] },
    point: { n: [7.3, 5], h: [7.5, 9.5], le: [5.4, 7.4], lh: [6, 9.4], re: [9.6, 3.4], rh: [12, 1.2], lk: [6.2, 12.4], lf: [5.6, 15.4], rk: [9, 12], rf: [9.6, 15.4] },
    down: { n: [6.7, 5.2], h: [6.6, 9.6], le: [8.6, 7.4], lh: [8.2, 9.4], re: [4.6, 7.6], rh: [2.4, 10.4], lk: [5.4, 12.3], lf: [4.6, 15.4], rk: [7.4, 12.6], rf: [7.8, 15.4] },
    robot: { n: [7, 5], h: [7, 9.5], le: [4, 5.4], lh: [4, 2.8], re: [10, 5.4], rh: [10, 8], lk: [6, 12.5], lf: [5.6, 15.4], rk: [8, 12.5], rf: [8.4, 15.4] },
    vup: { n: [7, 4], h: [7, 8.4], le: [4.6, 2.6], lh: [3, 0.6], re: [9.4, 2.6], rh: [11, 0.6], lk: [6, 11.4], lf: [5.8, 14.2], rk: [8, 11.4], rf: [8.2, 14.2] },
    squat: { n: [7, 6.4], h: [7, 10.6], le: [4.4, 7.6], lh: [2.8, 6.2], re: [9.6, 7.6], rh: [11.2, 6.2], lk: [4.4, 12.6], lf: [4.2, 15.4], rk: [9.6, 12.6], rf: [9.8, 15.4] },
    run: { n: [7.2, 4.6], h: [7, 9], le: [5.8, 6.6], lh: [6.8, 8.2], re: [8.4, 7.4], rh: [9.6, 9.2], lk: [5.6, 10.6], lf: [6.4, 13], rk: [7.8, 12.2], rf: [8.4, 15.4] },
    star: { n: [7, 4.6], h: [7, 9], le: [4.6, 3.2], lh: [2.6, 1.4], re: [9.4, 3.2], rh: [11.4, 1.4], lk: [5.2, 12], lf: [3.6, 15], rk: [8.8, 12], rf: [10.4, 15] },
    shut: { n: [7, 5.4], h: [7, 10], le: [5.4, 7.6], lh: [5.6, 10], re: [8.6, 7.6], rh: [8.4, 10], lk: [6.4, 12.8], lf: [6.4, 15.4], rk: [7.6, 12.8], rf: [7.6, 15.4] },
    reach: { n: [7, 4.6], h: [7, 9.4], le: [6.2, 2.4], lh: [6.6, 0.2], re: [7.8, 2.4], rh: [7.4, 0.2], lk: [6, 12.4], lf: [5.6, 15.4], rk: [8, 12.4], rf: [8.4, 15.4] },
    bend: { n: [5.8, 5.2], h: [7, 9.5], le: [4.4, 3.2], lh: [2.6, 2.4], re: [5.4, 2.6], rh: [3.4, 1.4], lk: [6, 12.5], lf: [5.2, 15.4], rk: [8.2, 12.5], rf: [8.8, 15.4] },
    wave: { n: [7, 5], h: [7, 9.5], le: [5, 7], lh: [4.6, 9.6], re: [9.6, 3.6], rh: [11, 1.4], lk: [6, 12.5], lf: [5.6, 15.4], rk: [8, 12.5], rf: [8.4, 15.4] },
    wave2: { n: [7, 5], h: [7, 9.5], le: [5, 7], lh: [4.6, 9.6], re: [9.8, 3.8], rh: [12.4, 2.4], lk: [6, 12.5], lf: [5.6, 15.4], rk: [8, 12.5], rf: [8.4, 15.4] }
  };
  function dMirror(p) {
    var m = {}, sw = { le: "re", lh: "rh", re: "le", rh: "lh", lk: "rk", lf: "rf", rk: "lk", rf: "lf", n: "n", h: "h" };
    for (var k in p) m[sw[k]] = [DW - 1 - p[k][0], p[k][1]];
    return m;
  }
  ["point", "down", "robot", "run", "bend"].forEach(function (k) { DPOSE[k + "2"] = dMirror(DPOSE[k]); });
  /* the loop starts with a wave hello, then quickly breaks into the dance; tempos are relaxed on purpose */
  var DSCENES = [
    { ms: 2600, beat: 520, seq: ["wave", "wave2"] },
    { ms: 8400, beat: 700, seq: ["point", "down", "point", "down", "robot", "robot2", "robot", "robot2", "point2", "down2", "point2", "down2"] },
    { ms: 6400, beat: 400, seq: ["run", "run2"] },
    { ms: 6400, beat: 640, seq: ["star", "shut"] },
    { ms: 7200, beat: 1200, seq: ["reach", "bend", "reach", "bend2"] }
  ];
  var dance = { raf: 0, off: 0, t0: 0, last: "" };
  /* scene lists loop; each scene has a length, a beat and a pose sequence */
  function dAt(scenes, t) {
    var loop = scenes.loop || (scenes.loop = scenes.reduce(function (s, c) { return s + c.ms; }, 0));
    var lt = ((t % loop) + loop) % loop, base = t - lt, i = 0;
    while (lt >= scenes[i].ms) { lt -= scenes[i].ms; base += scenes[i].ms; i++; }
    var sc = scenes[i], step = Math.floor(lt / sc.beat);
    return { pose: DPOSE[sc.seq[step % sc.seq.length]], start: base + step * sc.beat, beat: sc.beat, end: base + sc.ms };
  }
  function dJoints(scenes, t) {
    var b = dAt(scenes, t), a = b.start <= 0 ? { pose: DPOSE.stand } : dAt(scenes, b.start - 1), p = (t - b.start) / b.beat, k = Math.min(1, p / 0.35), e = 1 - Math.pow(1 - k, 3), J = {};
    for (var j in b.pose) J[j] = [a.pose[j][0] + (b.pose[j][0] - a.pose[j][0]) * e, a.pose[j][1] + (b.pose[j][1] - a.pose[j][1]) * e];
    return { J: J, p: p };
  }
  /* draws the skeleton through put(x, y, level) in its own 15x17 grid units: body level 2, hands level 3 */
  function dSkeleton(J, put) {
    var R = Math.round, x, y;
    function seg(a, b) {
      var x0 = R(a[0]), y0 = R(a[1]), x1 = R(b[0]), y1 = R(b[1]), dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, er = dx + dy;
      for (;;) { put(x0, y0, 2); if (x0 === x1 && y0 === y1) return; var e2 = 2 * er; if (e2 >= dy) { er += dy; x0 += sx; } if (e2 <= dx) { er += dx; y0 += sy; } }
    }
    var hx = R(J.n[0] + (J.n[0] - J.h[0]) * 0.4), hy = R(J.n[1]) - 2;
    for (y = -1; y <= 1; y++) for (x = -1; x <= 1; x++) put(hx + x, hy + y, 2);
    seg(J.n, J.h); seg(J.n, J.le); seg(J.le, J.lh); seg(J.n, J.re); seg(J.re, J.rh);
    seg(J.h, J.lk); seg(J.lk, J.lf); seg(J.h, J.rk); seg(J.rk, J.rf);
    put(R(J.lh[0]), R(J.lh[1]), 3); put(R(J.rh[0]), R(J.rh[1]), 3);
  }
  function dFrame(t) {
    var C = DCOLS, ox = C - DW, g = new Uint8Array(C * DH), r = dJoints(DSCENES, t), J = r.J, x;
    function put(px, py, v) { px += ox; if (px >= 0 && py >= 0 && px < C && py < DH && g[py * C + px] < v) g[py * C + px] = v; }
    for (x = -ox; x < DW; x++) put(x, DH - 1, 1);
    dSkeleton(J, put);
    if (!figReduced() && r.p < 0.6) {
      var cx = (J.lf[0] + J.rf[0]) / 2, front = r.p * 22;
      for (x = -ox; x < DW; x++) { var d = Math.abs(x - cx); if (Math.abs(d - front) < 0.8) put(x, DH - 1, 3); else if (d < front && d > front - 5) put(x, DH - 1, 2); }
    }
    return g;
  }
  function dDraw(g) {
    var k = g.join(""); if (k === dance.last) return; dance.last = k;
    var cv = $("wl-dance-c"), W = cv.clientWidth, C = DCOLS, pitch = W / C, H = pitch * DH, dpr = window.devicePixelRatio || 1, ctx, i, x, y, rad = pitch * 0.36;
    if (!W) return;
    $("wl-stage").style.setProperty("--wp", pitch + "px");
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = H + "px"; }
    ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    for (i = 1; i <= 3; i++) {
      ctx.fillStyle = fig.col[i - 1]; ctx.beginPath();
      for (y = 0; y < DH; y++) for (x = 0; x < C; x++) if (g[y * C + x] === i) { ctx.moveTo(pitch * (x + 0.5) + rad, pitch * (y + 0.5)); ctx.arc(pitch * (x + 0.5), pitch * (y + 0.5), rad, 0, 2 * Math.PI); }
      ctx.fill();
    }
  }
  function danceLoop(now) {
    dance.raf = 0;
    if ($("s-welcome").hidden || document.hidden) return;
    dDraw(dFrame(figReduced() ? 450 : now - dance.t0 + dance.off));
    if (!figReduced()) dance.raf = requestAnimationFrame(danceLoop);
  }
  function danceStart(fresh) { figColors(); dance.last = ""; if (fresh) { dance.t0 = performance.now(); dance.off = 0; } if (!dance.raf) dance.raf = requestAnimationFrame(danceLoop); }
  $("wl-dance").onclick = function () {
    var t = performance.now() - dance.t0 + dance.off, a = dAt(DSCENES, t);
    dance.off += a.end - t; buzz(6); danceStart();
  };
  document.addEventListener("visibilitychange", function () { if (!document.hidden && !$("s-welcome").hidden) danceStart(); });
  window.addEventListener("resize", function () { if (!$("s-welcome").hidden) { dance.last = ""; danceStart(); } });

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
    weekStart = mondayOf(today); openKey = todayKey;
    var u = cur();
    $("over-prof").textContent = u ? u.name.charAt(0).toUpperCase() : "?";
    render();
    clearTimeout(recapT); recapT = setTimeout(maybeRecap, 700);
  }
  function sorted(ts) {
    return ts.slice().sort(function (a, b) {
      if (a.time && b.time) return a.time < b.time ? -1 : a.time > b.time ? 1 : 0;
      return a.time ? -1 : b.time ? 1 : 0;
    });
  }
  /* unfinished tasks on earlier days of this week, grouped by day. They stay where they are until the user moves them. */
  function missedDays() {
    var nowK = key(new Date()), m = mondayOf(new Date()), out = [];
    for (var i = 0; i < 7; i++) {
      var dk = key(addDays(m, i)); if (dk >= nowK) break;
      var ts = sorted(list(dk)).filter(function (t) { return !t.d; });
      if (ts.length) out.push({ k: dk, i: i, ts: ts });
    }
    return out;
  }
  function missedCount() { return missedDays().reduce(function (n, g) { return n + g.ts.length; }, 0); }
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
      // this week the list starts at today; an earlier day shows up only while it is picked in the strip
      if (dayMiss && !open) return;
      var meta = (isToday ? '<span class="now">IDAG</span> · ' : k === ydK && kind === 0 ? "IGÅR · " : "") + d.getDate() + " " + MON[d.getMonth()] + (mn && !open ? ' · <span class="miss">' + mn + " MISSADE</span>" : ts.length ? " · " + dn + "/" + ts.length : "");
      dh += '<div class="day' + (open ? " open" : "") + (k === flashKey ? " flash" : "") + '"><button class="dayhead" data-head="' + k + '" aria-expanded="' + open + '"><span class="name">' + DAYS[idx] + (isToday ? '<i class="tdot" aria-hidden="true"></i>' : "") + '</span><span class="meta">' + meta + "</span></button>";
      if (open) {
        var allDone = ts.length > 0 && dn === ts.length;
        if (mn) dh += '<div class="missbar">' + mn + " MISSADE · TRYCK → FÖR ATT FLYTTA TILL IDAG</div>";
        if (allDone && !past) dh += '<div class="allclear"><div class="ac-n">0</div><div class="ac-t"><b>ALLT</b><b class="a">KLART</b></div></div><div class="ac-cap">0 KVAR · ' + dn + " / " + ts.length + " KLARA</div>";
        dh += '<ul class="tasks">';
        sorted(ts).forEach(function (t) {
          var ms = dayMiss && !t.d;
          dh += '<li class="task' + (t.d ? " done" : "") + (t.d && t.id === pulseId ? " just" : "") + (ms ? " missed" : "") + '" data-id="' + t.id + '" data-k="' + k + '">' +
            '<button class="chk' + (t.id === pulseId ? " pulse" : "") + '" data-act="tog" aria-label="Klar: ' + esc(t.t) + '" aria-pressed="' + t.d + '"' + (past ? " disabled" : "") + "></button>" +
            '<span class="txt">' + (t.time ? '<span class="tm">' + esc(t.time) + BELL + "</span>" : "") + '<span class="tt" data-notr>' + esc(t.t) + "</span></span>" +
            (past ? "" : (ms ? '<button class="act mvm" data-act="mv" aria-label="Flytta till idag" title="Flytta till idag">→</button>' : "") +
            '<button class="act x" data-act="del" aria-label="Ta bort" title="Ta bort">×</button>' +
            '<button class="swdel" data-act="del" aria-label="Ta bort" tabindex="-1">×</button>') + "</li>";
        });
        dh += "</ul>";
        if (past) {
          if (!ts.length) dh += '<div class="note">INGET PLANERAT</div>';
          dh += '<div class="rofoot">SKRIVSKYDDAD · VECKAN ÄR AVSLUTAD</div></div>';
          return;
        }
        // an earlier day this week keeps its tasks (and missed ones keep →), but takes no new ones
        if (dayMiss) {
          if (!ts.length) dh += '<div class="note">INGET PLANERAT</div>';
          if (dn) dh += '<button class="clear" data-clear="' + k + '">RENSA KLARA</button>';
          dh += "</div>";
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
        dh += '<div class="opts" id="opts-' + k + '" hidden><div class="tpick inline" id="pk-' + k + '"></div></div>';
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
    if (isDesk() && !$("s-over").hidden) renderOver();
    syncMissed();
  }

  function setWeek(ws) {
    weekStart = ws;
    var mk = key(ws), end = key(addDays(ws, 6));
    openKey = (todayKey >= mk && todayKey <= end) ? todayKey : mk > todayKey ? null : mk;
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
    var pk = $("pk-" + k);
    if (pk && !pk.draw) inlinePicker(pk, function () { return pend.k === k ? pend.time : ""; }, function (v) { pendFor(k); pend.time = v; updatePend(k); },
      function () { var n = new Date(); return k === key(n) && n.getHours() < 23 ? pad(n.getHours() + 1) + ":00" : settings.defTime; });
    else if (pk) pk.draw();
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
    var c = e.target.closest("[data-clear]");
    if (c) { clearDone(c.getAttribute("data-clear")); return; }
    var sg = e.target.closest("[data-sug]");
    if (sg) { openKey = push(sg.getAttribute("data-k"), { id: uid(), t: t(sg.getAttribute("data-sug")), d: false }); save(); render(); return; }
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
      if (dayDone && k2 === key(new Date())) { var cb = btn.getBoundingClientRect(); celebrate(cb.left + cb.width / 2, cb.top + cb.height / 2, arr.length); }
      else if (arr[idx].d) cheer(k2);
      save(); render();
      var nc = daysEl.querySelector('.task[data-id="' + id + '"] .chk'); if (nc) nc.focus({ preventScroll: true });
      return;
    }
    if (act === "mv") moveTask(k2, id, key(new Date()));
  });
  daysEl.addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target, k = f.getAttribute("data-k"), inp = f.querySelector("input");
    var p = parseTime(inp.value); if (!p.t) { openAdd(k, "plan"); return; }
    var nt = { id: uid(), t: p.t, d: false };
    if (p.time) nt.time = p.time; else if (pend.k === k && pend.time) nt.time = pend.time;
    pend = { k: null, time: "", rem: false };
    k = push(k, nt); save(); focusKey = openKey = k; render();
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
    to = push(to, g.t); pulseId = g.t.id; save(); render();
    var d = fromKey(to), other = key(mondayOf(d)) !== key(weekStart);
    offerUndo("FLYTTAD TILL " + (to === key(new Date()) ? "IDAG" : DAYS[(d.getDay() + 6) % 7]) + (other ? " · V" + isoWeek(d) : ""),
      function () { var b = takeOut(to, id); if (b) insertAt(k, g.i, b.t); });
  }
  $("undo-b").onclick = function () {
    if (!undoFn) return;
    undoFn(); undoFn = null; save(); render(); if (!$("s-over").hidden) renderOver();
    clearTimeout(undoT); $("undo").hidden = true;
  };

  /* ---------- redigera uppgift ---------- */
  var ed = null, ED_CHIPS = ["09:00", "12:00", "18:00"];
  function openEdit(k, id) {
    var t = list(k).filter(function (x) { return x.id === id; })[0]; if (!t) return;
    ed = { k: k, id: id, day: k, time: t.time || "", done: !!t.d };
    $("ed-title").value = t.t; $("ed-done").checked = ed.done; closePicker($("ed-pick"));
    renderEdit(); $("edit").hidden = false; $("ed-title").focus();
  }
  function closeEdit() { $("edit").hidden = true; ed = null; }
  function renderEdit() {
    var d = fromKey(ed.day), m = mondayOf(d), nowK = key(new Date()), h = "", i;
    $("ed-wk").textContent = "VECKA " + isoWeek(d);
    for (i = 0; i < 7; i++) {
      var dd = addDays(m, i), dk = key(dd);
      h += '<button type="button" class="adday' + (dk === ed.day ? " sel" : "") + '" data-ed="' + dk + '" aria-pressed="' + (dk === ed.day) + '" aria-label="' + DAYS[i] + " " + dd.getDate() + " " + MON[dd.getMonth()] + '"' + (dk < nowK && dk !== ed.k ? ' disabled aria-disabled="true"' : "") + ">" + LET[i] + "</button>";
    }
    $("ed-days").innerHTML = h;
    var other = ed.time && ED_CHIPS.indexOf(ed.time) < 0;
    $("ed-chips").querySelector('[data-et="other"]').textContent = other ? ed.time : "ANNAN";
    Array.prototype.forEach.call($("ed-chips").querySelectorAll("[data-et]"), function (c) {
      var v = c.getAttribute("data-et"), on = v === "other" ? !!other : v === ed.time;
      c.classList.toggle("sel", on); c.setAttribute("aria-pressed", on);
    });
    $("ed-clock").textContent = ed.time || "--:--";
    var di = (d.getDay() + 6) % 7;
    $("ed-cap").textContent = ed.time && !settings.remind ? "PÅMINNELSER AV" : ed.time ? "PÅMINNER DIG " + (ed.day === nowK ? "IDAG" : DAYS[di]) : "INGEN PÅMINNELSE";
    $("ed-cap").classList.toggle("on", !!ed.time && settings.remind);
    // next day, but never a past one: an old task moves to today
    var nx = fromKey(edNext()), from = (fromKey(ed.k).getDay() + 6) % 7;
    $("ed-move-h").textContent = ed.k === nowK ? "FLYTTAR UPPGIFTEN TILL I MORGON. DEN FÖRSVINNER FRÅN IDAG."
      : "FLYTTAR UPPGIFTEN TILL " + (key(nx) === nowK ? "IDAG" : DAYS[(nx.getDay() + 6) % 7]) + ". DEN FÖRSVINNER FRÅN " + DAYS[from] + ".";
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
    var v = c.getAttribute("data-et");
    if (v === "other") { openPicker($("ed-pick"), ed.time, function (t) { if (t && ed) ed.time = t; if (ed) renderEdit(); }); return; }
    closePicker($("ed-pick")); ed.time = v;
    renderEdit();
  });
  $("ed-done").addEventListener("change", function () { ed.done = $("ed-done").checked; });
  $("ed-save").onclick = function () {
    if (pickerOpen($("ed-pick"))) $("ed-pick").confirm();
    var arr = list(ed.k), idx = arr.findIndex(function (t) { return t.id === ed.id; }); if (idx < 0) { closeEdit(); return; }
    var t = arr[idx], v = $("ed-title").value.trim();
    if (v) t.t = v;
    if (ed.time) t.time = ed.time; else delete t.time;
    if (ed.done && !t.d) pulseId = t.id;
    t.d = ed.done;
    if (ed.day !== ed.k) { arr.splice(idx, 1); allTasks()[ed.k] = arr; ed.day = push(ed.day, t); }
    var tk = key(new Date()), doneNow = pulseId === t.id, day = ed.day, finished = doneNow && day === tk && list(tk).every(function (x) { return x.d; });
    save(); closeEdit(); render();
    if (finished) { buzz([8, 70, 8, 70, 8]); celebrate(innerWidth / 2, innerHeight / 2, list(tk).length); }
    else if (doneNow) { buzz(8); cheer(day); }
  };
  function edNext() { return notPast(key(addDays(fromKey(ed.k), 1))); }
  $("ed-move").onclick = function () {
    var k = ed.k, id = ed.id, to = edNext();
    ed.day = ed.k; $("ed-save").click(); moveTask(k, id, to);
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

  /* ---------- missade: a count in the IDAG tile and a sheet to move them, one by one or all at once ---------- */
  function syncMissed() {
    if (!cur()) return;
    var n = missedCount(), b = $("o-miss");
    b.hidden = !n; b.textContent = n + " MISSADE";
    if (!$("missed").hidden) renderMissed();
  }
  function renderMissed() {
    var g = missedDays(), n = 0, h = "";
    if (!g.length) { closeMissed(); return; }
    g.forEach(function (day) {
      var d = fromKey(day.k);
      h += '<div class="mi-day"><span class="t-l">' + DAYS[day.i] + " · " + d.getDate() + " " + MON[d.getMonth()] + "</span>";
      day.ts.forEach(function (t) {
        n++;
        h += '<div class="mi-row"><span class="tt">' + (t.time ? '<span class="tm">' + esc(t.time) + " </span>" : "") + '<span data-notr>' + esc(t.t) + "</span></span>" +
          '<button class="act mvm" data-mi="' + day.k + '" data-id="' + t.id + '" aria-label="Flytta till idag: ' + esc(t.t) + '">→</button></div>';
      });
      h += "</div>";
    });
    $("mi-list").innerHTML = h;
    $("mi-n").textContent = n;
    $("mi-s").textContent = "FRÅN TIDIGARE DAGAR · VECKA " + isoWeek(new Date());
  }
  function openMissed() { renderMissed(); $("missed").hidden = false; $("mi-close").focus(); }
  function closeMissed() { $("missed").hidden = true; }
  $("o-miss").onclick = openMissed;
  $("mi-close").onclick = closeMissed;
  $("missed").addEventListener("click", function (e) {
    if (e.target === $("missed")) { closeMissed(); return; }
    var b = e.target.closest("[data-mi]"); if (!b) return;
    moveTask(b.getAttribute("data-mi"), b.getAttribute("data-id"), key(new Date()));
    renderOver();
  });
  // one action, one undo: every missed task goes to today and ÅNGRA puts each back on its own day and place
  $("mi-all").onclick = function () {
    var nowK = key(new Date()), gone = [];
    missedDays().forEach(function (day) { day.ts.forEach(function (t) { var g = takeOut(day.k, t.id); if (g) { gone.push({ k: day.k, i: g.i, t: g.t }); push(nowK, g.t); } }); });
    if (!gone.length) return;
    save(); closeMissed(); render(); renderOver();
    offerUndo(gone.length + " FLYTTADE TILL IDAG", function () {
      gone.slice().reverse().forEach(function (g) { var b = takeOut(nowK, g.t.id); if (b) insertAt(g.k, g.i, b.t); });
    });
  };
  swipeDown(document.querySelector("#missed .panel"), closeMissed);

  /* ---------- lägg till ---------- */
  var addKey = null, addFrom = "plan", addTime = "";
  function openAdd(k, from) {
    var nowK = key(new Date());
    addKey = k < nowK ? nowK : k; addFrom = from; addTime = "";
    $("s-over").hidden = true; $("s-home").hidden = true;
    var s = $("s-add"); s.hidden = false; document.body.classList.add("adding");
    setTabsVisible(true); window.scrollTo(0, 0);
    s.classList.remove("slidein"); void s.offsetWidth; s.classList.add("slidein");
    $("ad-inp").value = ""; setAdClock(false);
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
      h += '<button type="button" class="adday' + (dk === addKey ? " sel" : "") + '" data-ad="' + dk + '" aria-pressed="' + (dk === addKey) + '" aria-label="' + DAYS[i] + " " + dd.getDate() + " " + MON[dd.getMonth()] + '"' + (dk < nowK ? ' disabled aria-disabled="true"' : "") + ">" + LET[i] + "</button>";
    }
    $("ad-days").innerHTML = h;
  }
  /* the time box stays hidden until the clock icon is pressed; a chosen time shows next to the icon */
  function setAdClock(open) {
    $("ad-tp").hidden = !open; $("ad-clock").classList.toggle("on", open); $("ad-clock").setAttribute("aria-expanded", open);
    if (open) $("ad-tp").scrollIntoView({ block: "nearest", behavior: reduceMq && reduceMq.matches ? "auto" : "smooth" });
  }
  function adTval() {
    var at = addTime || parseTime($("ad-inp").value).time, v = $("ad-tval");
    v.textContent = at || "LÄGG TILL PÅMINNELSE"; v.classList.toggle("set", !!at); $("ad-clock").classList.toggle("has", !!at);
  }
  function addChips() { if ($("ad-tp").draw) $("ad-tp").draw(); adTval(); }
  $("ad-clock").onclick = function () { setAdClock($("ad-tp").hidden); };
  function addStart() { var n = new Date(); return addKey === key(n) && n.getHours() < 23 ? pad(n.getHours() + 1) + ":00" : settings.defTime; }
  inlinePicker($("ad-tp"), function () { return addTime || parseTime($("ad-inp").value).time; }, function (v) { addTime = v; adTval(); }, addStart);
  $("ad-back").onclick = closeAdd;
  $("ad-today").onclick = function () { addKey = key(new Date()); renderAdd(); $("ad-inp").focus(); };
  $("ad-days").addEventListener("click", function (e) {
    var b = e.target.closest("[data-ad]"); if (!b || b.disabled) return;
    addKey = b.getAttribute("data-ad"); renderAdd(); $("ad-inp").focus();
  });
  $("ad-inp").addEventListener("input", addChips);
  $("f-add").addEventListener("submit", function (e) {
    e.preventDefault();
    var inp = $("ad-inp"), p = parseTime(inp.value); if (!p.t) { inp.focus(); return; }
    var nt = { id: uid(), t: p.t, d: false };
    if (addTime || p.time) nt.time = addTime || p.time;
    addKey = push(addKey, nt); save(); inp.value = ""; addTime = ""; setAdClock(false);
    /* back to the day the task was made, with the new task pulsing */
    weekStart = mondayOf(fromKey(addKey)); openKey = addKey; pulseId = nt.id;
    setTab("plan"); scrollOpenDay(); buzz(8);
    toast(nt.time ? "TILLAGD · " + nt.time : "TILLAGD");
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
    Array.prototype.forEach.call(document.querySelectorAll("[data-set-lang]"), function (b) {
      var on = b.getAttribute("data-set-lang") === settings.lang; b.classList.toggle("on", on); b.setAttribute("aria-checked", on);
    });
    $("st-rem").setAttribute("aria-checked", settings.remind);
    $("st-def").textContent = settings.defTime;
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
  Array.prototype.forEach.call(document.querySelectorAll("[data-set-lang]"), function (b) {
    b.onclick = function () {
      if (settings.lang === b.getAttribute("data-set-lang")) return;
      settings.lang = b.getAttribute("data-set-lang"); saveSettings(); applyLang();
      /* re-render everything visible so dynamic text follows the new language */
      renderSettings(); applyTheme();
      if (document.body.classList.contains("home")) { if (!$("s-add").hidden) renderAdd(); else setTab(tab); }
      if (ed) renderEdit();
      if (!cal.hidden) renderCal();
    };
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-acc]"), function (b) {
    b.onclick = function () { settings.accent = b.getAttribute("data-acc"); applyTheme(); saveSettings(); };
  });
  $("st-rem").onclick = function () { settings.remind = !settings.remind; applyTheme(); saveSettings(); renderSettings(); };
  $("st-def").onclick = function () {
    openPicker($("st-pick"), settings.defTime, function (t) { if (t) { settings.defTime = t; saveSettings(); } renderSettings(); $("st-def").focus(); });
  };
  $("st-out").onclick = function () { state.session = null; save(); $("settings").hidden = true; show("welcome"); toast("DU ÄR UTLOGGAD"); };

  /* ---------- calendar ---------- */
  var cal = $("cal"), calMonth = null;
  function monthOfWeek() { var th = addDays(weekStart, 3); return new Date(th.getFullYear(), th.getMonth(), 1); }
  function renderCal() {
    document.querySelector(".calhead").innerHTML = "<span>" + (isEn() ? "W" : "V") + "</span>" + LET.map(function (l) { return "<span>" + l + "</span>"; }).join("");
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
    if (!$("party").hidden) endParty(); else if (!$("recap").hidden) closeRecap(); else if (!$("edit").hidden) closeEdit(); else if (!$("missed").hidden) closeMissed(); else if (!$("settings").hidden) closeSettings(); else if (!cal.hidden) closeCal(); else if (!$("s-add").hidden) closeAdd();
  });

  /* ---------- figur: a 9x9 dot-matrix companion next to the name ----------
     each figure maps time (ms) to 81 dots: 0 empty (not drawn), 1 on (fg), 2 accent */
  var FN = 9;
  function fgrid() { return new Uint8Array(FN * FN); }
  function fput(g, x, y, v) { if (x >= 0 && y >= 0 && x < FN && y < FN && g[y * FN + x] < v) g[y * FN + x] = v; }
  /* pixel art rows: "x" on (fg), "o" accent, anything else off */
  function fart(g, rows, dx, dy) {
    for (var y = 0; y < rows.length; y++) for (var x = 0; x < rows[y].length; x++) {
      var ch = rows[y].charAt(x);
      if (ch === "x") fput(g, x + (dx || 0), y + (dy || 0), 1); else if (ch === "o") fput(g, x + (dx || 0), y + (dy || 0), 2);
    }
  }
  function fpose(rows) { var g = fgrid(); fart(g, rows, 0, 0); return g; }

  /* PERSON: jumping jacks with orange hands, then a wave */
  var P_STAND = ["...xxx...", "...xxx...", "..xxxxx..", ".x..x..x.", ".o..x..o.", "....x....", "...x.x...", "...x.x...", "...x.x..."];
  var P_JUMP = ["o..xxx..o", ".x.xxx.x.", "..xxxxx..", "....x....", "....x....", "...x.x...", "..x...x..", ".x.....x.", "........."];
  var P_WAVE1 = ["...xxx.o.", "...xxx.x.", "..xxxxx..", ".x..x....", ".o..x....", "....x....", "...x.x...", "...x.x...", "...x.x..."];
  var P_WAVE2 = ["...xxx..o", "...xxx.x.", "..xxxxx..", ".x..x....", ".o..x....", "....x....", "...x.x...", "...x.x...", "...x.x..."];
  function figPerson(t) {
    var c = t % 5200;
    if (c < 2800) return fpose(Math.floor(c / 280) % 2 ? P_JUMP : P_STAND);
    if (c < 4600) return fpose(Math.floor(c / 220) % 2 ? P_WAVE2 : P_WAVE1);
    return fpose(P_STAND);
  }

  /* HUND: trots with a wagging orange tail, stops to pant with an orange tongue */
  var D_TROT1 = [".........", ".....x...", "o....xx..", ".x...xxxx", "..xxxxx..", "..xxxxx..", "..x...x..", ".x.....x.", "........."];
  var D_TROT2 = [".........", ".....x...", ".....xx..", ".x...xxxx", "o.xxxxx..", "..xxxxx..", "..x...x..", "...x.x...", "........."];
  var D_PANT1 = [".........", ".....x...", "o....xx..", ".x...xxxx", "..xxxxx.o", "..xxxxx..", "..x...x..", "..x...x..", "........."];
  var D_PANT2 = [".........", ".....x...", ".....xx..", ".x...xxxx", "o.xxxxx..", "..xxxxx..", "..x...x..", "..x...x..", "........."];
  function figDog(t) {
    var c = t % 4800;
    if (c < 2880) { var s = Math.floor(c / 160); return fpose(s % 2 ? D_TROT2 : D_TROT1); }
    return fpose(Math.floor(c / 200) % 2 ? D_PANT2 : D_PANT1);
  }

  /* ROBOT: a head rising from behind the card; eyes glance around in steps and blink,
     the orange antenna leans with the gaze, the mouth lights orange when it talks and smiles */
  var GAZE = [[0, 0], [-1, 0], [-1, 0], [0, 0], [1, 0], [1, -1], [0, 0], [0, 0]];
  function figRobot(t) {
    var g = fgrid(), c = t % 6400, ph = Math.floor(c / 800), p = GAZE[ph], blink = c % 3200 > 3060, x;
    [2, 5].forEach(function (ex) {
      fput(g, ex + p[0], 3 + p[1], 1); fput(g, ex + 1 + p[0], 3 + p[1], 1);
      if (!blink) { fput(g, ex + p[0], 2 + p[1], 1); fput(g, ex + 1 + p[0], 2 + p[1], 1); }
    });
    if (ph === 6) { fput(g, 2, 4, 2); fput(g, 6, 4, 2); for (x = 3; x <= 5; x++) fput(g, x, 5, 1); }
    else if (ph === 4 && Math.floor(t / 150) % 2) { for (x = 3; x <= 5; x++) { fput(g, x, 4, 2); fput(g, x, 5, 2); } }
    else for (x = 3; x <= 5; x++) fput(g, x, 5, 1);
    for (x = 1; x <= 7; x++) fput(g, x, 7, 1);
    fput(g, 4, 6, 1); fput(g, 4, 1, 1); fput(g, 4 + p[0], 0, 2);
    return g;
  }
  /* KATT: orange eyes that look around and blink slowly, an ear that twitches */
  var CAT = [".x.....x.", ".xx...xx.", ".xxxxxxx.", ".x.....x.", ".x.....x.", "xx..x..xx", ".x.x.x.x.", "x.xxxxx.x", "........."];
  var CAT_LOOK = [0, -1, -1, 0, 1, 1, 0, 0];
  function figCat(t) {
    var g = fgrid(), c = t % 6400, ph = Math.floor(c / 800), lx = CAT_LOOK[ph], blink = c % 3200 > 3000;
    fart(g, CAT, 0, 0);
    if (ph === 6 && c % 800 < 300) { g[1] = 0; fput(g, 0, 1, 1); }
    fput(g, 3 + lx, 4, blink ? 1 : 2); fput(g, 5 + lx, 4, blink ? 1 : 2);
    return g;
  }

  /* FÅGEL: flaps in four mechanical beats and bobs with them; wind dots stream past; orange eye and beak */
  var B_WING = [[[4, 3], [3, 2], [2, 1]], [[3, 3], [2, 3]], [[3, 6], [2, 7]], [[3, 3], [2, 3]]];
  function figBird(t) {
    var g = fgrid(), f = Math.floor(t / 130) % 4, dy = f === 2 ? 1 : f === 0 ? -1 : 0, w = Math.floor(t / 70), i;
    for (i = 0; i < 2; i++) { var x = 8 - ((w + i * 6) % 12); fput(g, x, 1 + i * 6, 1); fput(g, x + 1, 1 + i * 6, 1); }
    fart(g, ["x....xo..", ".xxxxxxo.", "x..xxx..."], 0, 3 + dy);
    B_WING[f].forEach(function (p) { fput(g, p[0], p[1] + dy, 1); });
    return g;
  }
  var FIGS = [["PERSON", figPerson], ["HUND", figDog], ["ROBOT", figRobot], ["KATT", figCat], ["FÅGEL", figBird]];
  var fig = { from: -1, t0: 0, raf: 0, last: "", col: null };
  function figReduced() { return !!(reduceMq && reduceMq.matches); }
  function figColors() {
    if (!fig) return;
    var s = getComputedStyle(document.documentElement);
    fig.col = [s.getPropertyValue("--dot-off").trim(), s.getPropertyValue("--fg").trim(), s.getPropertyValue("--accent").trim()];
    fig.last = "";
  }
  function figFrame(now) {
    var t = figReduced() ? 1600 : now, g = FIGS[settings.figure][1](t), p, o, x, y, d;
    if (fig.from >= 0) {
      p = (now - fig.t0) / 320;
      if (p >= 1 || figReduced()) fig.from = -1;
      else {
        o = FIGS[fig.from][1](t);
        for (y = 0; y < FN; y++) for (x = 0; x < FN; x++) { d = (x + y) / 16 * 0.85; if (p < d) g[y * FN + x] = o[y * FN + x]; else if (p < d + 0.15) g[y * FN + x] = 1; }
      }
    }
    g[7 * FN + 7] = g[7 * FN + 8] = 0; // these would peek out through the card's rounded corner
    var k = g.join("");
    if (k === fig.last) return;
    fig.last = k;
    var cv = $("o-fig-c"), S = 120, dpr = window.devicePixelRatio || 1, pitch = S / FN, rad = pitch * 0.37, ctx, i;
    if (cv.width !== Math.round(S * dpr)) { cv.width = cv.height = Math.round(S * dpr); }
    ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, S, S);
    for (i = 1; i < 3; i++) {
      ctx.fillStyle = fig.col[i]; ctx.beginPath();
      for (y = 0; y < FN; y++) for (x = 0; x < FN; x++) if (g[y * FN + x] === i) { ctx.moveTo(pitch * (x + 0.5) + rad, pitch * (y + 0.5)); ctx.arc(pitch * (x + 0.5), pitch * (y + 0.5), rad, 0, 2 * Math.PI); }
      ctx.fill();
    }
  }
  function figLoop(now) {
    fig.raf = 0;
    if ($("s-over").hidden || document.hidden) return;
    figFrame(now);
    if (!figReduced() || fig.from >= 0) fig.raf = requestAnimationFrame(figLoop);
  }
  function figStart() {
    if (!fig.col) figColors();
    $("o-fig").setAttribute("aria-label", "Figur: " + FIGS[settings.figure][0].toLowerCase() + ". Tryck för nästa figur");
    if (!fig.raf) fig.raf = requestAnimationFrame(figLoop);
  }
  $("o-fig").onclick = function () {
    fig.from = settings.figure; fig.t0 = performance.now();
    settings.figure = (settings.figure + 1) % FIGS.length; saveSettings(); buzz(6); figStart();
  };

  /* ---------- allt klart: a dot-matrix takeover when today's last task is done ----------
     a ring of dots ripples out from the tapped checkbox (orange front, fg wake, dim field behind), then the
     dancer from the start screen does a victory dance on a dot floor while dot confetti rains down,
     and ALLT KLART rises in under it. Tap anywhere to close. */
  var party = { raf: 0, t0: 0, ox: 0, oy: 0, end: 0, conf: [] };
  var PP = 18, PARTY_SCENES = [{ ms: 1e9, beat: 380, seq: ["vup", "squat", "vup", "squat", "point", "down", "point2", "down2", "star", "shut", "star", "shut"] }];
  function partyDraw(t) {
    var cv = $("party-c"), dpr = window.devicePixelRatio || 1, W = innerWidth, H = innerHeight, ctx = cv.getContext("2d");
    var col = fig.col || [], cols = Math.ceil(W / PP) + 1, rows = Math.ceil(H / PP) + 1, x0 = (W % PP) / 2, y0 = (H % PP) / 2;
    var cx = Math.round((W / 2 - x0) / PP), floor = Math.round((H * 0.56 - y0) / PP), r = t * 1.5, paths = [[], [], []], i, j, d, k;
    function dot(gx, gy, lvl, rad) { paths[lvl].push(x0 + gx * PP, y0 + gy * PP, rad); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = Math.min(1, t / 260); ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--bg"); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    for (j = 0; j < rows; j++) for (i = 0; i < cols; i++) {
      d = Math.hypot(x0 + i * PP - party.ox, y0 + j * PP - party.oy); k = r - d;
      if (k < 0) continue;
      if (k < 36) dot(i, j, 2, 3.4); else if (k < 150) dot(i, j, 1, 3.2 - (k - 36) / 114 * 1.2); else dot(i, j, 0, 2);
    }
    var dt = t - 550;
    if (dt >= 0) {
      var dj = dJoints(PARTY_SCENES, dt), pop = dt < 180 ? 0.6 + 0.4 * dt / 180 : 1, seen = {};
      dSkeleton(dj.J, function (x, y, lvl) { var gx = cx - 7 + x, gy = floor - 16 + y, id = gx + "," + gy; if (seen[id] >= lvl) return; seen[id] = lvl; dot(gx, gy, lvl === 3 ? 2 : 1, (lvl === 3 ? 5 : 4.4) * pop); });
      var fx = cx - 7 + (dj.J.lf[0] + dj.J.rf[0]) / 2, front = dj.p * 26;
      for (i = cx - 13; i <= cx + 13; i++) { d = Math.abs(i - fx); dot(i, floor, Math.abs(d - front) < 0.8 && dj.p < 0.6 ? 2 : d < front && d > front - 6 && dj.p < 0.6 ? 1 : 0, 3.4); }
      party.conf.forEach(function (c) {
        var ct = dt - c.delay; if (ct < 0) return;
        var gy = Math.round(c.row + ct * c.speed / 1000), gx = c.col + (Math.floor(ct / 260) % 2 ? c.sway : 0);
        if (gy >= rows || (gx >= cx - 8 && gx <= cx + 8 && gy >= floor - 17 && gy <= floor)) return;
        dot(gx, gy, c.lvl, c.lvl === 2 ? 3.6 : 2.6);
      });
    }
    for (k = 0; k < 3; k++) {
      if (!paths[k].length) continue;
      ctx.fillStyle = col[k] || "#888"; ctx.beginPath();
      for (i = 0; i < paths[k].length; i += 3) { ctx.moveTo(paths[k][i] + paths[k][i + 2], paths[k][i + 1]); ctx.arc(paths[k][i], paths[k][i + 1], paths[k][i + 2], 0, 2 * Math.PI); }
      ctx.fill();
    }
    $("party-t").style.top = (y0 + (floor + 2) * PP) + "px";
    if (t > 900) $("party-t").classList.add("show");
  }
  function partyFrame(now) {
    var t = now - party.t0;
    partyDraw(t);
    if (t > 4600) { endParty(); return; }
    party.raf = requestAnimationFrame(partyFrame);
  }
  function celebrate(ox, oy, n) {
    var el = $("party"), cv = $("party-c"), dpr = window.devicePixelRatio || 1;
    if (!fig.col) figColors();
    cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
    party.ox = ox; party.oy = oy; party.t0 = performance.now();
    var gcols = Math.ceil(innerWidth / PP); party.conf = [];
    for (var c = 0; c < Math.min(70, gcols * 2); c++) party.conf.push({ col: Math.floor(Math.random() * gcols), row: -Math.floor(Math.random() * 12), speed: 9 + Math.random() * 10, delay: 150 + Math.random() * 1600, sway: Math.random() < .5 ? -1 : 1, lvl: Math.random() < .45 ? 2 : 1 });
    $("party-s").textContent = "IDAG · " + n + " / " + n + " KLARA";
    $("party-t").classList.remove("show"); el.classList.remove("out"); el.hidden = false;
    cancelAnimationFrame(party.raf);
    if (figReduced()) { partyDraw(10000); clearTimeout(party.end); party.end = setTimeout(endParty, 1800); return; }
    party.raf = requestAnimationFrame(partyFrame);
  }
  function endParty() {
    var el = $("party"); if (el.hidden) return;
    cancelAnimationFrame(party.raf); clearTimeout(party.end);
    el.classList.add("out");
    party.end = setTimeout(function () { el.hidden = true; el.classList.remove("out"); }, 300);
  }
  $("party").onclick = endParty;

  /* ---------- veckan som gick: once per week, a short look back at last week, then into planning ---------- */
  var recapT = null;
  function maybeRecap() {
    if (!cur() || !$("s-welcome").hidden || !$("party").hidden) return;
    var pm = addDays(mondayOf(new Date()), -7), pk = key(pm), seen = settings.recap || {}, days = [], tot = 0, dn = 0, best = -1, bestN = 0, i;
    if (seen[state.session] === pk) return;
    for (i = 0; i < 7; i++) { var ts = list(key(addDays(pm, i))), d = ts.filter(function (t) { return t.d; }).length; days.push(ts); tot += ts.length; dn += d; if (d > bestN) { bestN = d; best = i; } }
    if (!tot) return;
    seen[state.session] = pk; settings.recap = seen; saveSettings();
    $("rc-wk").textContent = "VECKA " + isoWeek(pm);
    $("rc-n").textContent = dn; $("rc-of").textContent = "/ " + tot + " KLARA";
    $("rc-best").textContent = best < 0 ? "INGEN" : DAYS[best];
    $("rc-pct").textContent = Math.round(dn / tot * 100) + "%";
    $("rc-go-t").textContent = "PLANERA VECKA " + isoWeek(new Date());
    var h = "";
    days.forEach(function (ts, c) {
      h += '<div class="rc-col">';
      ts.slice(0, 8).forEach(function (t, j) { h += '<i class="' + (t.d ? "on" : "") + '" style="animation-delay:' + (300 + c * 90 + j * 45) + 'ms"></i>'; });
      if (!ts.length) h += '<i class="ring" style="animation-delay:' + (300 + c * 90) + 'ms"></i>';
      h += '<span>' + LET[c] + "</span></div>";
    });
    $("rc-cols").innerHTML = h;
    $("recap").hidden = false; $("rc-close").focus();
  }
  function closeRecap() { $("recap").hidden = true; }
  $("rc-close").onclick = closeRecap;
  $("rc-go").onclick = function () { closeRecap(); goPlanToday(false); };

  /* ---------- a small cheer for every finished task: a dot person jumps for joy in a pill above the tab bar ---------- */
  var CHEERS = ["SNYGGT!", "BRA JOBBAT!", "EN MINDRE!", "TOPPEN!", "KLART!"], CHEER_SCENES = [{ ms: 1e9, beat: 300, seq: ["vup", "squat", "vup", "squat", "star", "shut"] }];
  var cheerS = { raf: 0, t0: 0, end: 0, n: 0 };
  function cheerDraw(t) {
    var cv = $("cheer-c"), W = 60, H = 68, dpr = window.devicePixelRatio || 1, p = 4, ctx = cv.getContext("2d"), cs = getComputedStyle(document.documentElement), paths = { 2: [], 3: [] }, seen = {};
    if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
    dSkeleton(dJoints(CHEER_SCENES, t).J, function (x, y, l) { var id = x + "," + y; if (seen[id] >= l) return; seen[id] = l; paths[l].push(x, y); });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    [[2, cs.getPropertyValue("--bg")], [3, cs.getPropertyValue("--accent")]].forEach(function (c) {
      ctx.fillStyle = c[1]; ctx.beginPath();
      for (var i = 0; i < paths[c[0]].length; i += 2) { var x = p * (paths[c[0]][i] + .5), y = p * (paths[c[0]][i + 1] + .5); ctx.moveTo(x + 1.6, y); ctx.arc(x, y, 1.6, 0, 2 * Math.PI); }
      ctx.fill();
    });
  }
  function cheerLoop(now) { cheerS.raf = 0; if ($("cheer").hidden) return; cheerDraw(now - cheerS.t0); cheerS.raf = requestAnimationFrame(cheerLoop); }
  function cheer(k) {
    var left = list(k).filter(function (x) { return !x.d; }).length, d = fromKey(k);
    $("cheer-b").textContent = CHEERS[cheerS.n++ % CHEERS.length];
    $("cheer-s").textContent = !left ? "ALLT KLART · " + DAYS[(d.getDay() + 6) % 7] : k === key(new Date()) ? left + " KVAR IDAG" : left + " KVAR · " + DAYS[(d.getDay() + 6) % 7];
    $("undo").hidden = true; $("toast").hidden = true;
    var el = $("cheer"); el.hidden = false; el.classList.remove("in"); void el.offsetWidth; el.classList.add("in");
    cheerS.t0 = performance.now(); cancelAnimationFrame(cheerS.raf);
    if (figReduced()) cheerDraw(150); else cheerS.raf = requestAnimationFrame(cheerLoop);
    clearTimeout(cheerS.end); cheerS.end = setTimeout(function () { el.hidden = true; cancelAnimationFrame(cheerS.raf); }, 2200);
  }

  /* ---------- keep "today" true when the app stays open past midnight ---------- */
  function tick() {
    if (!cur() || $("s-over").hidden && $("s-home").hidden && $("s-add").hidden) return;
    var nk = key(new Date());
    if (nk !== todayKey) {
      var wasCurrent = key(weekStart) === key(mondayOf(fromKey(todayKey)));
      todayKey = nk;
      if (wasCurrent) { weekStart = mondayOf(new Date()); openKey = todayKey; }
      render(); if (!$("s-add").hidden) renderAdd();
    }
    if (!$("s-over").hidden) renderOver();
  }
  setInterval(tick, 60000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) tick(); });

  /* ---------- start ---------- */
  load(); loadSettings(); applyLang(); applyTheme();
  show(cur() ? "home" : "welcome");
  ensureDemo();
})();
