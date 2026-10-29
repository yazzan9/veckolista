/* The soundtrack, synthesised from timeline.js so every sound sits on its event.
   120 bpm, minimal and clicky: soft kick, ticks, a plucked arp over Am9 / Fmaj7 / Cadd9 / G6,
   a riser into the victory and a full bar of drums while the app dances.
   Writes a 48 kHz stereo WAV normalised to -14 LUFS (two pass loudnorm). */
const fs = require("fs"), path = require("path"), { spawnSync } = require("child_process");
const TL = require("./timeline");

const SR = 48000, N = Math.ceil((TL.DUR + 0.5) * SR);
const L = new Float32Array(N), R = new Float32Array(N), SL = new Float32Array(N), SR_ = new Float32Array(N); // dry + reverb send
const B = TL.BEAT, PH = 1.5, BAR = 4 * B; // bars start at 1.5 s so the victory tap (25.5 s) is a downbeat
let seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

function put(t, len, fn, gain, pan, send) {
  const i0 = Math.round(t * SR), n = Math.round(len * SR), gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < n; i++) {
    const j = i0 + i; if (j < 0 || j >= N) continue;
    const v = fn(i / SR, i);
    L[j] += v * gl; R[j] += v * gr;
    if (send) { SL[j] += v * gl * send; SR_[j] += v * gr * send; }
  }
}
const env = (x, a, d) => (x < a ? x / a : Math.exp(-(x - a) / d));

/* ---------- instruments ---------- */
function kick(t, g = 1) {
  let ph = 0; put(t, 0.5, x => { const f = 46 + 110 * Math.exp(-x / 0.035); ph += 2 * Math.PI * f / SR; return Math.sin(ph) * env(x, 0.002, 0.16) + (x < 0.004 ? (rnd() * 2 - 1) * 0.3 : 0); }, 0.9 * g, 0, 0);
}
function hat(t, g = 1, open = false, pan = 0.2) {
  let lp = 0; put(t, open ? 0.3 : 0.06, x => { const w = rnd() * 2 - 1; lp += 0.35 * (w - lp); return (w - lp) * env(x, 0.0005, open ? 0.08 : 0.014); }, 0.22 * g, pan, 0.1);
}
function clap(t, g = 1) {
  let bp = 0, lp = 0; put(t, 0.25, x => { const w = rnd() * 2 - 1; lp += 0.5 * (w - lp); bp += 0.25 * ((w - lp) - bp); const e = x < 0.03 ? (Math.floor(x / 0.009) % 2 ? 0.5 : 1) * env(x % 0.009, 0.0005, 0.004) : env(x - 0.03, 0.0005, 0.05); return bp * e * 3; }, 0.32 * g, -0.1, 0.35);
}
function sub(t, m, len, g = 1) {
  const f = mtof(m); put(t, len, x => (Math.sin(2 * Math.PI * f * x) + 0.18 * Math.sin(4 * Math.PI * f * x)) * Math.min(1, x / 0.01) * Math.min(1, (len - x) / 0.06) * env(x, 0.005, len * 0.8), 0.42 * g, 0, 0);
}
// band limited saw, higher harmonics die faster, which sounds like a closing filter
function pluck(t, m, g = 1, pan = 0, dec = 0.22, bright = 1, send = 0.35) {
  const f = mtof(m), H = Math.min(14, Math.floor(9000 / f));
  put(t, dec * 4, x => { let s = 0; for (let h = 1; h <= H; h++) s += Math.sin(2 * Math.PI * f * h * x) / h * Math.exp(-x * h * 9 / bright); return s * env(x, 0.002, dec) * 0.7; }, 0.2 * g, pan, send);
}
function pad(t, notes, len, g = 1) {
  notes.forEach((m, k) => {
    const f = mtof(m);
    put(t, len, x => { const a = Math.min(1, x / 0.6) * Math.min(1, (len - x) / 0.8); return a * (Math.sin(2 * Math.PI * f * 1.002 * x) + Math.sin(2 * Math.PI * f * 0.998 * x + k) + 0.25 * Math.sin(4 * Math.PI * f * x)) * 0.33; }, 0.05 * g, (k % 2 ? 0.35 : -0.35), 0.6);
  });
}
function blip(t, f, len = 0.05, g = 1, pan = 0) { put(t, len, x => Math.sin(2 * Math.PI * f * x) * env(x, 0.001, len / 3), 0.22 * g, pan, 0.2); }
function click(t, g = 1, pan = 0) { put(t, 0.03, x => (Math.sin(2 * Math.PI * 2100 * x) * 0.6 + (rnd() * 2 - 1) * (x < 0.002 ? 1 : 0)) * env(x, 0.0005, 0.006), 0.32 * g, pan, 0.15); }
function key(t, g = 1) { const f = 2600 + rnd() * 900; put(t, 0.02, x => (Math.sin(2 * Math.PI * f * x) * 0.5 + (rnd() * 2 - 1) * (x < 0.0015 ? 0.8 : 0)) * env(x, 0.0003, 0.004), 0.22 * g, rnd() * 0.4 - 0.2, 0.1); }
function swish(t, len, up, g = 1) {
  let lp = 0; put(t, len, x => { const p = x / len, c = up ? 0.02 + 0.5 * p * p : 0.5 - 0.48 * p; const w = rnd() * 2 - 1; lp += c * (w - lp); return lp * Math.sin(Math.PI * Math.min(1, p)) ; }, 0.5 * g, 0, 0.3);
}
function riser(t, len) {
  let lp = 0, ph = 0; put(t, len, x => { const p = x / len, c = 0.01 + 0.4 * p * p * p; const w = rnd() * 2 - 1; lp += c * (w - lp); ph += 2 * Math.PI * (220 + 880 * p * p) / SR; return (lp * 0.9 + Math.sin(ph) * 0.12 * p) * p * p; }, 0.55, 0, 0.4);
}
function impact(t) {
  let ph = 0; put(t, 1.6, x => { const f = 38 + 90 * Math.exp(-x / 0.06); ph += 2 * Math.PI * f / SR; return Math.sin(ph) * env(x, 0.002, 0.5); }, 0.95, 0, 0);
  let lp = 0; put(t, 1.2, x => { const w = rnd() * 2 - 1; lp += 0.2 * (w - lp); return lp * env(x, 0.001, 0.25); }, 0.5, 0, 0.8);
  [57, 64, 67, 71, 76].forEach((m, k) => pluck(t, m, 1.2, k % 2 ? 0.4 : -0.4, 0.9, 2.5, 0.6));
}

/* ---------- the bed ---------- */
const CH = [ // root, chord tones
  [45, [57, 60, 64, 67, 71]], // Am9
  [41, [53, 57, 60, 64, 69]], // Fmaj7
  [48, [55, 60, 62, 64, 67]], // Cadd9
  [43, [55, 59, 62, 64, 67]]  // G6
];
const ARP = [0, 2, 4, 1, 3, 2, 4, 3];
const barT = b => PH + b * BAR;
for (let b = -1; barT(b) < TL.DUR; b++) {
  const t0 = barT(b), c = CH[((b % 4) + 4) % 4], victory = t0 >= 25.5 && t0 < 31.5, outro = t0 >= 41.5;
  if (t0 + BAR < 0) continue;
  // pad under everything, an octave down on the intro
  pad(Math.max(0, t0), c[1].slice(0, 4).map(m => (t0 < 5 ? m - 12 : m)), BAR + 0.4, outro ? 1.3 : victory ? 1.2 : 1);
  if (outro) continue;
  const groove = t0 >= 5.5 && !(t0 >= 23.5 && t0 < 25.5);
  for (let s = 0; s < 16; s++) {
    const t = t0 + s * B / 4; if (t < 0) continue;
    const beat = s % 4 === 0, off = s % 4 === 2;
    if (t >= 5.0 && (groove || (t >= 23.5 && t < 24.75 && beat))) {
      if (beat) kick(t, victory ? 1 : 0.75);
      if (off) hat(t, victory ? 1.1 : 0.8, victory && s % 8 === 6);
      if ((t >= 15.5 || victory) && !beat && !off) hat(t, 0.35, false, -0.25);
      if ((t >= 19.5 && t < 23.5 || victory) && (s === 4 || s === 12)) clap(t, victory ? 1 : 0.7);
    }
    // arp: quiet 16ths, an octave up and brighter during the victory
    if (t >= 5.5 && !(t >= 24.75 && t < 25.5)) {
      const m = c[1][ARP[s % 8]] + (victory ? 12 : 0);
      if (s % 2 === 0 || victory || t >= 15.5) pluck(t, m, (s % 4 === 0 ? 0.75 : 0.5) * (t >= 33.5 && t < 41.5 ? 0.8 : 1), s % 2 ? 0.45 : -0.45, victory ? 0.16 : 0.12, victory ? 1.6 : 1);
    }
  }
  if (t0 >= 5.0 && !(t0 >= 23.5 && t0 < 25.5)) { sub(t0, c[0], B * 1.6, victory ? 1.1 : 0.9); sub(t0 + B * 2.5, c[0], B * 1.2, 0.7); }
}

/* ---------- events from the timeline ---------- */
const PENTA = [69, 72, 74, 76, 79, 81, 84];
TL.actions.forEach(a => {
  if (a.act === "key") { key(a.t); return; }
  const s = a.sel;
  if (a.victory) { click(a.t, 1.2); impact(a.t); return; }
  click(a.t, a.swatch != null ? 0.6 : 1, 0);
  if (a.cheer) { pluck(a.t + 0.06, 76, 1, -0.2, 0.25, 1.5, 0.5); pluck(a.t + 0.16, 81, 1, 0.2, 0.35, 1.5, 0.5); }
  if (a.swatch != null) { pluck(a.t, PENTA[a.swatch] + (a.swatch === 6 ? 0 : 0), 1.3, (a.swatch - 3) / 4, 0.4, 1.8, 0.5); if (a.swatch === 6) pluck(a.t, 64, 1, 0, 0.6, 1.8, 0.5); }
  if (s === "#o-fig") { [0, 0.04, 0.08].forEach((d, k) => blip(a.t + d, [1320, 1760, 2640][k], 0.05, 0.8, (k - 1) * 0.3)); }
  if (s === "#o-qnext") swish(a.t, 0.16, false, 0.6);
  if (s === "#ad-clock") { click(a.t + 0.12, 0.7, 0.3); }
  if (s === ".ad-go" || s === ".nb-go") { pluck(a.t + 0.03, 72, 1, -0.2, 0.3, 1.6, 0.5); pluck(a.t + 0.11, 79, 1, 0.2, 0.4, 1.6, 0.5); }
  if (a.theme) { let lp = 0; const up = a.theme === "light"; put(a.t, 0.35, x => { const p = x / 0.35, f = up ? 80 + 500 * p : 580 - 500 * p; lp += 0.08 * ((rnd() * 2 - 1) - lp); return (Math.sin(2 * Math.PI * f * x) * 0.6 + lp) * env(x, 0.002, 0.1); }, 0.5, 0, 0.3); }
});
TL.cues.forEach(c => {
  if (c.k === "intro") {
    // the seven day dots, Thursday is the high note
    for (let i = 0; i < 7; i++) blip(0.25 + i * 0.25, i === 3 ? 1760 : 880 * Math.pow(2, [0, 2, 4, 5, 7, 9, 11][i] / 12), 0.09, i === 3 ? 1.4 : 0.8, (i - 3) / 5);
    kick(2.0, 0.5); kick(2.5, 0.5); click(2.0, 0.6); click(2.5, 0.6);
    [57, 64, 67, 72].forEach((m, k) => pluck(3.5, m, 1, k % 2 ? 0.3 : -0.3, 0.7, 2, 0.6));
  }
  if (c.k === "rise") swish(4.0, 1.0, true, 0.8);
  if (c.k === "land") { kick(5.0, 1); sub(5.0, 45, 1.0, 1); }
  if (c.k === "sheet") swish(c.t - 0.05, 0.3, true, 0.5);
  if (c.k === "riser") riser(c.t, c.len);
  if (c.k === "drop") swish(41.25, 0.75, false, 0.8);
  if (c.k === "end") {
    impact(42.0);
    for (let i = 0; i < 7; i++) blip(43.5 + i * 0.125, mtof(PENTA[i] + 12), 0.08, 0.9, (i - 3) / 5);
    [45, 57, 64, 67, 71, 76].forEach((m, k) => pluck(44.375, m, 0.9, k % 2 ? 0.4 : -0.4, 1.4, 1.4, 0.7));
  }
});

/* ---------- reverb send (Schroeder) and master ---------- */
function reverb(inp, comb, ap) {
  const out = new Float32Array(N);
  comb.forEach(d => { const n = Math.round(d * SR), buf = new Float32Array(n); let i = 0, lp = 0; for (let j = 0; j < N; j++) { const y = buf[i]; lp += 0.35 * (y - lp); buf[i] = inp[j] + lp * 0.78; out[j] += y * 0.25; i = (i + 1) % n; } });
  ap.forEach(d => { const n = Math.round(d * SR), buf = new Float32Array(n); let i = 0; for (let j = 0; j < N; j++) { const b = buf[i], x = out[j], y = -x * 0.6 + b; buf[i] = x + b * 0.6; out[j] = y; i = (i + 1) % n; } });
  return out;
}
const RL = reverb(SL, [0.0297, 0.0371, 0.0411, 0.0437], [0.005, 0.0017]);
const RR = reverb(SR_, [0.0301, 0.0359, 0.0419, 0.0449], [0.0051, 0.0019]);

function writeWav(file, l, r) {
  const buf = Buffer.alloc(44 + N * 4);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(N * 4, 40);
  for (let i = 0; i < N; i++) { buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, l[i])) * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, r[i])) * 32767), 46 + i * 4); }
  fs.writeFileSync(file, buf);
}

async function writeAudio(file, ffmpeg) {
  const ml = new Float32Array(N), mr = new Float32Array(N);
  let peak = 0;
  for (let i = 0; i < N; i++) { ml[i] = L[i] + RL[i] * 0.9; mr[i] = R[i] + RR[i] * 0.9; peak = Math.max(peak, Math.abs(ml[i]), Math.abs(mr[i])); }
  const fadeOut = Math.round(0.6 * SR), g = 0.7 / peak;
  for (let i = 0; i < N; i++) {
    const f = i > N - fadeOut ? (N - i) / fadeOut : 1;
    ml[i] = Math.tanh(ml[i] * g * 1.2) * f; mr[i] = Math.tanh(mr[i] * g * 1.2) * f; // gentle saturation as a soft limiter
  }
  const raw = file.replace(/\.wav$/, ".raw.wav");
  writeWav(raw, ml, mr);
  // two pass loudnorm to -14 LUFS, true peak -1.5 dBTP
  const p1 = spawnSync(ffmpeg, ["-hide_banner", "-i", raw, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], { encoding: "utf8" });
  const m = JSON.parse(p1.stderr.slice(p1.stderr.lastIndexOf("{")));
  const af = `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  spawnSync(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-i", raw, "-af", af, "-ar", "48000", "-c:a", "pcm_s16le", file]);
  fs.unlinkSync(raw);
  const chk = spawnSync(ffmpeg, ["-hide_banner", "-i", file, "-af", "loudnorm=print_format=json", "-f", "null", "-"], { encoding: "utf8" });
  const o = JSON.parse(chk.stderr.slice(chk.stderr.lastIndexOf("{")));
  console.log(`audio: ${o.input_i} LUFS, true peak ${o.input_tp} dBTP -> ${path.basename(file)}`);
}
module.exports = { writeAudio };
if (require.main === module) writeAudio(path.join(__dirname, "out", "veckolista-promo-audio.wav"), require("ffmpeg-static"));
