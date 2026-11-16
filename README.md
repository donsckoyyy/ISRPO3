# Smart Breaker
**Lab work #3** for the course *Software Development Tools* (ITMO University). This repository contains Smart Breaker, a VS Code extension written in TypeScript.

Smart Breaker keeps track of how long you have been coding non-stop and makes you take breaks. Ignore the reminder, and it gets more and more persistent until it takes over the whole editor.

## Features

- **Activity-based work tracking.** Only the time you spend typing in the editor counts as work. If the window is minimized or you are just reading, the timer does not run.
- **Automatic break detection.** Stop typing for 5 minutes and a break begins. If it lasts 30 minutes, the break counts and your work time is reset.
- **Reminder with a random tip:** stretch your neck, drink some water, do eye exercises, etc.
- **Escalation.** Every 5 minutes of ignoring it, the reminder gets more intrusive: a notification in the corner, a warning and a yellow status bar, an error message and a red status bar, a full-editor "Time for a break" panel. Close it with the ✕ and it comes right back.
- **Reminders disappear on their own** once the break counts. There is no "Snooze" button: the only way to get rid of the reminder is to actually rest.
- **No early-return cheating.** Come back to the code before 30 minutes are up and the break does not count: the reminder drops back to level 1 and the rest countdown starts over.
- **Survives restarts.** Accumulated work time and the reminder level are saved, so restarting VS Code will not reset the timer. If the editor was closed for longer than a break, the break counts.
- **Status bar:** time left until the break, rest time remaining, and a color that matches the reminder level. Hover for stats, click to show them in a notification.
- **Test mode:** minutes become seconds, so you can try the whole thing in under a minute.

## Commands

Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`):

| Command | What it does |
|---|---|
| **Smart Breaker: Показать статус** (Show status) | Work time so far, time until the break, or the current reminder level |
| **Smart Breaker: Сбросить таймер** (Reset timer, test mode only) | Resets the timer. Works only in test mode, so the extension can't be bypassed |

## Settings

`Settings → Extensions → Smart Breaker`:

| Setting | Default | Description |
|---|---|---|
| **smartBreaker.workMinutes** | 120 | Minutes of work before the first reminder |
| **smartBreaker.idleMinutes** | 5 | Minutes without typing after which a break begins |
| **smartBreaker.breakMinutes** | 30 | How long a break must last to count |
| **smartBreaker.escalationMinutes** | 5 | Minutes of ignoring before the reminder escalates |
| **smartBreaker.testMode** | false | Test mode: minutes → seconds, reset command enabled |

## Installation

**From a `.vsix` file:**
1. Open the Extensions view (`Cmd+Shift+X`).
2. `...` → `Install from VSIX...` → pick `smart-breaker-0.0.1.vsix`.

**From source:**
```bash
git clone https://github.com/donsckoyyy/ISRPO3
cd ISRPO3
npm install
npm run compile
```
Then open the folder in VS Code and press `F5`.

**Packaging into a `.vsix`:**
```bash
npm install -g @vscode/vsce
vsce package
```

## How it works

| File | Purpose |
|---|---|
| `src/extension.ts` | Entry point: **activate()** starts the timer, subscribes to typing events and registers the commands |
| `src/breakTimer.ts` | Logic: once a second it updates work time, detects breaks and raises the reminder level |
| `src/ui.ts` | UI: status bar, notifications, Webview panel |
| `src/state.ts` | Extension state and saving it to `globalState` |
| `src/config.ts` | Reading user settings |
| `src/tips.ts` | List of tips |

## Limitations and roadmap

- With several VS Code windows open, each one tracks time separately.
- The break panel currently opens full-size right away. Gradual growth is planned.

---

**Author:** Nechetailiuk Nikita Sergeevich, group M3108  
