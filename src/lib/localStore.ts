import fs from "fs";
import path from "path";
import { MASTER_BUGS, INITIAL_TREASURES, DEMO_TEAMS } from "@/config/masterBugs";
import { appendToDiskBackup, readDiskBackups, clearDiskBackup } from "./submissionStore";

export interface LocalTeam {
  id: string;
  name: string;
  email: string;
  totalScore: number;
  validBugsCount: number;
  hasMilestoneBonus: boolean;
  createdAt: string;
}

export interface LocalTreasure {
  id: number;
  code: string;
  isClaimed: boolean;
  claimedByTeamId: string | null;
  claimedByTeam: { id: string; name: string } | null;
  claimedAt: string | null;
}

export interface LocalMasterBug {
  id: string;
  title: string;
  category: string;
  basePoints: number;
  speedBonusPoints: number;
  location: string;
  expected: string;
  actual: string;
  isFirstFound: boolean;
  firstFoundById: string | null;
  firstFoundByTeam: string | null;
  totalReports: number;
  verifiedReports: number;
}

// In-memory state initialized with clean competition data
class LocalStore {
  teams: LocalTeam[] = [];
  treasures: LocalTreasure[] = [];
  bugs: Map<string, LocalMasterBug> = new Map();
  milestoneAwardedTo: string | null = null;
  milestoneAwardedAt: string | null = null;
  submissionsOpen: boolean = true;
  submissionsStatusUpdatedAt: string = new Date().toISOString();

  constructor() {
    this.init();
  }

  private init() {
    // 1. Seed DEMO_TEAMS as base (no mock scores)
    this.teams = DEMO_TEAMS.map((t, idx) => ({
      id: `team-${idx + 1}`,
      name: t.name,
      email: t.email,
      totalScore: 0,
      validBugsCount: 0,
      hasMilestoneBonus: false,
      createdAt: new Date().toISOString(),
    }));

    // 2. Treasures (all 10 slots 100% unclaimed)
    this.treasures = INITIAL_TREASURES.map((t) => ({
      id: t.id,
      code: t.code,
      isClaimed: false,
      claimedByTeamId: null,
      claimedByTeam: null,
      claimedAt: null,
    }));

    // 3. Master Bugs
    MASTER_BUGS.forEach((b) => {
      this.bugs.set(b.id, {
        ...b,
        isFirstFound: false,
        firstFoundById: null,
        firstFoundByTeam: null,
        totalReports: 0,
        verifiedReports: 0,
      });
    });

    // 4. Hydrate teams and scores from disk backup so leaderboard is correct after restart
    try {
      const allSubs = readDiskBackups();
      for (const sub of allSubs) {
        // Register team if not already known
        if (!this.teams.find((t) => t.id === sub.teamId)) {
          this.teams.push({
            id: sub.teamId,
            name: sub.teamName || "Team",
            email: "",
            totalScore: 0,
            validBugsCount: 0,
            hasMilestoneBonus: false,
            createdAt: sub.createdAt,
          });
        }
        // Rebuild scores from verified submissions only
        if (sub.status === "VERIFIED" && sub.awardedPoints > 0) {
          const team = this.teams.find((t) => t.id === sub.teamId);
          if (team) {
            team.totalScore += sub.awardedPoints;
            team.validBugsCount += 1;
            if (team.validBugsCount >= 10 && !team.hasMilestoneBonus) {
              team.hasMilestoneBonus = true;
              if (!this.milestoneAwardedTo) {
                this.milestoneAwardedTo = team.id;
                this.milestoneAwardedAt = sub.createdAt;
              }
            }
          }
        }
        // Rebuild master bug first-found state
        if (sub.isSpeedBonus && sub.matchedBugId && this.bugs.has(sub.matchedBugId)) {
          const b = this.bugs.get(sub.matchedBugId)!;
          if (!b.isFirstFound) {
            b.isFirstFound = true;
            b.firstFoundById = sub.teamId;
            b.firstFoundByTeam = sub.teamName || "Team";
          }
        }
        // Rebuild totalReports / verifiedReports on master bugs
        if (sub.matchedBugId && this.bugs.has(sub.matchedBugId)) {
          const b = this.bugs.get(sub.matchedBugId)!;
          b.totalReports += 1;
          if (sub.status === "VERIFIED") b.verifiedReports += 1;
        }
      }
      console.log(`[localStore] Hydrated ${this.teams.length} teams and ${allSubs.length} submissions from disk backup.`);
    } catch (e) {
      console.warn("[localStore] Could not hydrate from disk backup:", e);
    }

    // 5. Load portal config (Start/Stop state) from disk
    try {
      const configPath = path.join(process.cwd(), "data", "portal_config.json");
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, "utf8");
        const parsed = JSON.parse(raw);
        if (typeof parsed.submissionsOpen === "boolean") {
          this.submissionsOpen = parsed.submissionsOpen;
          this.submissionsStatusUpdatedAt = parsed.updatedAt || new Date().toISOString();
        }
      }
    } catch (e) {
      // fallback to true
    }
  }

  /**
   * Reset the entire local store state to pristine competition condition.
   */
  resetAll() {
    this.teams = [];
    this.treasures = INITIAL_TREASURES.map((t) => ({
      id: t.id,
      code: t.code,
      isClaimed: false,
      claimedByTeamId: null,
      claimedByTeam: null,
      claimedAt: null,
    }));
    this.bugs.clear();
    MASTER_BUGS.forEach((b) => {
      this.bugs.set(b.id, {
        ...b,
        isFirstFound: false,
        firstFoundById: null,
        firstFoundByTeam: null,
        totalReports: 0,
        verifiedReports: 0,
      });
    });
    this.milestoneAwardedTo = null;
    this.milestoneAwardedAt = null;
    this.submissionsOpen = true;
    this.submissionsStatusUpdatedAt = new Date().toISOString();
    clearDiskBackup();
    console.log("[localStore] Competition state completely reset to clean slate.");
  }

  isSubmissionsOpen(): boolean {
    return this.submissionsOpen;
  }

  setSubmissionsOpen(isOpen: boolean): boolean {
    this.submissionsOpen = isOpen;
    this.submissionsStatusUpdatedAt = new Date().toISOString();
    try {
      const configDir = path.join(process.cwd(), "data");
      if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
      const configPath = path.join(configDir, "portal_config.json");
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          submissionsOpen: isOpen,
          updatedAt: this.submissionsStatusUpdatedAt,
        }),
        "utf8"
      );
    } catch (e) {
      console.warn("[localStore] Failed to write portal_config.json:", e);
    }
    return this.submissionsOpen;
  }

  getTeams(): LocalTeam[] {
    return this.teams;
  }

  findTeamById(id: string): LocalTeam | undefined {
    return this.teams.find((t) => t.id === id);
  }

  findTeamByEmail(email: string): LocalTeam | undefined {
    return this.teams.find((t) => t.email.toLowerCase() === email.toLowerCase());
  }

  findTeamByName(name: string): LocalTeam | undefined {
    return this.teams.find((t) => t.name.toLowerCase() === name.toLowerCase());
  }

  createTeam(name: string, email: string): LocalTeam {
    const existing = this.findTeamByEmail(email) || this.findTeamByName(name);
    if (existing) return existing;

    const newTeam: LocalTeam = {
      id: `team-${Date.now()}`,
      name,
      email,
      totalScore: 0,
      validBugsCount: 0,
      hasMilestoneBonus: false,
      createdAt: new Date().toISOString(),
    };
    this.teams.push(newTeam);
    return newTeam;
  }

  /**
   * Get treasures. Never leaks the secret code to participants unless explicitly authorized.
   */
  getTreasures(includeCodes: boolean = false): any[] {
    return this.treasures.map((t) => ({
      id: t.id,
      isClaimed: t.isClaimed,
      claimedByTeamId: t.claimedByTeamId,
      claimedByTeam: t.claimedByTeam,
      claimedAt: t.claimedAt,
      ...(includeCodes ? { code: t.code } : {}),
    }));
  }

  updateTreasureCode(id: number, code: string) {
    const t = this.treasures.find((item) => item.id === id);
    if (t) {
      t.code = code;
    }
  }

  claimTreasure(teamId: string, code: string) {
    const cleanCode = code.trim();
    if (cleanCode === "FLAG{inspect_more_closely_first_level_decoy}") {
      return {
        error: "⚠️ Decoy Flag Detected! Nice attempt asking AI, but do not rely solely on automated shortcuts. Inspect the actual UI components manually to find the true treasure flag!",
      };
    }
    const t = this.treasures.find((item) => item.code.trim() === cleanCode);
    if (!t) return { error: "Invalid flag code" };
    if (t.isClaimed) return { error: `Treasure #${t.id} already claimed by ${t.claimedByTeam?.name || "another team"}` };

    const team = this.findTeamById(teamId);
    if (!team) return { error: "Team not found" };

    t.isClaimed = true;
    t.claimedByTeamId = teamId;
    t.claimedByTeam = { id: team.id, name: team.name };
    t.claimedAt = new Date().toISOString();

    team.totalScore += 10;
    team.validBugsCount += 1;

    // Check milestone
    this.checkMilestone(team);

    return { success: true, treasureId: t.id, newScore: team.totalScore };
  }

  getBugs(): LocalMasterBug[] {
    return Array.from(this.bugs.values());
  }

  getBug(id: string): LocalMasterBug | undefined {
    return this.bugs.get(id);
  }

  createSubmission(data: {
    teamId: string;
    description: string;
    codeSnippet?: string | null;
    screenshotUrl?: string | null;
    matchedBugId?: string | null;
    llmConfidence?: number | null;
    llmReasoning?: string | null;
    status?: string;
    awardedPoints?: number;
    isSpeedBonus?: boolean;
  }) {
    const team = this.findTeamById(data.teamId);
    const id = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const status = data.status || "UNVERIFIED";
    let awardedPoints = data.awardedPoints || 0;
    const isSpeedBonus = Boolean(data.isSpeedBonus);

    const submission = {
      id,
      teamId: data.teamId,
      teamName: team?.name || "Unknown",
      description: data.description,
      codeSnippet: data.codeSnippet || undefined,
      screenshotUrl: data.screenshotUrl || undefined,
      status,
      matchedBugId: data.matchedBugId || null,
      awardedPoints,
      isSpeedBonus,
      llmConfidence: data.llmConfidence || null,
      llmReasoning: data.llmReasoning || null,
      judgeOverride: false,
      createdAt: new Date().toISOString(),
    };

    if (status === "VERIFIED") {
      // Check if team already has a verified submission for this bug with awardedPoints > 0
      const existingSubmissions = readDiskBackups();
      const alreadyAwarded = data.matchedBugId && existingSubmissions.some(
        (s) => s.teamId === data.teamId && s.matchedBugId === data.matchedBugId && s.status === "VERIFIED" && s.awardedPoints > 0
      );

      if (alreadyAwarded) {
        awardedPoints = 0;
        submission.awardedPoints = 0;
        submission.isSpeedBonus = false;
        submission.llmReasoning = `[DUPLICATE] Team has already received points for Bug ${data.matchedBugId}. Duplicate submissions do not award additional score.`;
      } else {
        if (data.matchedBugId && this.bugs.has(data.matchedBugId)) {
          const b = this.bugs.get(data.matchedBugId)!;
          b.totalReports += 1;
          b.verifiedReports += 1;
          if (isSpeedBonus) {
            b.isFirstFound = true;
            b.firstFoundById = data.teamId;
            b.firstFoundByTeam = team?.name || "Team";
          }
        }
        if (team) {
          team.totalScore += awardedPoints;
          team.validBugsCount += 1;
          this.checkMilestone(team);
        }
      }
    } else if (data.matchedBugId && this.bugs.has(data.matchedBugId)) {
      const b = this.bugs.get(data.matchedBugId)!;
      b.totalReports += 1;
    }

    // Always append to disk backup
    appendToDiskBackup(submission);

    return submission;
  }

  getSubmissions(filter?: { teamId?: string; status?: string }) {
    let list = readDiskBackups();

    if (filter?.teamId) {
      list = list.filter((s) => s.teamId === filter.teamId);
    }
    if (filter?.status && filter.status !== "ALL") {
      list = list.filter((s) => s.status === filter.status);
    }

    return list.map((s) => ({
      ...s,
      team: { id: s.teamId, name: s.teamName || "Team" },
      matchedBug: s.matchedBugId ? this.bugs.get(s.matchedBugId) : null,
    }));
  }

  judgeSubmission(
    submissionId: string,
    status: "VERIFIED" | "REJECTED" | "UNVERIFIED" | "PENDING",
    matchedBugId?: string | null,
    overridePoints?: number | null,
    judgeNotes?: string,
    isSpeedBonus?: boolean
  ) {
    const submissions = readDiskBackups();
    const sub = submissions.find((s) => s.id === submissionId);
    if (!sub) return null;

    const team = this.findTeamById(sub.teamId);
    const effBugId = matchedBugId || sub.matchedBugId;
    const targetStatus = status === "PENDING" ? "UNVERIFIED" : status;

    if (targetStatus === "REJECTED" || targetStatus === "UNVERIFIED") {
      // Revert points if was previously verified
      if (sub.status === "VERIFIED" && team && sub.awardedPoints > 0) {
        team.totalScore = Math.max(0, team.totalScore - sub.awardedPoints);
        team.validBugsCount = Math.max(0, team.validBugsCount - 1);
      }

      // Revert speed bonus on master bug if this sub was the first found
      if (sub.isSpeedBonus && sub.matchedBugId && this.bugs.has(sub.matchedBugId)) {
        const b = this.bugs.get(sub.matchedBugId)!;
        b.isFirstFound = false;
        b.firstFoundById = null;
        b.firstFoundByTeam = null;
      }

      sub.status = targetStatus;
      sub.awardedPoints = 0;
      sub.isSpeedBonus = false;
      sub.judgeOverride = true;
      if (judgeNotes) {
        sub.llmReasoning = `[Judge ${targetStatus === "REJECTED" ? "Rejected" : "Moved to Pending"}]: ${judgeNotes}`;
      }
    } else {
      let isSpeed = false;
      let pts = 3;

      // Check if team already has another verified submission for this bug
      const alreadyAwarded = effBugId && submissions.some(
        (s) => s.teamId === sub.teamId && s.matchedBugId === effBugId && s.status === "VERIFIED" && s.id !== sub.id && s.awardedPoints > 0
      );

      if (alreadyAwarded) {
        pts = 0;
        isSpeed = false;
      } else if (overridePoints !== undefined && overridePoints !== null) {
        pts = overridePoints;
        isSpeed = isSpeedBonus ?? false;
      } else if (effBugId && this.bugs.has(effBugId)) {
        const b = this.bugs.get(effBugId)!;
        if (isSpeedBonus !== undefined) {
          isSpeed = isSpeedBonus;
          if (isSpeed && !b.isFirstFound) {
            b.isFirstFound = true;
            b.firstFoundById = sub.teamId;
            b.firstFoundByTeam = team?.name || "Team";
          }
        } else if (!b.isFirstFound) {
          isSpeed = true;
          b.isFirstFound = true;
          b.firstFoundById = sub.teamId;
          b.firstFoundByTeam = team?.name || "Team";
        }
        b.verifiedReports += 1;
        pts = b.basePoints + (isSpeed ? b.speedBonusPoints : 0);
      }

      const prevPoints = sub.status === "VERIFIED" ? sub.awardedPoints : 0;
      const pointDifference = pts - prevPoints;
      const countInc = sub.status === "VERIFIED" ? 0 : 1;

      sub.status = "VERIFIED";
      sub.awardedPoints = pts;
      sub.isSpeedBonus = isSpeed;
      sub.matchedBugId = effBugId || null;
      sub.judgeOverride = true;
      if (judgeNotes) sub.llmReasoning = `[Judge Approved]: ${judgeNotes}`;

      if (team) {
        team.totalScore += pointDifference;
        team.validBugsCount += countInc;
        this.checkMilestone(team);
      }
    }

    // Re-save disk backup
    try {
      const backupPath = path.join(process.cwd(), "data", "submissions_backup.jsonl");
      const content = submissions.map((s) => JSON.stringify(s) + "\n").join("");
      fs.writeFileSync(backupPath, content, "utf8");
    } catch (e) {
      console.warn("Failed to overwrite backup:", e);
    }

    return sub;
  }

  private checkMilestone(team: LocalTeam) {
    if (!this.milestoneAwardedTo && team.validBugsCount >= 10) {
      this.milestoneAwardedTo = team.id;
      this.milestoneAwardedAt = new Date().toISOString();
      team.hasMilestoneBonus = true;
      team.totalScore += 10;
    }
  }
}

// Global singleton
declare global {
  // eslint-disable-next-line no-var
  var localStoreGlobal: LocalStore | undefined;
}

export const localStore = globalThis.localStoreGlobal ?? new LocalStore();
if (process.env.NODE_ENV !== "production") {
  globalThis.localStoreGlobal = localStore;
}

export default localStore;
