# Mole Meadow

A playful 3D whack-a-mole game built with Three.js, modern JavaScript ES modules,
Node.js, and Express. No database, external art, CDN, or account required.

## Quick start (Windows, macOS, Linux)

Install Node.js 22 or newer, then extract this folder and open a terminal inside it:

```sh
npm install
npm start
```

Open **http://localhost:3000**. Express runs both the API and the frontend.
Keep the terminal open; press Ctrl+C to stop. Dependencies require internet access
for installation; after installation, the app runs locally without internet.
Do not open index.html directly using file://.

## Run frontend and backend separately

Run `npm install` once in the project root. Then open two terminals in that folder:

Terminal 1 — backend (http://localhost:3000):

```sh
npm run backend
```

Terminal 2 — frontend (http://localhost:5173):

```sh
npm run frontend
```

Open **http://localhost:5173**. This optional frontend server proxies `/api` to the
backend, so CORS configuration is unnecessary. Refresh the browser after frontend
edits; the backend command automatically restarts when its code changes.
Ports can be changed with the `PORT` and `FRONTEND_PORT` environment variables;
set the same `PORT` in both terminals if changing the backend port.

## Play

- Click **Let's play** for a 30-second round.
- Click or tap a visible mole for **10 points**. No penalty for a miss.
- Or focus the game canvas and use Q W E / A S D / Z X C for the back / middle /
  front rows, respectively. Each key corresponds to a hole from left to right.
- Moles appear faster toward the end. The timer uses elapsed time, so backgrounding
  the tab does not extend a round.
- At the end, enter your name and save. Play again skips saving if you prefer.
- The homepage shows the top 10 scores, highest first; older submissions win ties.
  Hover a row to see its timestamp in your local time.

## Project structure

```text
mole-meadow/
  package.json             Dependencies and run scripts
  package-lock.json        Reproducible dependency versions
  frontend/
    index.html             Homepage, scoreboard, and submission dialog
    style.css              Responsive layout and visual styling
    game.js                Three.js scene, gameplay, API calls, leaderboard
    dev-server.js          Optional separate frontend server and API proxy
  backend/
    server.js              Local Express entry point
    app.js                 API routes, input validation, static serving
    store.js               Serialized reads/writes and atomic file replacement
    Highscores.JSON        Persistent score records (starts as [])
    test/api.test.js        API and persistence integration test
```

Three.js is installed through npm and served locally from its build directory.
All visual assets are created with geometry; there are no image downloads.

## API

### GET /api/highscores

Returns HTTP 200:

```json
{"highscores":[{"id":"server-generated-uuid","name":"Okan","score":240,"timestamp":"2026-10-24T18:00:00.000Z"}]}
```

The response includes at most 10 records. An empty installation returns an empty list.

### POST /api/highscores

Send `Content-Type: application/json`:

```json
{"name":"Okan","score":240}
```

Returns HTTP 201 with the saved record. The server creates the ID and UTC ISO
timestamp. Names must contain 1–24 Unicode code points after trimming and no
control characters. Scores must be integers, multiples of 10, from 0 to 100000.
Invalid data receives HTTP 400, oversized requests HTTP 413, and storage failures
HTTP 500. User names are rendered with textContent rather than HTML.

## Persistence and practical limits

Every accepted submission is stored in **backend/Highscores.JSON**, relative to
the server source, regardless of your terminal's working directory. No database
is involved. Data survives server restarts. Back up this file to keep your scores;
to reset, stop the server and replace its contents with `[]`.

Writes are serialized in one process and use a temporary file plus rename, so
concurrent requests do not overwrite one another. A missing file is created on
the first submission. Invalid existing JSON produces an error instead of silently
discarding scores. The application retains all scores and reads the file into
memory, appropriate for a small local game. Run exactly **one backend process**
per score file; this is not a distributed or multi-process storage design.

This is a casual local leaderboard: scores are submitted by the browser and can
be forged with direct API calls. Range validation is not anti-cheat. The save
button prevents duplicate clicks, but if a connection drops after a successful
write, retrying may create a duplicate record. Check the leaderboard first.
There is no authentication or rate limiting. Both servers bind to localhost.

## Verification

```sh
npm test
```

The integration test uses a temporary directory and checks validation, simultaneous
submissions, server timestamps, top-10 ordering, persistence across app restarts,
static-file isolation, invalid JSON, and preserving corrupt storage. It never
modifies your real high-score file.

Manual browser checks: start a round, hit via mouse/touch and keys, wait for the
result dialog, save a name, replay, then restart the server and verify the score
remains. To test error handling, stop the backend while using the separate frontend
server and attempt to refresh or save.

Requires a modern browser with WebGL. If rendering fails, enable hardware
acceleration or try another browser. The app reports when WebGL is unavailable.

## References

- Three.js installation: https://threejs.org/manual/en/installation.html
- Express static files: https://expressjs.com/en/starter/static-files.html
- Express API: https://expressjs.com/en/5x/api.html
