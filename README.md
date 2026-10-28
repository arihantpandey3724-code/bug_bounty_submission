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

### A. Team Sign-In & Multi-Laptop Sync:
- Click **"Sign In Team"** in the top navigation bar.
- Enter your **Team Name** (e.g. `Team Apex`) and **Contact Email**.
- **Multi-Device Support (3 Laptops per Team)**: All 3 teammates sign into the Submission Portal using the exact same Team Name or Email. Submissions, flags, and points sync automatically across all 3 devices in real time.
- **Amazon Replica Storefront Account**: For testing on the target Amazon store, each team must register their own dedicated account at `/register` using their team credentials. Orders and addresses are kept private per team, inventory is non-depleting across all teams, and only product reviews are shared across the community.

### B. Reporting a Bug (`/submit`):
1. Navigate to **Report Bug**.
2. Enter **Description & Steps to Reproduce** (e.g. what went wrong, which page, how to trigger).
3. *(Optional)* Paste relevant **Code Snippets** or network payloads from DevTools.
4. *(Optional)* Upload a **Screenshot Proof** (automatically converted into Base64).
> **Note on Proof Requirements**: Screenshots and code snippets are **completely optional**. A clear text description of what went wrong and reproduction steps is all that is required for AI verification and scoring.

### C. Redeeming Treasure Flags (`/treasures`):
1. Navigate to **Treasure Vault**.
2. Check the live countdown tracker showing how many of the 10 Treasure Bugs remain unclaimed.
3. Paste the flag token (e.g. `FLAG{7_clicks_unlocked_secret_treasure}`) and click **"Redeem Flag"**.
4. If valid and unclaimed, **+10 Points** are immediately awarded to your team!

### D. Tracking Results (`/my-submissions`):
- View your team's complete submission history.
- See real-time statuses: `VERIFIED (+points)`, `PENDING`, or `REJECTED`.
- View whether you captured the **⚡ First-to-Find Speed Bonus**.

### E. Live Leaderboard (`/leaderboard`):
- High-density live standings showing team ranks, verified bugs, speed bonuses, claimed treasure flags, milestone bonus (+10 pts), and total points.
- Features automatic 10-second background sync.
- Clear disclaimer: *Scores are tentative during competition hours and subject to judge review; no negative marking.*

---

## 4. Lead Judge & Admin Console (`/judge`)

### How to Access & Login:
1. **Navigate to the Judge URL**:
   - On Vercel: `https://<your-deployment-url>.vercel.app/judge`
   - On Localhost: `http://localhost:3001/judge`
   *(The "Judge Console" button is deliberately omitted from the public navbar so participants do not see or click it).*
2. **Enter the Secret Passcode PIN**:
   ```text
   laal_wala_AngryBird
   ```
   *(To change this PIN, update the `JUDGE_PIN` variable in `.env` or your Vercel Environment Variables).*
3. **Click "Access Triage Console"**:
   - The server verifies the PIN and issues an HTTP-only, secure HMAC-SHA256 session cookie.
   - The page instantly unlocks and displays the full Judge Console.
4. **Locking the Console / Logging Out**:
   - Click the **"Lock Console"** button in the top-right header at any time to invalidate the session cookie and return to the secure passcode screen.

### Inside the Judge Console:
1. **Triage Desk**:
   - Review incoming bug submissions in real-time.
   - **Automated AI Verification**: Submissions with $\ge 80\%$ confidence are automatically verified and awarded points immediately.
   - **Manual Verification & Review**: Review reproduction steps, optional snippets, and screenshots.
   - **One-Click Actions**:
     - `VERIFY & AWARD`: Confirms the finding, calculates base + first-to-find speed bonus, and credits the team score.
     - `SET PENDING`: Reverts a submission back to pending status and rolls back score if needed.
     - `REJECT`: Rejects invalid or out-of-scope submissions.
     - `Points Override` & `Judge Notes`: Customize points awarded or leave private notes.
2. **Master Bug Matrix & AI Reference Screenshots**:
   - Overview of all 54 Active Master Defects (18 Easy, 21 Medium, 15 Hard).
   - View which team captured the first-to-find speed bonus for each defect.
   - **Attach Ground-Truth Reference Screenshots**: Click `+ Attach` on any defect row to upload a reference screenshot. Gemini AI uses these ground-truth images for visual similarity comparison.
3. **Treasure Flag Codes (10 Reserved Slots)**:
   - Live management panel where judges can view, edit, or customize the secret flag tokens for all 10 Treasure Bug slots directly from the interface at any time. (Treasure flags are currently withheld/dormant in the storefront for staged release).
4. **Reset Controls (Competition & Storefront)**:
   - **"RESET STOREFRONT" Button**: Added in the Judge Console header. Sends a POST signal to the Amazon Storefront (`/api/admin/reset`) to immediately restore all ~60 products back to baseline stock counts, purge in-memory test orders, and clear test order records without restarting servers.
   - **"RESET COMPETITION" Button**: Completely wipes all test submissions, resets team scores, and resets all 10 treasure bug slots back to `UNCLAIMED` to start the competition on a pristine clean slate.

---

## 5. Official Competition Scoring Matrix

| Category | Active Count | Base Points | First-to-Find Speed Bonus | Max Points / Bug |
| :--- | :---: | :---: | :---: | :---: |
| **Easy Defects** | **18** | 3 pts | +2 pts | **5 pts** |
| **Medium Defects** | **21** | 5 pts | +5 pts | **10 pts** |
| **Hard Defects** | **15** *(HARD-03 Retired)* | 10 pts | +10 pts | **20 pts** |
| **TOTAL ACTIVE** | **54** | — | — | — |
| **Treasure Bugs** | 10 *(Withheld)* | 10 pts | — | **10 pts** |
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
