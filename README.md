# Veckolista

A week-based todo app with a dot-matrix look inspired by Nothing. Plan one week at a time (ISO week numbers, e.g. VECKA 44), open a day, add tasks, and optionally give a task a time, which acts as a reminder.

UI language: Swedish.

## Run it

No build step. Open `index.html` in a browser, or serve the folder:

```
npx serve .
```

## Features

- Week view with a dot overview of all seven days
- Calendar opened from the week number, with ISO week numbers
- Tasks per day: add, tick off, move to next day, delete
- Clock icon in the add row for a time (reminder marker with a bell)
- Empty state for new users, "Allt klart" state when a day is done
- Welcome, login and sign-up screens
- Light and dark theme

## Prototype status

Login is a local prototype. Accounts and tasks are stored in the browser (`localStorage`) and do not sync between devices. Password hashing is SHA-256 in the browser and is for demo purposes only.

Demo account: `yazan@epost.se` / `veckolista1`

Reminders are only shown (bell icon), not delivered as notifications.

## Roadmap

- Real auth and sync (Supabase or Firebase)
- Real notifications for tasks with a time
- Split `index.html` into `styles.css` and `app.js`
- Installable PWA

## Design

Fonts: Doto, Barlow Condensed, DM Mono (Google Fonts). Accent `#FF4A1C`, warm grey background.

## License

[MIT](LICENSE)
