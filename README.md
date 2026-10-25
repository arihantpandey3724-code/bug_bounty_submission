# Entropy 2K26 QA Bug Bounty Submission & Triage Portal

A full-stack, Swiss utilitarian monochromatic Quality Assurance (QA) reporting, automated grading, and judge triage portal built for the **Entropy 2K26 E-Commerce Bug Bounty Simulation**.

---

## 1. Quick Start

### Run Locally:
```bash
# Navigate to the portal directory
cd "C:\Users\LENOVO\Documents\Extra Co-Curry\Bug_bounty\Submission_portal"

# Install dependencies (already installed)
npm install

# Start development server
npm run dev
# -> Opens on http://localhost:3001
```

### Production Build & Launch:
```bash
# Build for production
npm run build

# Start production server
npm run start
# -> Opens on http://localhost:3001
```

---

## 2. Guaranteed Storage & Persistence (Zero Lost Submissions)

Every single submission is **guaranteed to be preserved** through a dual-layer storage architecture:

1. **Local Disk Backup (`data/submissions_backup.jsonl`)**:
   - The instant a team clicks **"Submit Bug Report"**, the server synchronously appends the submission payload (deterministic ID, team name, email, reproduction steps, code snippet, Base64 screenshot, timestamp) to an append-only JSON Lines file on disk.
   - This write happens **first**, before any network or AI evaluation calls. Even if an API times out, the database drops connection, or the server restarts, **no submission can ever be lost**.
2. **Cloud PostgreSQL (Prisma ORM)**:
   - When deployed to Vercel or connected to a live database, all submissions are stored in the PostgreSQL `RegularSubmission` table.
3. **Resilient Local Fallback (`src/lib/localStore.ts`)**:
   - If running locally behind a college or institutional firewall that blocks outbound port 5432, the system automatically falls back to local disk persistence without throwing errors or crashing.

---

## 3. How Participants Use the Website

### A. Team Sign-In:
- Click **"Sign In Team"** in the top navigation bar.
- Enter your **Team Name** (e.g. `Team Apex`) and **Contact Email**.
- The portal remembers your team session and displays your current score and verified bug count in the header.

### B. Reporting a Bug (`/submit`):
1. Navigate to **Report Bug**.
2. Enter **Description & Steps to Reproduce** (e.g. what went wrong, which page).
3. *(Optional)* Paste relevant **Code Snippets** or network payloads from DevTools.
4. *(Optional)* Upload a **Screenshot Proof (SS)** (automatically converted into Base64).
5. Click **"Submit Bug Report"**. You will receive an instant reference ID and evaluation status.

### C. Redeeming Treasure Flags (`/treasures`):
1. Navigate to **Treasure Vault**.
2. Check the live countdown tracker showing how many of the 10 Treasure Bugs remain unclaimed.
3. Paste the flag token (e.g. `FLAG{7_clicks_unlocked_secret_treasure}`) and click **"Redeem Flag"**.
4. If valid and unclaimed, **+10 Points** are immediately awarded to your team!

### D. Tracking Results (`/my-submissions`):
- View your team's complete submission history.
- See real-time statuses: `VERIFIED (+points)`, `REJECTED`, or `IN TRIAGE REVIEW`.
- View whether you captured the **⚡ First-to-Find Speed Bonus**.

### E. Live Leaderboard (`/leaderboard`):
- High-density live standings showing team ranks, verified bugs, speed bonuses, claimed treasure flags, milestone bonus (+10 pts), and total points.
- Features automatic 10-second background sync.

---

## 4. Lead Judge & Admin Console (`/judge`)

Access the judge portal by navigating to **`/judge`**:
- **Judge Passcode PIN**: `laal_wala_AngryBird`

> **Security Note**: The passcode input field is obfuscated with password masking, and the placeholder does not reveal the passcode. To change the PIN at any time, update `JUDGE_PIN` in `.env` (or in your Vercel Environment Variables).

Inside the Judge Console:
1. **Triage Desk**:
   - Review incoming bug submissions in real-time.
   - View team reproduction steps, code snippet, screenshot preview, and **AI Automated Evaluation** (matched bug recommendation + confidence score).
   - One-click **"Verify & Award"** (automatically calculates base points + first-to-find speed bonus).
   - One-click **"Reject"** with optional judge feedback note.
   - Override matched bug ID or points when needed.
2. **Master Bug Matrix & AI Reference Screenshots**:
   - Overview of all 55 Master Defects (18 Easy, 21 Medium, 16 Hard).
   - See which team captured the first-to-find speed bonus for each bug.
   - **Attach Ground-Truth Reference Screenshots**: Click `+ Attach` on any defect row to upload a ground-truth reference image. Gemini AI automatically uses these images to evaluate visual similarity against student screenshots!
3. **Treasure Flag Codes (10 Slots)**:
   - Live management panel where judges can edit or customize the secret flag codes for all 10 Treasure Bug slots directly from the interface at any time.
4. **Reset Competition State**:
   - A dedicated **"RESET COMPETITION"** button that lets you wipe all test submissions, reset team scores, and return all 10 treasure bug slots back to `UNCLAIMED` at any time before or after rehearsals.

---

## 5. Official Competition Scoring Matrix

| Category | Seeded Count | Base Points | First-to-Find Speed Bonus | Max Points / Bug |
| :--- | :---: | :---: | :---: | :---: |
| **Easy Defects** | 18 | 3 pts | +2 pts | **5 pts** |
| **Medium Defects** | 21 | 5 pts | +5 pts | **10 pts** |
| **Hard Defects** | 16 | 10 pts | +10 pts | **20 pts** |
| **Treasure Bugs** | 10 | 10 pts | — | **10 pts** |
| **Milestone Bonus** | 1 | +10 pts | — | **+10 pts** |

> **Milestone Bonus (Rule 3.4)**: The very first team to successfully report 10 valid bugs (combining regular and/or treasure bugs) is automatically awarded a one-time **+10 Point Milestone Bonus**.

---

## 6. Project Architecture

```
Submission_portal/
├── data/
│   └── submissions_backup.jsonl # Permanent disk archive of every submission
├── prisma/
│   ├── schema.prisma            # PostgreSQL models (Team, MasterBug, RegularSubmission, TreasureBug, MilestoneTracker)
│   └── seed.ts                  # Database seeder for Master Bugs & initial slots
├── src/
│   ├── app/
│   │   ├── page.tsx             # Homepage & metrics summary
│   │   ├── submit/page.tsx      # Bug reporting desk with Base64 screenshot upload
│   │   ├── treasures/page.tsx   # Treasure vault & live countdown tracker
│   │   ├── my-submissions/page.tsx # Team report log & status
│   │   ├── leaderboard/page.tsx # Live competition leaderboard
│   │   ├── judge/page.tsx       # Lead judge triage & scoring console
│   │   └── api/                 # Dynamic REST route handlers
│   │       ├── submissions/route.ts
│   │       ├── submissions/[id]/judge/route.ts
│   │       ├── treasures/route.ts
│   │       ├── treasures/claim/route.ts
│   │       ├── leaderboard/route.ts
│   │       ├── teams/route.ts
│   │       └── bugs/route.ts
│   ├── config/
│   │   └── masterBugs.ts        # All 55 catalogued defects with locations & criteria
│   ├── context/
│   │   └── TeamContext.tsx      # Team login session & score synchronizer
│   └── lib/
│       ├── gemini.ts            # AI evaluation with Google Gen AI & local heuristic
│       ├── scoring.ts           # Points, speed bonus, & milestone evaluation
│       ├── submissionStore.ts   # Guaranteed disk backup engine
│       └── localStore.ts        # Resilient offline/local storage fallback
├── .env                         # Connection credentials & Judge PIN
├── package.json
└── README.md
```
