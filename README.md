# Phishing Awareness Simulator (Eduvos)

A role-based phishing awareness simulator for research use. Participants receive
locally relevant simulated phishing scenarios (Eduvos portal spoofs, NSFAS-style
scams, fake IT helpdesk requests), and their responses are tracked as three
distinct outcomes: **clicked, ignored, reported**. Every response is followed by
an immediate debrief. All reporting is **aggregate only**.

## What this is built with

Firebase Hosting only serves static files, so the app is split:

- **Frontend**: static HTML + Tailwind CSS + vanilla JS modules (`public/`).
- **Backend**: Python Cloud Functions (`functions/`) for scenario delivery,
  outcome capture, aggregation, scenario authoring/review, and campaign actions.
- **Data**: Firestore. Security rules enforce the aggregate-only promise.
- **Auth**: Firebase Auth, admin-only via a custom claim.

Python can't run in the browser, so the dashboard is JS/Tailwind. Python does the
work that matters for the ethics constraints: capturing outcomes, discarding
credential input, and keeping raw data server-side.

## How the privacy promises are enforced

- **No real credentials stored**: the fake login form never reads or sends the
  typed values. The browser resets the form and the server only records that
  "something was submitted" (`functions/main.py`, `record_event`).
- **Aggregate only, no individual risk profiles**: raw events, per-participant
  assignments, and the anonymised-code registry live in Firestore collections
  that clients cannot read (`firestore.rules`). The dashboard reads only
  pre-aggregated documents (`aggregates`, `daily_stats`).
- **Identifiers separate from responses**: participants are tracked by
  anonymised code only. The code&#8594;person mapping is kept outside this system.
- **AI authoring is offline + human-reviewed**: `functions/ai_author.py` builds
  drafts from templates (no live model, no per-participant generation). Every
  draft lands in `pending_review` and must be approved before it can go live.
- **Isolation**: no connection to real Eduvos authentication. HTTPS is enforced
  by Firebase Hosting; security headers are set in `firebase.json`.
- **Retention**: aggregate data is intended for 5-year encrypted retention per
  the ethics application (Firestore data is encrypted at rest by default).

## Project layout

```
public/                Static frontend (Firebase Hosting)
  index.html           Dashboard
  campaigns.html       Create/launch campaigns, get distribution links
  scenarios.html       Scenario library + AI drafts + human review
  participants.html    Aggregate view by role (no individual profiles)
  groups.html          Role-based delivery groups
  reports.html         Aggregate trends + CSV export
  settings.html        Governance summary
  login.html           Admin sign in
  s.html               Participant-facing scenario (email + fake login)
  debrief.html         Post-response debrief
  js/                  ES module frontend logic
  css/app.css          Built Tailwind output (do not edit by hand)
functions/             Python Cloud Functions
scripts/               Admin + seed helpers (run with the Admin SDK)
src/styles/input.css   Tailwind source
```

## Setup

### 1. Prerequisites

- Node 18+ and npm (for the Tailwind build and Firebase CLI)
- Python 3.12 (Cloud Functions runtime)
- Firebase CLI: `npm install -g firebase-tools`
- A Firebase project on the **Blaze** plan (Cloud Functions require it)

### 2. Point the app at your project

- Put your project id in `.firebaserc` (replace `REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID`).
- Fill in `public/js/firebase-config.js` from Firebase console
  (Project settings &#8594; Your apps &#8594; Web app). These values are not secrets.

### 3. Install and build

```bash
npm install
npm run build:css        # builds public/css/app.css
```

### 4. Create the first admin

Sign in to gcloud for the Admin SDK (or place a service-account key at
`serviceAccount.json`, which is git-ignored):

```bash
gcloud auth application-default login
python scripts/set_admin.py you@eduvos.example --password "ChooseAStrongPass" --project YOUR_PROJECT_ID
```

Existing accounts: drop `--password`. The user must sign out and back in for the
admin claim to take effect.

### 5. Seed scenarios and demo data

```bash
python scripts/seed.py --project YOUR_PROJECT_ID
# or, for a clean study with no demo dashboard numbers:
python scripts/seed.py --project YOUR_PROJECT_ID --no-demo
```

### 6. Deploy

```bash
npm run build:css
firebase deploy
```

This deploys Firestore rules/indexes, Python functions, and hosting.

## Run locally with emulators

```bash
firebase emulators:start
```

Then open the Hosting URL the CLI prints (default http://localhost:5000). Note
the Auth emulator has no users by default; seed/admin scripts and callable
functions expect a project. For most work, deploying to a real Blaze project is
simplest.

## Day-to-day use

1. **Scenarios**: create or AI-draft a scenario, review it, then Approve &amp; go
   live. Only live scenarios can be used in campaigns.
2. **Campaigns**: create a campaign against a live scenario, add anonymised
   participant codes (or auto-generate), then Launch.
3. **Distribute**: open a campaign's **Links** and hand out one link per code
   through your own approved channel.
4. **Track**: outcomes update the dashboard and reports in aggregate. When done,
   **Complete** the campaign so non-responders are logged as "ignored".

## Outcome model

Each participant has one final outcome: `clicked`, `submitted` (a click that also
entered fake credentials), `reported`, or `ignored` (never engaged, or opened but
did nothing by the time the campaign closed). "Click rate" counts clicked +
submitted. "Report rate" counts reported.

## Notes on the dashboard reference screenshot

The layout, colours, and card style follow the provided screenshot. Two things
were changed on purpose to honour the aggregate-only promise:

- "User Risk Distribution" became **Outcome Distribution** (aggregate outcomes),
  and a **Trends by Role** panel replaced the individual activity feed.
- "Users" became **Participants**, shown as anonymised aggregates by role rather
  than a list of named people.

## Out of scope (by design)

Live per-participant AI generation, VM-based per-participant environments,
multi-channel attacks (SMS/voice/physical), native/desktop apps, and individual
per-person risk dashboards.
```
