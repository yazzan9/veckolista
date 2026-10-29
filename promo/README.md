# Veckolista launch film

A 46 s product film made from the real app. No screen recording: `render.js` loads `index.html`
in headless Edge inside `stage.html`, drives it with the actions in `timeline.js` and steps a fake
clock one frame at a time. Timers, canvas animations and CSS animations in the app all follow the
same timeline as the camera, the copy and the sound.

```
npm install
node render.js --preview        # 540x676, 30 fps -> out/preview.mp4
node render.js --stills 6,26.4  # full size frames -> out/stills
node render.js                  # 1080x1350 60 fps + 1080x1080 -> out/
node audio.js                   # soundtrack only -> out/veckolista-promo-audio.wav
```

`timeline.js` is the single source: app actions (taps, typing), camera keys, captions and sound cues.
`audio.js` synthesises the music and effects from it and normalises to -14 LUFS.
To use your own music, replace the audio track in the MP4 (the WAV is there as a timing reference).
Needs Microsoft Edge installed. The app code is not touched.
