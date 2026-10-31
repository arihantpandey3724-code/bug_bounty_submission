import { sql } from "./neonClient";
import { invalidateCache } from "./memoryCache";
import localStore from "./localStore";

export const POINT_TABLE = {
  EASY: { base: 3, speed: 2, max: 5 },
  MEDIUM: { base: 5, speed: 5, max: 10 },
  HARD: { base: 10, speed: 10, max: 20 },
  TREASURE: { base: 10, speed: 0, max: 10 },
} as const;

export const MILESTONE_BONUS_POINTS = 10;
export const MILESTONE_THRESHOLD = 10; // 10 valid bugs

export function calculateRegularPoints(
  category: string,
  isSpeedBonus: boolean
): number {
  const cat = category.toUpperCase() as keyof typeof POINT_TABLE;
  const config = POINT_TABLE[cat] || POINT_TABLE.EASY;
  return config.base + (isSpeedBonus ? config.speed : 0);
}

/**
 * Authoritative recalculation of a team's total score and valid bugs count.
 * Calculates totalScore as:
 *   (SUM of awardedPoints of distinct VERIFIED submissions)
 *   + (claimed treasures * 10)
 *   + (hasMilestoneBonus ? 10 : 0)
 * Completely eliminates double-counting, phantom scores, and decrements properly to 0 on rejection.
 */
export async function recalculateTeamScore(teamId: string) {
  try {
    // 1. Fetch verified submissions, treasures, and milestone concurrently for minimum latency
    const [verifiedSubs, treasures, milestone] = await Promise.all([
      sql`
        SELECT id, "matchedBugId", "awardedPoints"
        FROM "RegularSubmission"
        WHERE "teamId" = ${teamId} AND status = 'VERIFIED'
        ORDER BY "createdAt" ASC;
      `,
      sql`
        SELECT COUNT(*) as count
        FROM "TreasureBug"
        WHERE "claimedByTeamId" = ${teamId};
      `,
      sql`
        SELECT id FROM "MilestoneTracker" WHERE "awardedToTeamId" = ${teamId} LIMIT 1;
      `,
    ]);

    // Calculate distinct points per bug defect (rules specify only one award per master bug)
    const awardedBugs = new Set<string>();
    let submissionPoints = 0;
    let uniqueBugCount = 0;

    for (const s of verifiedSubs) {
      if (s.matchedBugId) {
        if (!awardedBugs.has(s.matchedBugId)) {
          awardedBugs.add(s.matchedBugId);
          submissionPoints += s.awardedPoints;
          if (s.awardedPoints > 0) uniqueBugCount++;
        } else {
          // Zero out duplicate submissions for the same defect
          if (s.awardedPoints > 0) {
            await sql`
              UPDATE "RegularSubmission"
              SET "awardedPoints" = 0, "isSpeedBonus" = false
              WHERE id = ${s.id};
            `;
          }
        }
      } else {
        submissionPoints += s.awardedPoints;
        if (s.awardedPoints > 0) uniqueBugCount++;
      }
    }

    // 2. Claimed treasures count
    const treasureCount = parseInt(treasures[0]?.count || 0);
    const treasurePoints = treasureCount * 10;

    // 3. Milestone tracker
    const totalBugs = uniqueBugCount + treasureCount;
    let hasMilestone = milestone.length > 0;

    if (!hasMilestone && totalBugs >= MILESTONE_THRESHOLD) {
      const claim = await sql`
        UPDATE "MilestoneTracker"
        SET "awardedToTeamId" = ${teamId}, "awardedAt" = NOW()
        WHERE id = 1 AND "awardedToTeamId" IS NULL
        RETURNING id;
      `;
      if (claim.length > 0) hasMilestone = true;
    }

    const milestonePoints = hasMilestone ? 10 : 0;
    const totalScore = Math.max(0, submissionPoints + treasurePoints + milestonePoints);

    // 4. Update team record in PostgreSQL
    await sql`
      UPDATE "Team"
      SET "totalScore" = ${totalScore},
          "validBugsCount" = ${totalBugs},
          "hasMilestoneBonus" = ${hasMilestone}
      WHERE id = ${teamId};
    `;

    // 5. Invalidate caches so UI reflects new score instantly
    invalidateCache("leaderboard");
    invalidateCache("stats");
    invalidateCache(`team_${teamId}`);

    // 6. Update in-memory localStore
    const locTeam = localStore.findTeamById(teamId);
    if (locTeam) {
      locTeam.totalScore = totalScore;
      locTeam.validBugsCount = totalBugs;
      locTeam.hasMilestoneBonus = hasMilestone;
    }

    return { totalScore, validBugsCount: totalBugs };
  } catch (err: any) {
    console.error("[scoring] Error in recalculateTeamScore:", err);
    throw err;
  }
}

/**
 * Execute judge verdict for a submission using direct HTTPS Neon SQL.
 */
export async function executeJudgeVerdict({
  submissionId,
  status, // "VERIFIED" | "REJECTED" | "UNVERIFIED" | "PENDING"
  matchedBugId,
  overridePoints,
  judgeNotes,
  isSpeedBonus,
}: {
  submissionId: string;
  status: "VERIFIED" | "REJECTED" | "UNVERIFIED" | "PENDING";
  matchedBugId?: string | null;
  overridePoints?: number | null;
  judgeNotes?: string;
  isSpeedBonus?: boolean;
}) {
  const rows = await sql`
    SELECT s.id, s."teamId", s.status, s."awardedPoints", s."isSpeedBonus", s."matchedBugId", s."llmReasoning"
    FROM "RegularSubmission" s
    WHERE s.id = ${submissionId}
    LIMIT 1;
  `;

  if (rows.length === 0) {
    throw new Error("Submission not found");
  }

  const submission = rows[0];
  const effectiveBugId = matchedBugId ?? submission.matchedBugId;
  const targetStatus = status === "PENDING" ? "UNVERIFIED" : status;

  if (targetStatus === "REJECTED" || targetStatus === "UNVERIFIED") {
    // If this submission had claimed the first-to-find speed bonus, release the lock on the master bug
    if (submission.isSpeedBonus && submission.matchedBugId) {
      await sql`
        UPDATE "MasterBug"
        SET "isFirstFound" = false, "firstFoundById" = NULL
        WHERE id = ${submission.matchedBugId};
      `;
    }

    const reasoning = judgeNotes
      ? `[Judge ${targetStatus === "REJECTED" ? "Rejected" : "Moved to Pending"}]: ${judgeNotes}`
      : submission.llmReasoning;

    await sql`
      UPDATE "RegularSubmission"
      SET status = ${targetStatus},
          "awardedPoints" = 0,
          "isSpeedBonus" = false,
          "judgeOverride" = true,
          "matchedBugId" = ${effectiveBugId},
          "llmReasoning" = ${reasoning}
      WHERE id = ${submissionId};
    `;

    // Recalculate team score directly in PostgreSQL
    await recalculateTeamScore(submission.teamId);

    return { id: submissionId, teamId: submission.teamId, status: targetStatus, awardedPoints: 0 };
  }

  // --- Process VERIFIED ---
  let isSpeed = false;
  let pointsToAward = 0;

  // Check if team already has another verified submission for this bug with awardedPoints > 0
  let isDuplicateAward = false;
  if (effectiveBugId) {
    const existing = await sql`
      SELECT id FROM "RegularSubmission"
      WHERE "teamId" = ${submission.teamId} AND "matchedBugId" = ${effectiveBugId}
        AND status = 'VERIFIED' AND id != ${submissionId} AND "awardedPoints" > 0
      LIMIT 1;
    `;
    if (existing.length > 0) {
      isDuplicateAward = true;
    }
  }

  if (isDuplicateAward) {
    pointsToAward = 0;
    isSpeed = false;
  } else if (overridePoints !== undefined && overridePoints !== null && overridePoints >= 0) {
    pointsToAward = overridePoints;
    isSpeed = isSpeedBonus ?? false;
  } else if (effectiveBugId) {
    const bugRows = await sql`
      SELECT id, category, "isFirstFound" FROM "MasterBug" WHERE id = ${effectiveBugId} LIMIT 1;
    `;

    if (bugRows.length > 0) {
      const bug = bugRows[0];
      if (isSpeedBonus !== undefined) {
        isSpeed = isSpeedBonus;
      } else if (!bug.isFirstFound) {
        isSpeed = true;
      }
      pointsToAward = calculateRegularPoints(bug.category, isSpeed);
    } else {
      pointsToAward = 3;
      isSpeed = isSpeedBonus ?? false;
    }
  } else {
    pointsToAward = 3;
    isSpeed = isSpeedBonus ?? false;
  }

  // If first found, mark master bug
  if (effectiveBugId && isSpeed) {
    await sql`
      UPDATE "MasterBug"
      SET "isFirstFound" = true, "firstFoundById" = ${submission.teamId}
      WHERE id = ${effectiveBugId};
    `;
  }

  const reasoning = judgeNotes
    ? `[Judge Approved]: ${judgeNotes}`
    : submission.llmReasoning;

  await sql`
    UPDATE "RegularSubmission"
    SET status = 'VERIFIED',
        "awardedPoints" = ${pointsToAward},
        "isSpeedBonus" = ${isSpeed},
        "judgeOverride" = true,
        "matchedBugId" = ${effectiveBugId},
        "llmReasoning" = ${reasoning}
    WHERE id = ${submissionId};
  `;

  // Authoritative team score recalculation
  await recalculateTeamScore(submission.teamId);

  return { id: submissionId, teamId: submission.teamId, status: "VERIFIED", awardedPoints: pointsToAward };
}
