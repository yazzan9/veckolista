/* One timeline for picture and sound. Times are seconds, on a 120 bpm grid (one beat = 0.5 s).
   Loaded by stage.html (window.TL) and by render.js / audio.js (require). */
(function (root) {
  var BPM = 120, BEAT = 60 / BPM, DUR = 46;

  /* things the script does inside the real app. sel is a selector in the app document.
     tap: a visible tap (ring) plus click; focus: tap an input; type: keystrokes into the focused field */
  var A = [];
  function tap(t, sel, o) { A.push(Object.assign({ t: t, act: "tap", sel: sel }, o || {})); }
  function type(t, text, step) { for (var i = 0; i < text.length; i++) A.push({ t: +(t + i * step).toFixed(4), act: "key", ch: text[i] }); }

  // start screen: name, go
  tap(6.0, "#wl-name", { focus: true });
  type(6.25, "Maya", 0.125);
  tap(7.5, ".nb-go");
  // figure: three changes
  tap(10.0, "#o-fig"); tap(10.75, "#o-fig"); tap(11.5, "#o-fig");
  // quote: three new quotes
  tap(12.75, "#o-qnext"); tap(13.5, "#o-qnext"); tap(14.25, "#o-qnext");
  // a task with a reminder
  tap(15.5, "#o-add");
  tap(16.25, "#ad-inp", { focus: true });
  type(16.5, "Pick up film photos", 0.0625);
  tap(18.0, "#ad-clock");
  tap(18.75, '#ad-tp [data-tpv="h"]', { focus: true });
  type(19.0, "14", 0.125); type(19.375, "30", 0.125);
  tap(20.25, ".ad-go");
  // a short scroll so the whole day sits above the tab bar
  A.push({ t: 20.5, act: "scroll", sel: "#s-home .day.open", d: 0.5, clear: 120 });
  // tick them off, the last one is the victory
  tap(22.5, "#s-home .day.open .task:not(.done) .chk", { cheer: true });
  tap(24.0, "#s-home .day.open .task:not(.done) .chk", { cheer: true });
  tap(25.5, "#s-home .day.open .task:not(.done) .chk", { victory: true });
  // back to the overview, all done
  tap(30.5, '.tab[data-tab="over"]');
  // accents
  tap(33.0, "#over-prof");
  var ACCS = ["rosa", "korall", "mint", "lime", "bla", "mono"];
  ACCS.forEach(function (a, i) { tap(34.0 + i * 0.5, '#settings [data-acc="' + a + '"]', { swatch: i }); });
  tap(37.25, '#settings [data-acc="orange"]', { swatch: 6 });
  tap(37.75, "#st-done");
  // light and dark
  tap(38.75, "#s-over .themebtn", { theme: "dark" });
  tap(40.0, "#s-over .themebtn", { theme: "light" });

  /* camera: s = stage px per app px, (cx, cy) = app point placed at stage (ax, ay).
     sel = frame that element instead, pad = extra app px around it. d = move time, ending at t. */
  var WIDE = { s: 0.58, cx: 195, cy: 422, ax: 270, ay: 410 };
  var C = [
    { t: 0, s: 0.58, cx: 195, cy: 422, ax: 270, ay: 1120 },
    { t: 4.0, s: 0.58, cx: 195, cy: 422, ax: 270, ay: 1120 },
    Object.assign({ t: 5.0, d: 1.0 }, WIDE),
    { t: 6.0, d: 0.75, s: 0.80, cx: 195, cy: 560, ax: 270, ay: 420 },
    { t: 8.25, d: 0.75, s: 0.62, cx: 195, cy: 422, ax: 270, ay: 410 },
    { t: 9.75, d: 0.5, s: 1.35, sel: "#s-over .greet", ax: 262, ay: 400 },
    { t: 12.5, d: 0.5, s: 1.15, sel: "#o-qtile", ay: 430 },
    { t: 15.25, d: 0.5, s: 1.05, sel: "#o-idag", ay: 430 },
    { t: 16.0, d: 0.5, s: 0.95, sel: "#f-add", ay: 400 },
    { t: 20.75, d: 0.5, s: 0.92, sel: "#s-home .day.open", ay: 420 },
    { t: 25.5, d: 0.0, s: 0.92, sel: "#s-home .day.open", ay: 420, hold: true },
    Object.assign({ t: 25.9, d: 0.4 }, WIDE, { s: 0.6 }),
    Object.assign({ t: 30.1, d: 4.2 }, WIDE, { s: 0.66, ay: 400 }),
    { t: 31.25, d: 0.5, s: 1.1, sel: "#o-idag", ay: 420 },
    Object.assign({ t: 33.25, d: 0.5 }, WIDE),
    { t: 33.9, d: 0.5, s: 1.3, sel: "#settings .st-row.stack", ay: 430 },
    Object.assign({ t: 38.25, d: 0.5 }, WIDE),
    Object.assign({ t: 40.5, d: 0.5 }, WIDE, { s: 0.6 }),
    Object.assign({ t: 41.25, d: 0.75 }, WIDE, { s: 0.52, ay: 1150 })
  ];

  /* on-screen copy: k = small mono label, h = headline lines */
  var CAP = [
    { t: 5.25, out: 7.75, k: "01 / START", h: ["NO SIGN UP.", "JUST YOUR NAME."] },
    { t: 8.25, out: 9.6, k: "02 / OVERVIEW", h: ["YOUR DAY", "AT A GLANCE."] },
    { t: 9.75, out: 12.25, k: "03 / FIGURE", h: ["PICK YOUR", "DOT BUDDY."] },
    { t: 12.5, out: 15.0, k: "04 / QUOTE", h: ["A LITTLE", "PUSH A DAY."] },
    { t: 15.5, out: 17.9, k: "05 / ADD", h: ["WRITE IT", "DOWN."] },
    { t: 18.0, out: 20.6, k: "05 / REMINDER", h: ["A TIME IS", "A REMINDER."] },
    { t: 20.75, out: 22.25, k: "06 / PLAN", h: ["ON THE DAY", "IT BELONGS."] },
    { t: 22.5, out: 25.25, k: "06 / DONE", h: ["TICK IT", "OFF."] },
    { t: 26.5, out: 30.0, k: "06 / ALL DONE", h: ["FINISH THE DAY.", "GET A DANCE."], big: true },
    { t: 31.25, out: 32.9, k: "06 / 4 OF 4", h: ["NOTHING", "LEFT TODAY."] },
    { t: 33.5, out: 37.6, k: "07 / ACCENT", h: ["SEVEN", "ACCENTS."] },
    { t: 38.25, out: 38.7, k: "08 / THEME", h: ["LIGHT."] },
    { t: 38.75, out: 40.0, k: "08 / THEME", h: ["DARK."] },
    { t: 40.0, out: 41.0, k: "08 / THEME", h: ["YOUR CALL."] }
  ];

  /* sound cues that are not taps or keys (those come from A) */
  var CUES = [
    { t: 0.0, k: "intro" },
    { t: 4.0, k: "rise" },
    { t: 5.0, k: "land" },
    { t: 7.5, k: "go" },
    { t: 15.5, k: "sheet" },
    { t: 23.75, k: "riser", len: 1.75 },
    { t: 25.5, k: "impact" },
    { t: 33.0, k: "sheet" },
    { t: 41.25, k: "drop" },
    { t: 42.0, k: "end" }
  ];

  var TL = { BPM: BPM, BEAT: BEAT, DUR: DUR, actions: A, cam: C, caps: CAP, cues: CUES, ACCS: ACCS,
    seed: { date: "2026-10-29T09:20:00", name: "Maya" } };
  if (typeof module !== "undefined") module.exports = TL; else root.TL = TL;
})(this);
