# Veckolista

A week-based todo app with a dot-matrix look inspired by Nothing. Plan one ISO week at a time, add tasks per day, give a task a time as a reminder, and get a small celebration when the day is done.

Built with plain HTML, CSS and JavaScript. No build step, no dependencies, no backend.

## Run it

Open `index.html` in a browser, or serve the folder:

```
npx serve .
```

## Features

- Start by typing your name, no login
- Overview with a quote of the day, today, coming days and a week meter
- Plan view with weeks, missed tasks, read-only past weeks and swipe to delete with undo
- Time picker for reminders (tap the hour or minute for a grid)
- Dot-matrix animations: a dancing figure, a cheer for each finished task and a victory dance when the day is done
- Weekly recap of last week
- Light and dark theme, seven accent colours
- English (default) and Swedish
- Phone layout and a two-column desktop layout

## Data

Everything is stored in the browser (`localStorage`) on the device you use. Nothing is sent anywhere and nothing syncs between devices. Lists are keyed by the name typed on the start screen and have no password.

## Roadmap

- Real accounts and sync
- Real notifications for tasks with a time
- Installable PWA

## Design

Fonts: Doto, Barlow Condensed, DM Mono (Google Fonts). Warm grey surfaces with one accent colour. Design references are in `design/screens/`.

## License

[MIT](LICENSE)
