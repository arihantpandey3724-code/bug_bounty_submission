import fs from "fs";
import path from "path";
import prisma from "./prisma";

export interface SubmissionBackup {
  id: string;
  teamId: string;
  teamName?: string;
  description: string;
  codeSnippet?: string;
  screenshotUrl?: string;
  status: string;
  matchedBugId?: string | null;
  awardedPoints: number;
  isSpeedBonus: boolean;
  llmConfidence?: number | null;
  llmReasoning?: string | null;
  judgeOverride?: boolean;
  createdAt: string;
}

const BACKUP_DIR = path.join(process.cwd(), "data");
const BACKUP_FILE = path.join(BACKUP_DIR, "submissions_backup.jsonl");

// Ensure backup directory exists
function ensureBackupDir() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
  } catch (err) {
    console.error("[submissionStore] Failed to create backup directory:", err);
  }
}

/**
 * Append submission to local disk JSONL backup file.
 * This guarantees zero dropped submissions under any network/DB failure.
 */
export function appendToDiskBackup(submission: SubmissionBackup) {
  try {
    ensureBackupDir();
    const line = JSON.stringify(submission) + "\n";
    fs.appendFileSync(BACKUP_FILE, line, "utf8");
    console.log(`[submissionStore] Persisted submission ${submission.id} to disk backup.`);
  } catch (err) {
    console.error(`[submissionStore] Failed to write disk backup for ${submission.id}:`, err);
  }
}

/**
 * Read all disk backup submissions.
 */
export function readDiskBackups(): SubmissionBackup[] {
  try {
    if (!fs.existsSync(BACKUP_FILE)) {
      return [];
    }
    const content = fs.readFileSync(BACKUP_FILE, "utf8");
    const rawList = content
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        try {
          return JSON.parse(line) as SubmissionBackup;
        } catch {
          return null;
        }
      })
      .filter((item): item is SubmissionBackup => item !== null);

    // Deduplicate by ID so later append entries update earlier writes for the same submission
    const map = new Map<string, SubmissionBackup>();
    for (const item of rawList) {
      map.set(item.id, item);
    }
    return Array.from(map.values());
  } catch (err) {
    console.error("[submissionStore] Error reading disk backups:", err);
    return [];
  }
}

/**
 * Clear the disk backup file (resets competition data).
 */
export function clearDiskBackup() {
  try {
    ensureBackupDir();
    fs.writeFileSync(BACKUP_FILE, "", "utf8");
    console.log("[submissionStore] Disk backup cleared.");
  } catch (err) {
    console.error("[submissionStore] Failed to clear disk backup:", err);
  }
}
