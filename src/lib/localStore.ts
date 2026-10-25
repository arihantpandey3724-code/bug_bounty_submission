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

  constructor() {
    this.init();
  }

  private init() {
    // 1. Teams (starts empty - no mock/demo teams)
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
    clearDiskBackup();
    console.log("[localStore] Competition state completely reset to clean slate.");
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
  }) {
    const team = this.findTeamById(data.teamId);
    const id = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const submission = {
      id,
      teamId: data.teamId,
      teamName: team?.name || "Unknown",
      description: data.description,
      codeSnippet: data.codeSnippet || undefined,
      screenshotUrl: data.screenshotUrl || undefined,
      status: "UNVERIFIED",
      matchedBugId: data.matchedBugId || null,
      awardedPoints: 0,
      isSpeedBonus: false,
      llmConfidence: data.llmConfidence || null,
      llmReasoning: data.llmReasoning || null,
      judgeOverride: false,
      createdAt: new Date().toISOString(),
    };

    // Always append to disk backup
    appendToDiskBackup(submission);

    if (data.matchedBugId && this.bugs.has(data.matchedBugId)) {
      const b = this.bugs.get(data.matchedBugId)!;
      b.totalReports += 1;
    }

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
    status: "VERIFIED" | "REJECTED",
    matchedBugId?: string | null,
    overridePoints?: number | null,
    judgeNotes?: string
  ) {
    const submissions = readDiskBackups();
    const sub = submissions.find((s) => s.id === submissionId);
    if (!sub) return null;

    const team = this.findTeamById(sub.teamId);
    const effBugId = matchedBugId || sub.matchedBugId;

    if (status === "REJECTED") {
      sub.status = "REJECTED";
      sub.awardedPoints = 0;
      sub.isSpeedBonus = false;
      sub.judgeOverride = true;
      if (judgeNotes) sub.llmReasoning = `[Judge Reject]: ${judgeNotes}`;
    } else {
      let isSpeed = false;
      let pts = 3;

      if (overridePoints !== undefined && overridePoints !== null) {
        pts = overridePoints;
      } else if (effBugId && this.bugs.has(effBugId)) {
        const b = this.bugs.get(effBugId)!;
        if (!b.isFirstFound) {
          isSpeed = true;
          b.isFirstFound = true;
          b.firstFoundById = sub.teamId;
          b.firstFoundByTeam = team?.name || "Team";
        }
        b.verifiedReports += 1;
        pts = b.basePoints + (isSpeed ? b.speedBonusPoints : 0);
      }

      sub.status = "VERIFIED";
      sub.awardedPoints = pts;
      sub.isSpeedBonus = isSpeed;
      sub.matchedBugId = effBugId || null;
      sub.judgeOverride = true;
      if (judgeNotes) sub.llmReasoning = `[Judge Approved]: ${judgeNotes}`;

      if (team) {
        team.totalScore += pts;
        team.validBugsCount += 1;
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
