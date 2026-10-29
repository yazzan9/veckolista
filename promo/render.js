/* Renders the film from the real app.
   node render.js --preview          540x675, 30 fps, quick check
   node render.js --stills 6,26.4    full-size key frames into out/stills
   node render.js                    1080x1350, 60 fps, plus the 1080x1080 cut
   Edge runs headless with a fake clock: every frame the script advances time by exactly one frame,
   so timers, requestAnimationFrame canvases and CSS animations in the app all land on the same timeline. */
const http = require("http"), fs = require("fs"), path = require("path"), { spawn } = require("child_process");
const { chromium } = require("playwright-core");
const FFMPEG = require("ffmpeg-static");
const TL = require("./timeline");
const { writeAudio } = require("./audio");

const ROOT = path.resolve(__dirname, ".."), OUT = path.join(__dirname, "out");
const EDGE = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe"].find(fs.existsSync);
const arg = process.argv.slice(2), PREVIEW = arg.includes("--preview"), si = arg.indexOf("--stills");
const STILLS = si >= 0 ? arg[si + 1].split(",").map(Number) : null;
const FPS = PREVIEW || STILLS ? 30 : 60, DSF = PREVIEW ? 1 : 2;
const ei = arg.indexOf("--end"), END = STILLS ? Math.max(...STILLS) + 2 / FPS : ei >= 0 ? +arg[ei + 1] : TL.DUR;

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json" };
function serve() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]); if (p === "/") p = "/index.html";
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => srv.listen(0, "127.0.0.1", () => r(srv)));
}

/* demo data: Yazan's week 44. Runs in every frame before any page script; only the app frame is touched. */
function initScript(seed) {
  if (location.pathname.indexOf("/promo/") === 0) return;
  let s = 20261029; Math.random = function () { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const sv = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (o) { return sv.call(this, o && typeof o === "object" ? Object.assign({}, o, { behavior: "auto" }) : o); };
  // the second phone (#dash) shows the overview as it looks after the victory, in its own in-memory storage
  const dash = location.hash === "#dash", id = "namn:" + seed.name.toLowerCase();
  if (dash) {
    const mem = {};
    Storage.prototype.getItem = function (k) { return k in mem ? mem[k] : null; };
    Storage.prototype.setItem = function (k, v) { mem[k] = String(v); };
    Storage.prototype.removeItem = function (k) { delete mem[k]; };
  }
  let n = 0; const T = (t, d, time) => Object.assign({ id: "demo" + (n++), t: t, d: d }, time ? { time: time } : {});
  const tasks = {
    "2026-10-26": [T("Plan the sprint", true, "09:00"), T("Gym", true, "18:00"), T("Call mom", true)],
    "2026-10-27": [T("Design review", true, "10:00"), T("Groceries", true), T("Read 20 pages", true), T("Water the plants", true)],
    "2026-10-28": [T("Run 5 km", true, "07:00"), T("Update portfolio", true)],
    "2026-10-29": dash ? [T("Morning run", true, "07:30"), T("Send the deck to Lina", true, "11:00"), T("Pick up film photos", true, "14:30"), T("Book the dentist", true)]
      : [T("Morning run", true, "07:30"), T("Send the deck to Lina", false, "11:00"), T("Book the dentist", false)],
    "2026-10-30": [T("Friday demo", false, "15:00"), T("Dinner with Sam", false, "19:00")],
    "2026-10-31": [T("Flea market", false, "10:00")]
  };
  localStorage.setItem("veckolista-v2", JSON.stringify({ users: { [id]: { name: seed.name, tasks: tasks } }, session: dash ? id : null, theme: "light" }));
  localStorage.setItem("veckolista-settings", JSON.stringify({ theme: "light", accent: "orange", remind: true, defTime: "09:00", figure: dash ? 3 : 0, view: "phone", lang: "en",
    quote: dash ? { day: "2026-10-29", i: 3 } : null, recap: { [id]: "2026-10-19" } }));
  document.addEventListener("DOMContentLoaded", () => {
    const st = document.createElement("style"); st.textContent = "html,body{scroll-behavior:auto!important}"; document.head.appendChild(st);
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const wav = path.join(OUT, "veckolista-promo-audio.wav");
  if (!STILLS) await writeAudio(wav, FFMPEG);

  const srv = await serve(), port = srv.address().port;
  const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ["--hide-scrollbars", "--force-color-profile=srgb", "--font-render-hinting=none"] });
  const ctx = await browser.newContext({ viewport: { width: 540, height: 675 }, deviceScaleFactor: DSF, colorScheme: "light", reducedMotion: "no-preference", timezoneId: "Europe/Stockholm", locale: "en-GB" });
  const T0 = new Date(TL.seed.date + "+01:00").getTime();
  await ctx.clock.install({ time: T0 - 60000 });
  await ctx.addInitScript(initScript, TL.seed);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  // this Edge build ignores Playwright's deviceScaleFactor, so set the pixel ratio over DevTools
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 540, height: 675, deviceScaleFactor: DSF, mobile: false });
  page.on("console", m => { if (m.type() === "warning" || m.type() === "error") console.log("[page]", m.text()); });
  page.on("pageerror", e => console.log("[pageerror]", e.message));
  await page.goto(`http://127.0.0.1:${port}/promo/stage.html`);
  for (let i = 0; i < 200 && !(await page.evaluate(() => window.ready && window.ready())); i++) await new Promise(r => setTimeout(r, 100));
  await new Promise(r => setTimeout(r, 500));
  await ctx.clock.pauseAt(T0);

  let ff = null;
  const mp4 = path.join(OUT, PREVIEW ? "preview.mp4" : "veckolista-promo-4x5.mp4");
  if (!STILLS) {
    ff = spawn(FFMPEG, ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-", "-i", wav,
      ...(PREVIEW ? ["-vf", "pad=540:676:0:0:color=0x0E0E0D"] : []), "-c:v", "libx264", "-preset", PREVIEW ? "veryfast" : "slow", "-crf", PREVIEW ? "24" : "15", "-pix_fmt", "yuv420p", "-profile:v", "high",
      "-r", String(FPS), "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", mp4], { stdio: ["pipe", "inherit", "inherit"] });
    ff.on("exit", code => { if (code) { console.error("ffmpeg exited with " + code); process.exit(1); } });
  }
  if (STILLS) fs.mkdirSync(path.join(OUT, "stills"), { recursive: true });

  const frames = Math.round(END * FPS), started = Date.now();
  let clockMs = 0;
  for (let f = 0; f < frames; f++) {
    const t = f / FPS;
    await page.evaluate(t => window.act(t), t);
    const target = Math.round(t * 1000);
    if (target > clockMs) { await ctx.clock.runFor(target - clockMs); clockMs = target; }
    await page.evaluate(([t, d]) => window.render(t, d), [t, 1 / FPS]);
    const want = STILLS ? STILLS.find(s => Math.abs(s - t) < 0.5 / FPS) : null;
    if (STILLS && want === undefined) continue;
    const shot = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: STILLS ? 92 : 94, optimizeForSpeed: true });
    const buf = Buffer.from(shot.data, "base64");
    if (STILLS) fs.writeFileSync(path.join(OUT, "stills", `t${want.toFixed(2)}.jpg`), buf);
    else if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once("drain", r));
    if (f % (FPS * 5) === 0) console.log(`t=${t.toFixed(1)}s  ${((Date.now() - started) / 1000).toFixed(0)}s elapsed`);
  }
  if (ff) { ff.stdin.end(); await new Promise(r => ff.on("close", r)); }
  await browser.close(); srv.close();

  if (!PREVIEW && !STILLS) {
    // 1:1 cut: the 4:5 frame scaled into a square on the stage colour, so nothing is cropped
    await new Promise(r => spawn(FFMPEG, ["-y", "-loglevel", "error", "-i", mp4, "-vf", "scale=864:1080:flags=lanczos,pad=1080:1080:108:0:color=0x0E0E0D",
      "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", path.join(OUT, "veckolista-promo-1x1.mp4")], { stdio: "inherit" }).on("close", r));
  }
  console.log(`done in ${((Date.now() - started) / 1000).toFixed(0)}s -> ${STILLS ? "out/stills" : mp4}`);
})().catch(e => { console.error(e); process.exit(1); });
