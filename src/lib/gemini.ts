import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { MASTER_BUGS } from "@/config/masterBugs";

const REF_DIR = path.join(process.cwd(), "data", "reference_screenshots");

function getReferenceScreenshot(bugId: string): { mimeType: string; data: string } | null {
  try {
    const filePath = path.join(REF_DIR, `${bugId.toUpperCase()}.png`);
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      return {
        mimeType: "image/png",
        data: buffer.toString("base64"),
      };
    }
  } catch {
    // Ignore
  }
  return null;
}

export interface EvaluationResult {
  matchedBugId: string | null;
  confidence: number;
  reasoning: string;
  suggestedStatus: "VERIFIED" | "REJECTED" | "UNVERIFIED";
}

/**
 * Intelligent local heuristic matching engine.
 * Used when GEMINI_API_KEY is not configured or as instant fallback if API is unreachable.
 */
export function heuristicEvaluate(
  description: string,
  codeSnippet?: string | null
): EvaluationResult {
  const combined = `${description || ""} ${codeSnippet || ""}`.toLowerCase();

  let bestMatch: (typeof MASTER_BUGS)[0] | null = null;
  let highestScore = 0;

  for (const bug of MASTER_BUGS) {
    let score = 0;

    // Direct ID reference
    const cleanId = bug.id.toLowerCase();
    const cleanIdAlt = cleanId.replace("-", " ");
    const cleanIdAlt2 = cleanId.replace("-", "_");
    if (
      combined.includes(cleanId) ||
      combined.includes(cleanIdAlt) ||
      combined.includes(cleanIdAlt2)
    ) {
      score += 10;
    }

    // Title token matching
    const titleWords = bug.title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    for (const word of titleWords) {
      if (combined.includes(word)) {
        score += 2;
      }
    }

    // Location tokens (e.g. "header", "checkout", "orders", "cart")
    const locWords = bug.location
      .toLowerCase()
      .split(/[\/\s\.]+/)
      .filter((w) => w.length > 4);
    for (const word of locWords) {
      if (combined.includes(word)) {
        score += 1.5;
      }
    }

    // Key defect phrases
    if (bug.id === "EASY-01" && (combined.includes("logo") || combined.includes("/about"))) score += 6;
    if (bug.id === "EASY-02" && (combined.includes("theme") || combined.includes("sun") || combined.includes("moon"))) score += 6;
    if (bug.id === "EASY-03" && (combined.includes("cart badge") || combined.includes("counter") || combined.includes("reload"))) score += 6;
    if (bug.id === "EASY-04" && (combined.includes("carousel") || combined.includes("right arrow"))) score += 6;
    if (bug.id === "EASY-05" && (combined.includes("denim jacket") || combined.includes("running shoes"))) score += 6;
    if (bug.id === "EASY-06" && (combined.includes("decrement") || combined.includes("negative") || combined.includes("-1"))) score += 6;
    if (bug.id === "EASY-07" && (combined.includes("375px") || combined.includes("overflow") || combined.includes("mobile"))) score += 6;
    if (bug.id === "EASY-08" && (combined.includes("country") || combined.includes("dropdown revert"))) score += 6;
    if (bug.id === "EASY-09" && (combined.includes("tooltip") || combined.includes("cvv"))) score += 6;
    if (bug.id === "EASY-10" && (combined.includes("password mask") || combined.includes("plain text") || combined.includes("type=text"))) score += 6;
    if (bug.id === "EASY-11" && (combined.includes("contact") || combined.includes("blank email"))) score += 6;
    if (bug.id === "EASY-12" && (combined.includes("faq") || combined.includes("accordion"))) score += 6;
    if (bug.id === "EASY-13" && (combined.includes("privacy policy") || combined.includes("404"))) score += 6;
    if (bug.id === "EASY-14" && (combined.includes("cookie") || combined.includes("z-index") || combined.includes("newsletter"))) score += 6;
    if (bug.id === "EASY-15" && (combined.includes("target=_blank") || combined.includes("target attribute"))) score += 6;
    if (bug.id === "EASY-16" && (combined.includes("1 star") || combined.includes("filter inversion"))) score += 6;
    if (bug.id === "EASY-17" && (combined.includes("pagination") || combined.includes("next page") || combined.includes("out of bounds"))) score += 6;
    if (bug.id === "EASY-18" && (combined.includes("cad") || combined.includes("currency conversion"))) score += 6;

    if (bug.id === "MED-01" && (combined.includes("case sensitive") || combined.includes("headphones"))) score += 6;
    if (bug.id === "MED-02" && (combined.includes("faceted") || combined.includes("filter overwrite"))) score += 6;
    if (bug.id === "MED-03" && (combined.includes("lexicographical") || combined.includes("sort"))) score += 6;
    if (bug.id === "MED-04" && (combined.includes("extra page") || combined.includes("phantom"))) score += 6;
    if (bug.id === "MED-05" && (combined.includes("quickview") || combined.includes("focus trap") || combined.includes("escape"))) score += 6;
    if (bug.id === "MED-06" && (combined.includes("wishlist") || combined.includes("heart"))) score += 6;
    if (bug.id === "MED-07" && (combined.includes("coupon") || combined.includes("compounding") || combined.includes("iterative"))) score += 6;
    if (bug.id === "MED-08" && (combined.includes("multiplication") || combined.includes("line item qty"))) score += 6;
    if (bug.id === "MED-09" && (combined.includes("autofill") || combined.includes("continue button disabled"))) score += 6;
    if (bug.id === "MED-10" && (combined.includes("tax") || combined.includes("pre-discount") || combined.includes("post-discount"))) score += 6;
    if (bug.id === "MED-11" && (combined.includes("eur") || combined.includes("usd") || combined.includes("symbol swap"))) score += 6;
    if (bug.id === "MED-12" && (combined.includes("card") || combined.includes("space") || combined.includes("truncat"))) score += 6;
    if (bug.id === "MED-13" && (combined.includes("debounce") || combined.includes("rapid click") || combined.includes("duplicate order"))) score += 6;
    if (bug.id === "MED-14" && (combined.includes("address") || combined.includes("delete") || combined.includes("offset"))) score += 6;
    if (bug.id === "MED-15" && (combined.includes("avatar") || combined.includes("mime") || combined.includes(".txt") || combined.includes(".pdf"))) score += 6;
    if (bug.id === "MED-16" && (combined.includes("confirm password") || combined.includes("registration match"))) score += 6;
    if (bug.id === "MED-17" && (combined.includes("checkout redirect") || combined.includes("homepage redirect"))) score += 6;
    if (bug.id === "MED-18" && (combined.includes("cart overwrite") || combined.includes("resets to 1"))) score += 6;
    if (bug.id === "MED-19" && (combined.includes("zip") || combined.includes("whitespace"))) score += 6;
    if (bug.id === "MED-20" && (combined.includes("variant pricing") || combined.includes("upgraded price"))) score += 6;
    if (bug.id === "MED-21" && (combined.includes("infinite scroll") || combined.includes("duplicate products"))) score += 6;

    if (bug.id === "HARD-01" && (combined.includes("pricing authority") || combined.includes("unitprice") || combined.includes("client payload"))) score += 8;
    if (bug.id === "HARD-02" && (combined.includes("idor") || combined.includes("parameter enumeration") || combined.includes("/orders/"))) score += 8;
    if (bug.id === "HARD-03" && (combined.includes("admin/users") || combined.includes("access control") || combined.includes("unrestricted"))) score += 8;
    if (bug.id === "HARD-04" && (combined.includes("post-logout") || combined.includes("token validity") || combined.includes("revocation"))) score += 8;
    if (bug.id === "HARD-05" && (combined.includes("password reset token") || combined.includes("reusable"))) score += 8;
    if (bug.id === "HARD-06" && (combined.includes("open redirect") || combined.includes("?redirect="))) score += 8;
    if (bug.id === "HARD-07" && (combined.includes("xss") || combined.includes("onerror") || combined.includes("unescaped"))) score += 8;
    if (bug.id === "HARD-08" && (combined.includes("guest") || combined.includes("cart wipe") || combined.includes("merge"))) score += 8;
    if (bug.id === "HARD-09" && (combined.includes("tab storage") || combined.includes("sync conflict") || combined.includes("resurrect"))) score += 8;
    if (bug.id === "HARD-10" && (combined.includes("delivered") || combined.includes("cancellation") || combined.includes("state transition"))) score += 8;
    if (bug.id === "HARD-11" && (combined.includes("negative quantity") || combined.includes("boundary") || combined.includes("-5"))) score += 8;
    if (bug.id === "HARD-12" && (combined.includes("localstorage") || combined.includes("session storage cleanup") || combined.includes("logout retained"))) score += 8;
    if (bug.id === "HARD-13" && (combined.includes("privilege escalation") || combined.includes("role") || combined.includes("parameter filtering"))) score += 8;
    if (bug.id === "HARD-14" && (combined.includes("promo stacking") || combined.includes("case sensitive promo"))) score += 8;
    if (bug.id === "HARD-15" && (combined.includes("truncation tax") || combined.includes("math.floor") || combined.includes("tax evasion"))) score += 8;
    if (bug.id === "HARD-16" && (combined.includes("race condition") || combined.includes("max quantity"))) score += 8;

    if (score > highestScore) {
      highestScore = score;
      bestMatch = bug;
    }
  }

  if (bestMatch && highestScore >= 6) {
    const confidence = Math.min(0.95, Math.max(0.65, highestScore / 15));
    return {
      matchedBugId: bestMatch.id,
      confidence: Number(confidence.toFixed(2)),
      reasoning: `Matched Master Bug [${bestMatch.id}] "${bestMatch.title}" based on reported behavior, error location, and code signatures.`,
      suggestedStatus: confidence >= 0.75 ? "VERIFIED" : "UNVERIFIED",
    };
  }

  return {
    matchedBugId: null,
    confidence: 0.2,
    reasoning: "Submission content does not strongly correspond to any known master defect catalog entry. Sent to judge triage for manual review.",
    suggestedStatus: "UNVERIFIED",
  };
}

/**
 * Multimodal Evaluation using Google Gen AI SDK (@google/genai).
 * Evaluates text description, code snippet, and screenshot against Master Bug catalog.
 */
export async function evaluateSubmissionWithAI({
  description,
  codeSnippet,
  screenshotUrl,
}: {
  description: string;
  codeSnippet?: string | null;
  screenshotUrl?: string | null;
}): Promise<EvaluationResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim().length === 0) {
    console.log("[gemini] GEMINI_API_KEY not configured. Running intelligent heuristic evaluation.");
    return heuristicEvaluate(description, codeSnippet);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Build the master bug reference guide for Gemini
    const catalogSummary = MASTER_BUGS.map(
      (b) =>
        `- ID: ${b.id} | Title: "${b.title}" | Category: ${b.category} | Location: ${b.location} | Expected: ${b.expected} | Actual: ${b.actual}`
    ).join("\n");

    const prompt = `You are the lead QA Judge for the Entropy 2K26 E-Commerce Bug Bounty Simulation.
Your task is to analyze a team's bug submission against the official Master Bug catalog below and evaluate its validity.

=== MASTER BUG CATALOG (55 DEFECTS) ===
${catalogSummary}

=== PARTICIPANT SUBMISSION ===
- Description / Reproduction Steps:
${description || "(No description provided)"}

- Code Snippet:
${codeSnippet || "(No code snippet provided)"}

=== INSTRUCTIONS ===
1. Compare the reported issue against the 55 Master Bugs.
2. Determine if this submission matches a specific Master Bug (e.g. "EASY-01", "MED-03", "HARD-01").
3. Determine confidence score between 0.00 and 1.00.
   CRITICAL REQUIREMENT: Screenshots and code snippets are strictly OPTIONAL for participants. If the participant's text description clearly details what occurred, where the defect happened, and reproduction steps matching one of the 55 Master Bugs, award high confidence (>= 0.85). Do NOT lower confidence or reject a submission merely because a screenshot or code snippet was not provided.
4. Output strict JSON with these keys:
   {
     "matchedBugId": "EASY-01" | null,
     "confidence": 0.85,
     "suggestedStatus": "VERIFIED" | "REJECTED" | "UNVERIFIED",
     "reasoning": "Clear 1-2 sentence explanation of the match or mismatch"
   }
Respond ONLY with the JSON object. Do not include markdown code fence formatting or commentary.`;

    const contents: any[] = [{ text: prompt }];

    // Pre-evaluate to check if candidate master defect has a ground-truth reference screenshot
    const heuristicCandidate = heuristicEvaluate(description, codeSnippet);
    let refAttached = false;
    if (heuristicCandidate.matchedBugId) {
      const refImage = getReferenceScreenshot(heuristicCandidate.matchedBugId);
      if (refImage) {
        contents.push({
          inlineData: refImage,
        });
        contents.push({
          text: `[GROUND-TRUTH REFERENCE IMAGE]: The image above is the official reference defect screenshot for Master Bug [${heuristicCandidate.matchedBugId}]. If the participant also submitted a screenshot, compare their screenshot against this reference image for visual defect similarity.`,
        });
        refAttached = true;
      }
    }

    // If an image screenshot is provided by the participant in Base64 data URL format
    if (screenshotUrl && screenshotUrl.startsWith("data:image/")) {
      const parts = screenshotUrl.split(",");
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
      const base64Data = parts[1];

      if (base64Data) {
        contents.push({
          inlineData: {
            mimeType,
            data: base64Data,
          },
        });
        contents.push({
          text: refAttached
            ? "[PARTICIPANT SCREENSHOT]: The image above is the participant's submitted proof. Evaluate visual similarity, UI location, and defect manifestation compared to the ground-truth reference image."
            : "[PARTICIPANT SCREENSHOT]: The image above is the participant's submitted proof. Analyze visual UI elements, error banners, or discrepancies shown.",
        });
      }
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
    });

    const rawText = response.text?.trim() || "";
    // Clean any accidental markdown fence
    const jsonText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(jsonText);

    return {
      matchedBugId: parsed.matchedBugId || null,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.7,
      suggestedStatus:
        parsed.suggestedStatus === "VERIFIED" || parsed.suggestedStatus === "REJECTED"
          ? parsed.suggestedStatus
          : "UNVERIFIED",
      reasoning: parsed.reasoning || "Evaluated by Gemini AI.",
    };
  } catch (err) {
    console.warn("[gemini] Error during Google Gen AI evaluation, falling back to heuristic:", err);
    return heuristicEvaluate(description, codeSnippet);
  }
}
