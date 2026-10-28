# Veckolista: design update brief

Mobile todo app with ISO weeks, Nothing-phone inspired look. The design is finished in Figma. This file lists the changes to build, in order. Do ONE step at a time when asked ("do step 3"), then stop and let me review.

Reference images (390 px wide, 1:1) are in `design/screens/`. Open the matching image before every step and match it closely.

## Hard rules

1. Design and front-end only. Do NOT touch login, signup, password hashing, the demo account, logout logic or any auth code. Do NOT add a backend, network calls, analytics or new dependencies.
2. Keep vanilla HTML, CSS and JS. Read the whole existing app first and extend it. Do not rewrite it from scratch.
3. Keep the existing data model and the localStorage key `veckolista-v2`. Only add optional fields (for example `done`, `time`, `day`). New UI settings go in a separate key `veckolista-settings`.
4. UI text is Swedish. Labels are UPPERCASE in DM Mono. Never use em dashes in UI text.
5. Everything must work in light and dark theme using the tokens below. No hard coded colors in components.
6. After each step: run the app, check light and dark, check a 390 px wide viewport, then commit with a short message.

## Tokens

| token | light | dark |
|---|---|---|
| bg | #D9D7D2 | #2A2A29 |
| surface | #E6E4DF | #363635 |
| fg | #1B1B1A | #EEEDE9 |
| mute | #84827D | #8F8D88 |
| line | #BCBAB4 | #4A4A48 |
| dotOff | #BFBDB7 | #4B4B49 |
| accent | #FF4A1C | #FF5A2C |
| onAccent | #FFFFFF | #FFFFFF |

Fonts: Doto ExtraBold for big numbers (week number 104px, today number 72px, clock 60px), Barlow Condensed ExtraBold for headlines and day names (greeting name 64px, day names 40px, sheet title 48px, quote 32px), DM Mono Regular for everything else (labels 10 to 12px with 10 to 18 percent letter spacing, task text 14px).

Radii and sizes: tiles 28, cards 22, pills 17 (height 36), chips 17 (height 36, padding 14 by 10, mono 11), big buttons 28 (height about 54), tab bar 350 by 60 with radius 30, avatar 36 circle. Screen padding 20. Dashed 1px dividers (3 3) between task rows. Task row height 49.

## Navigation model

Two tabs: ÖVERSIKT and PLAN. The tab bar is fixed to the bottom on both, and also visible on Lägg till (above the keyboard). It is hidden on sheets (Kalender, Inställningar, Redigera uppgift).

| from | tap | goes to |
|---|---|---|
| Översikt | PLAN tab | Plan |
| Översikt | + in IDAG tile or PLANERA DAGEN | Lägg till |
| Översikt | VECKA tile or calendar dots | Kalender (sheet) |
| Översikt | IDAG, NÄSTA or VECKAN tile | Plan, today open |
| Översikt | avatar Y | Inställningar (sheet) |
| Översikt/Plan | LJUS/MÖRK pill | toggles theme |
| Plan | + under a day | Lägg till for that day |
| Plan | task row | Redigera uppgift (sheet) |
| Plan | arrows in top bar | previous or next week |
| Plan | IDAG pill | back to current week |
| any sheet | X, KLAR or swipe down | closes |

The selected week in Plan is remembered when switching tabs. Översikt always shows the real current week.

## Steps

### Step 1: Fixed tab bar and routing
Images: 01, 05.
Build the tab bar: surface fill, 1px line stroke, radius 30, 350 by 60, bottom offset 20. Active tab has fg fill and bg text, inactive has no fill. It must never scroll away. Content scrolls behind it, with a solid bg band (100px) behind the bar and a 30px gradient (transparent to bg) above the band. Give scroll content 140px bottom padding. Add the routing from the table above, with a 180ms fade between tabs.
Done when: both tabs switch, the bar stays fixed while scrolling, nothing is hidden behind the bar at the end of the scroll.

### Step 2: Översikt (dashboard)
Images: 01, 02, 03, 04.
Order top to bottom: top bar (VECKOLISTA label, theme pill, avatar), greeting (GOD KVÄLL/GOD MORGON/GOD DAG by time, name in 64px with orange dot, date line), DAGENS CITAT tile, IDAG tile, VECKA tile (accent fill, Doto week number, 3 by 3 dot grid, date range) next to NÄSTA tile, VECKAN tile (7 day columns with dots, streak line).
- Quote tile is inverted (fg fill, bg text). Use an array of quotes and pick by day of year. Placeholder text is fine, I will replace the quotes.
- IDAG tile has three states: with tasks (Doto number done, "/ N KLARA", "N KVAR" in accent, one dot per task), empty (number 0, ring outlines, an orange pill PLANERA DAGEN, same tile height as the filled one so VECKA and NÄSTA stay visible without scrolling), all done (4 filled accent dots, "ALLT KLART" in accent). The orange + button sits top right of the tile when there are tasks.
- NÄSTA tile: next task with a time today, shows title, "IDAG · 18:00" and "MED PÅMINNELSE". If none: "INGET ÄNNU / ÄNNU INGEN TID / TID = PÅMINNELSE". If all done: "INGET MER / NÄSTA: TISDAG / 2 UPPGIFTER".
Done when: all three IDAG states render correctly in light and dark and match the images.

### Step 3: Plan, weeks and missed tasks
Images: 05, 10, 11, 12, 13.
- Top bar: back arrow, IDAG pill, forward arrow, theme pill. When viewing another week the IDAG pill is orange filled.
- Future week (image 11): header "NÄSTA VECKA" with "PLANERA I FÖRTID", dates for that week, tapping a day opens Lägg till for that day.
- Past week (image 12): read only. No add row, no move or delete icons, right label "AVSLUTAD" instead of "N KVAR", footer text "SKRIVSKYDDAD · VECKAN ÄR AVSLUTAD".
- Missed tasks (image 10): a task from an earlier day that is not done stays on its day. Never move or delete it automatically. Show its text in mute, replace the arrow button with a filled orange circle button, show "N MISSADE" in orange in the week summary and a banner line "N MISSADE · TRYCK → FÖR ATT FLYTTA TILL IDAG" inside the day card. Tapping the arrow moves the task to today.
Done when: you can browse weeks, past weeks are locked, missed tasks behave as described.

### Step 4: Lägg till view
Images: 06.
Opens as a full view (slide up 300ms), back arrow top left. Big day name with orange dot, one card: NY UPPGIFT label, large Barlow input (40px) with an orange caret and autofocus, dashed divider, TID = PÅMINNELSE chips (INGEN, 09:00, 17:00, ANNAN TID), full width orange LÄGG TILL + button. Below the card a day picker M T O T F L S (42px circles, selected is orange). The tab bar stays visible directly above the keyboard. Enter adds the task and keeps the input open for the next one. A task with a time gets the bell/reminder marker as today.
Done when: the flow works from Översikt and from Plan, and the tab bar is visible with the keyboard open.

### Step 5: Edit, swipe delete and undo
Images: 07, 08, 09.
- Tapping a task opens a bottom sheet (radius 36 top, dimmed scrim) titled REDIGERA UPPGIFT: editable title (48px Barlow), DAG picker, TID chips with the selected one in fg fill, a Doto clock tile (60px) with minus and plus buttons that change the time in 15 minute steps, a MARKERA SOM KLAR checkbox, TA BORT (orange outline) and SPARA (orange fill).
- Swipe a task row left: the row shifts about 40px and reveals an orange square button with an X. Tapping it deletes the task.
- After any delete show a toast at the bottom above the tab bar: dark pill (fg fill, bg text), "TITEL BORTTAGEN" and an orange ÅNGRA button. It disappears after 6 seconds. ÅNGRA restores the task in its old position.
Done when: edit, swipe delete and undo all work and persist.

### Step 6: Inställningar
Images: 15, 16.
Sheet opened from the avatar. Contents only: avatar (96px circle, Doto Y) with name, UTSEENDE card (TEMA segmented LJUS/MÖRK/AUTO, FÄRG with 4 swatches), PÅMINNELSER card (toggle, STANDARDTID chip), LOGGA UT outlined button, version line.
- AUTO follows prefers-color-scheme.
- Accent swatches: orange (#FF4A1C light, #FF5A2C dark), red #D71921, blue #2F4BFF, mono (accent becomes fg color, so black in light and white in dark). The label under FÄRG shows the chosen name. Changing it updates the accent token everywhere.
- Store everything in `veckolista-settings`. LOGGA UT calls the existing logout function unchanged.
Done when: theme and accent persist after reload.

### Step 7: Polish
- Completing a task: the dot fills with a short pulse (150ms). When the last task is done, the IDAG tile switches to the all done state.
- Transitions: sheets and Lägg till slide up in 300ms, tabs fade in 180ms.
- Accessibility: buttons are real buttons with aria-labels, visible focus ring in accent, minimum 40px touch targets, respect prefers-reduced-motion.

### Step 8: QA
Check every screen against the images in light and dark at 390 px width. Test: empty account, 4 tasks, all done, missed task, past week, future week, delete and undo, theme and accent persistence, reload keeps data. Fix differences. Do not change any auth code.

## Not in scope now
Swiping between quotes, widgets, push notifications, real login or sync. These come later.
