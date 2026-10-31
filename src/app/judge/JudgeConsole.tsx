"use client";

import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Save,
  AlertCircle,
  Clock,
} from "lucide-react";

export default function JudgeConsole() {
  // Tabs: "triage" | "matrix" | "treasures"
  const [activeTab, setActiveTab] = useState<"triage" | "matrix" | "treasures">("triage");

  // Triage state
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("UNVERIFIED");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Per-submission judge controls state
  const [judgeFormState, setJudgeFormState] = useState<{
    [id: string]: {
      matchedBugId: string;
      overridePoints: string;
      judgeNotes: string;
      isSpeedBonus?: boolean;
    };
  }>({});

  // Matrix state (populated strictly from server API)
  const [masterBugsData, setMasterBugsData] = useState<any[]>([]);
  const [availableRefImages, setAvailableRefImages] = useState<string[]>([]);
  const [uploadingRefBugId, setUploadingRefBugId] = useState<string | null>(null);
  const [previewRefImageUrl, setPreviewRefImageUrl] = useState<{ bugId: string; url: string } | null>(null);

  // Treasures state
  const [treasuresData, setTreasuresData] = useState<any[]>([]);
  const [editingCode, setEditingCode] = useState<{ [id: number]: string }>({});
  const [savingTreasureId, setSavingTreasureId] = useState<number | null>(null);
  const [isPortalOpen, setIsPortalOpen] = useState(true);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  useEffect(() => {
    loadPortalStatus();
    loadTriageSubmissions();
    loadMasterBugs();
    loadTreasures();
    loadReferenceImages();
  }, [statusFilter]);

  async function handleLogout() {
    try {
      await fetch("/api/judge/logout", { method: "POST" });
    } catch (err) {
      console.warn("Logout error:", err);
    }
    window.location.reload();
  }

  async function loadPortalStatus() {
    try {
      const res = await fetch("/api/admin/portal-status");
      if (res.ok) {
        const data = await res.json();
        if (typeof data.submissionsOpen === "boolean") {
          setIsPortalOpen(data.submissionsOpen);
        }
      }
    } catch (e) {
      console.warn("Failed to load portal status:", e);
    }
  }

  async function handleTogglePortalStatus() {
    const action = isPortalOpen ? "PAUSE" : "START / OPEN";
    const msg = isPortalOpen
      ? "Are you sure you want to PAUSE the submission portal?\n\nParticipants will NOT be able to submit any bug reports while paused."
      : "Are you sure you want to START / OPEN the submission portal?\n\nParticipants will be able to submit bug reports immediately.";

    if (!confirm(msg)) return;

    setIsTogglingStatus(true);
    try {
      const res = await fetch("/api/admin/portal-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionsOpen: !isPortalOpen }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsPortalOpen(data.submissionsOpen);
        alert(data.message);
      } else {
        alert("Failed to update portal status: " + (data.error || "Unknown error"));
      }
    } catch (err: any) {
      alert("Error updating portal status: " + err.message);
    } finally {
      setIsTogglingStatus(false);
    }
  }

  async function loadTriageSubmissions() {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/submissions?status=${statusFilter}&t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Pragma": "no-cache", "Cache-Control": "no-cache" },
      });
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions || []);

        const initialForm: any = {};
        (data.submissions || []).forEach((sub: any) => {
          initialForm[sub.id] = {
            matchedBugId: sub.matchedBugId || "",
            overridePoints: sub.awardedPoints ? String(sub.awardedPoints) : "",
            judgeNotes: "",
            isSpeedBonus: Boolean(sub.isSpeedBonus),
          };
        });
        setJudgeFormState(initialForm);
      }
    } catch (err) {
      console.warn("Failed to load triage queue:", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadMasterBugs() {
    try {
      const res = await fetch("/api/bugs");
      if (res.ok) {
        const data = await res.json();
        setMasterBugsData(data.bugs || []);
      }
    } catch (err) {
      console.warn("Failed to load bugs matrix:", err);
    }
  }

  async function loadTreasures() {
    try {
      const res = await fetch("/api/treasures");
      if (res.ok) {
        const data = await res.json();
        setTreasuresData(data.treasures || []);
        const codeMap: any = {};
        (data.treasures || []).forEach((t: any) => {
          codeMap[t.id] = t.code;
        });
        setEditingCode(codeMap);
      }
    } catch (err) {
      console.warn("Failed to load treasures:", err);
    }
  }

  async function loadReferenceImages() {
    try {
      const res = await fetch("/api/bugs/reference-image");
      if (res.ok) {
        const data = await res.json();
        setAvailableRefImages(data.availableBugImages || []);
      }
    } catch (err) {
      console.warn("Failed to load reference images:", err);
    }
  }

  async function handleUploadReferenceScreenshot(bugId: string, file: File) {
    if (!file) return;
    setUploadingRefBugId(bugId);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch("/api/bugs/reference-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bugId,
            imageBase64: reader.result as string,
          }),
        });
        if (res.ok) {
          await loadReferenceImages();
          alert(`Reference screenshot saved for [${bugId}]. Gemini AI will now use this for visual similarity comparison.`);
        } else {
          const err = await res.json();
          alert(err.error || "Failed to upload reference image");
        }
      } catch (err: any) {
        alert("Upload error: " + err.message);
      } finally {
        setUploadingRefBugId(null);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handlePreviewReferenceScreenshot(bugId: string) {
    try {
      const res = await fetch(`/api/bugs/reference-image?bugId=${bugId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.hasImage) {
          setPreviewRefImageUrl({ bugId, url: data.imageUrl });
        }
      }
    } catch (err) {
      alert("Failed to load preview");
    }
  }

  async function handleDeleteReferenceScreenshot(bugId: string) {
    if (!confirm(`Remove reference screenshot for [${bugId}]?`)) return;
    try {
      const res = await fetch(`/api/bugs/reference-image?bugId=${bugId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await loadReferenceImages();
        if (previewRefImageUrl?.bugId === bugId) {
          setPreviewRefImageUrl(null);
        }
      }
    } catch (err) {
      alert("Failed to delete reference screenshot");
    }
  }

  async function handleResetCompetition() {
    if (
      !confirm(
        "Are you sure you want to reset all competition data?\n\nThis will permanently clear all test submissions, reset team scores, and reset all 10 treasure bug slots back to UNCLAIMED."
      )
    ) {
      return;
    }

    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok) {
        alert("✅ Competition state has been completely reset to a clean slate!");
        await loadTriageSubmissions();
        await loadMasterBugs();
        await loadTreasures();
      } else {
        alert("Error resetting competition: " + (data.error || "Unknown error"));
      }
    } catch (err: any) {
      alert("Network error: " + err.message);
    }
  }

  async function handleResetStorefront() {
    if (
      !confirm(
        "Are you sure you want to reset the Amazon Replica Storefront?\n\nThis will purge all team orders, reset inventory stock levels, and wipe temporary test cart data."
      )
    ) {
      return;
    }

    try {
      const storedUrl = typeof window !== "undefined" ? localStorage.getItem("amazon_storefront_url") || "" : "";
      const res = await fetch("/api/judge/reset-storefront", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storefrontUrl: storedUrl }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert("✅ Amazon Storefront successfully reset! Orders and inventory restored.");
      } else {
        const customUrl = prompt(
          `Could not connect to storefront at configured URL (${data.targetTried || "default"}).\n\nEnter your deployed Amazon Storefront URL (e.g. https://your-amazon-replica.vercel.app):`,
          storedUrl || "https://"
        );
        if (customUrl && customUrl.trim()) {
          const cleanUrl = customUrl.trim().replace(/\/$/, "");
          if (typeof window !== "undefined") {
            localStorage.setItem("amazon_storefront_url", cleanUrl);
          }
          const retryRes = await fetch("/api/judge/reset-storefront", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ storefrontUrl: cleanUrl }),
          });
          const retryData = await retryRes.json();
          if (retryRes.ok && retryData.success) {
            alert(`✅ Successfully reset Amazon Storefront at ${cleanUrl}!`);
          } else {
            alert("Error resetting storefront: " + (retryData.error || retryData.details || "Connection failed"));
          }
        }
      }
    } catch (err: any) {
      alert("Network error: " + err.message);
    }
  }

  async function submitJudgeVerdict(
    submissionId: string,
    verdict: "VERIFIED" | "REJECTED" | "UNVERIFIED"
  ) {
    const form = judgeFormState[submissionId] || {
      matchedBugId: "",
      overridePoints: "",
      judgeNotes: "",
      isSpeedBonus: false,
    };

    try {
      const res = await fetch(`/api/submissions/${submissionId}/judge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: verdict,
          matchedBugId: form.matchedBugId || null,
          overridePoints: form.overridePoints ? Number(form.overridePoints) : null,
          isSpeedBonus: Boolean(form.isSpeedBonus),
          judgeNotes: form.judgeNotes || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to submit verdict");
        return;
      }

      await loadTriageSubmissions();
      await loadMasterBugs();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  }

  async function saveTreasureCode(id: number) {
    const code = editingCode[id];
    if (!code || !code.trim()) return;

    setSavingTreasureId(id);
    try {
      const res = await fetch("/api/treasures", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, code: code.trim() }),
      });

      if (!res.ok) {
        throw new Error("Failed to update treasure code");
      }
      await loadTreasures();
    } catch (err: any) {
      alert("Error updating treasure: " + err.message);
    } finally {
      setSavingTreasureId(null);
    }
  }

  const filteredSubmissions = submissions.filter((sub) => {
    if (statusFilter !== "ALL" && sub.status !== statusFilter) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      sub.team?.name?.toLowerCase().includes(q) ||
      sub.description?.toLowerCase().includes(q) ||
      sub.matchedBugId?.toLowerCase().includes(q) ||
      sub.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white border border-neutral-200 p-6 rounded-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-neutral-900 mb-1">
            <span className="px-2 py-0.5 bg-neutral-900 text-white font-mono text-xs font-bold rounded-sm">
              ADMIN
            </span>
            <h1 className="text-2xl font-bold tracking-tight font-sans">
              Judge Triage & Scoring Console
            </h1>
          </div>
          <p className="text-sm text-neutral-500 font-mono">
            Entropy 2K26 QA Bug Bounty Review Desk
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          {/* Portal Start / Stop Toggle */}
          <button
            onClick={handleTogglePortalStatus}
            disabled={isTogglingStatus}
            className={`px-3.5 py-2 text-xs font-mono font-bold rounded-sm flex items-center space-x-1.5 transition-colors border shadow-xs ${
              isPortalOpen
                ? "bg-emerald-50 hover:bg-rose-50 text-emerald-800 hover:text-rose-800 border-emerald-300 hover:border-rose-300"
                : "bg-rose-50 hover:bg-emerald-50 text-rose-800 hover:text-emerald-800 border-rose-300 hover:border-emerald-300"
            }`}
            title={isPortalOpen ? "Click to Pause / Stop Submissions" : "Click to Start / Open Submissions"}
          >
            <span className={`w-2 h-2 rounded-full ${isPortalOpen ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
            <span>{isPortalOpen ? "PORTAL: OPEN (CLICK TO PAUSE)" : "PORTAL: PAUSED (CLICK TO START)"}</span>
          </button>

          <button
            onClick={handleResetStorefront}
            className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-mono font-bold rounded-sm flex items-center space-x-1.5 transition-colors"
            title="Reset Amazon Replica storefront orders, inventory decrements, and accounts"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
            <span>RESET STOREFRONT</span>
          </button>
          <button
            onClick={handleResetCompetition}
            className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 text-xs font-mono font-bold rounded-sm flex items-center space-x-1.5 transition-colors"
            title="Wipe test data and reset all treasure bugs and scores to clean slate"
          >
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>RESET COMPETITION</span>
          </button>
          <button
            onClick={() => {
              loadTriageSubmissions();
              loadMasterBugs();
              loadTreasures();
            }}
            className="px-3.5 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-mono font-bold rounded-sm flex items-center space-x-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>SYNC ALL</span>
          </button>
          <button
            onClick={handleLogout}
            className="px-3.5 py-2 bg-neutral-100 hover:bg-rose-50 text-rose-700 text-xs font-mono font-bold rounded-sm"
          >
            Lock Console
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-200 space-x-2 text-sm font-mono">
        <button
          onClick={() => setActiveTab("triage")}
          className={`px-4 py-2.5 font-bold uppercase transition-colors border-b-2 ${
            activeTab === "triage"
              ? "border-neutral-900 text-neutral-900"
              : "border-transparent text-neutral-500 hover:text-neutral-900"
          }`}
        >
          1. Triage Desk ({submissions.length})
        </button>
        <button
          onClick={() => setActiveTab("matrix")}
          className={`px-4 py-2.5 font-bold uppercase transition-colors border-b-2 ${
            activeTab === "matrix"
              ? "border-neutral-900 text-neutral-900"
              : "border-transparent text-neutral-500 hover:text-neutral-900"
          }`}
        >
          2. Master Bug Matrix ({masterBugsData.length || 55})
        </button>
        <button
          onClick={() => setActiveTab("treasures")}
          className={`px-4 py-2.5 font-bold uppercase transition-colors border-b-2 ${
            activeTab === "treasures"
              ? "border-neutral-900 text-neutral-900"
              : "border-transparent text-neutral-500 hover:text-neutral-900"
          }`}
        >
          3. Treasure Flag Codes (10)
        </button>
      </div>

      {/* TAB 1: TRIAGE DESK */}
      {activeTab === "triage" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 border border-neutral-200 rounded-sm">
            <div className="flex items-center space-x-1.5 font-mono text-xs">
              <span className="text-neutral-500 font-bold mr-1">STATUS:</span>
              {(["UNVERIFIED", "VERIFIED", "REJECTED", "ALL"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-sm font-bold ${
                    statusFilter === st
                      ? "bg-neutral-900 text-white"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  }`}
                >
                  {st === "UNVERIFIED" ? "PENDING" : st}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search team or bug..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-300 rounded-sm font-sans focus:outline-none focus:border-neutral-900"
              />
            </div>
          </div>

          {/* Cards */}
          {isLoading ? (
            <div className="p-8 text-center text-sm font-mono text-neutral-400 bg-white border border-neutral-200 rounded-md">
              Loading queue...
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="p-8 text-center text-sm font-mono text-neutral-400 bg-white border border-neutral-200 rounded-md">
              No submissions in this filter.
            </div>
          ) : (
            filteredSubmissions.map((sub) => {
              const form = judgeFormState[sub.id] || {
                matchedBugId: sub.matchedBugId || "",
                overridePoints: "",
                judgeNotes: "",
              };

              return (
                <div
                  key={sub.id}
                  className="bg-white border border-neutral-200 rounded-md p-6 space-y-4 font-mono text-sm shadow-xs"
                >
                  {/* Top Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-neutral-900 text-base">
                        TEAM: {sub.team?.name?.toUpperCase() || "UNKNOWN"}
                      </span>
                      <span className="text-neutral-300">•</span>
                      <span className="text-xs text-neutral-500">
                        REF: {sub.id.slice(0, 10)}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-neutral-500 font-medium">
                        {new Date(sub.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} • {new Date(sub.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-sm font-bold text-xs ${
                          sub.status === "VERIFIED"
                            ? "bg-emerald-100 text-emerald-900"
                            : sub.status === "REJECTED"
                            ? "bg-rose-100 text-rose-900"
                            : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {sub.status} {sub.awardedPoints > 0 ? `(+${sub.awardedPoints} PTS)` : ""}
                      </span>
                    </div>
                  </div>

                  {/* Body Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Left: Report */}
                    <div className="space-y-3">
                      <div>
                        <span className="text-xs font-bold uppercase text-neutral-500 block mb-1">
                          Reported Description:
                        </span>
                        <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded text-neutral-900 font-sans text-sm leading-relaxed max-h-40 overflow-y-auto">
                          {sub.description || "(No description)"}
                        </div>
                      </div>

                      {sub.codeSnippet && (
                        <div>
                          <span className="text-xs font-bold uppercase text-neutral-500 block mb-1">
                            Code Snippet:
                          </span>
                          <pre className="p-3 bg-neutral-950 text-neutral-100 rounded text-xs font-mono max-h-36 overflow-x-auto overflow-y-auto">
                            {sub.codeSnippet}
                          </pre>
                        </div>
                      )}

                      {sub.screenshotUrl && (
                        <div>
                          <span className="text-xs font-bold uppercase text-neutral-500 block mb-1">
                            Screenshot Proof:
                          </span>
                          <a
                            href={sub.screenshotUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block border border-neutral-200 rounded p-1 hover:border-neutral-400"
                          >
                            <img
                              src={sub.screenshotUrl}
                              alt="Defect Proof"
                              className="max-h-44 object-contain rounded mx-auto"
                            />
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Right: AI & Judge Controls */}
                    <div className="space-y-3 bg-neutral-50 p-4 border border-neutral-200 rounded-sm">
                      {/* AI Card */}
                      <div className="p-3.5 bg-white border border-neutral-200 rounded-sm space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-neutral-900">
                            AI AUTOMATED MATCH
                          </span>
                          <span className="font-bold text-neutral-700">
                            Confidence: {typeof sub.llmConfidence === "number" && !isNaN(sub.llmConfidence) ? `${Math.round(sub.llmConfidence * 100)}%` : "N/A"}
                          </span>
                        </div>
                        <div className="text-xs font-mono font-bold text-neutral-900">
                          {sub.matchedBugId ? `[${sub.matchedBugId}] ${sub.matchedBug?.title || ""}` : "Unmatched / Review Manually"}
                        </div>
                        <p className="text-xs font-sans text-neutral-600 leading-normal">
                          {sub.llmReasoning || "Pending evaluation"}
                        </p>
                      </div>

                      {/* Judge Actions */}
                      <div className="space-y-2.5 pt-2 border-t border-neutral-200">
                        <span className="text-xs font-bold uppercase text-neutral-700 block">
                          Judge Verdict Controls:
                        </span>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-neutral-500 block mb-1">
                              Assign Bug ID
                            </label>
                            <select
                              value={form.matchedBugId}
                              onChange={(e) => {
                                const newBugId = e.target.value;
                                const bug = masterBugsData.find((b) => b.id === newBugId);
                                const isEligible = bug ? !bug.isFirstFound : false;
                                const base = bug ? bug.basePoints : 3;
                                const speed = bug ? bug.speedBonusPoints : 2;
                                const total = bug ? (isEligible ? base + speed : base) : "";
                                setJudgeFormState((prev) => ({
                                  ...prev,
                                  [sub.id]: {
                                    ...prev[sub.id],
                                    matchedBugId: newBugId,
                                    isSpeedBonus: isEligible,
                                    overridePoints: total !== "" ? String(total) : "",
                                  },
                                }));
                              }}
                              className="w-full px-2.5 py-1.5 bg-white border border-neutral-300 rounded-sm text-xs focus:outline-none"
                            >
                              <option value="">-- Select Master Bug --</option>
                              {masterBugsData.map((b) => (
                                <option key={b.id} value={b.id}>
                                  [{b.id}] {b.title}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-xs text-neutral-500 block mb-1">
                              Points Override
                            </label>
                            <input
                              type="number"
                              placeholder="Auto (Base + Speed)"
                              value={form.overridePoints}
                              onChange={(e) =>
                                setJudgeFormState((prev) => ({
                                  ...prev,
                                  [sub.id]: { ...prev[sub.id], overridePoints: e.target.value },
                                }))
                              }
                              className="w-full px-2.5 py-1.5 bg-white border border-neutral-300 rounded-sm text-xs focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Speed Bonus Toggle & Badge */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 p-2 bg-neutral-50 border border-neutral-200 rounded-sm">
                          <label className="flex items-center space-x-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={form.isSpeedBonus ?? false}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                const bug = masterBugsData.find((b) => b.id === form.matchedBugId);
                                const base = bug ? bug.basePoints : 3;
                                const speed = bug ? bug.speedBonusPoints : 2;
                                setJudgeFormState((prev) => ({
                                  ...prev,
                                  [sub.id]: {
                                    ...prev[sub.id],
                                    isSpeedBonus: checked,
                                    overridePoints: String(base + (checked ? speed : 0)),
                                  },
                                }));
                              }}
                              className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                            />
                            <span className="text-xs font-bold text-neutral-800 flex items-center gap-1">
                              ⚡ Award Speed Bonus (+{(() => {
                                const bug = masterBugsData.find((b) => b.id === form.matchedBugId);
                                return bug ? bug.speedBonusPoints : 2;
                              })()} pts)
                            </span>
                          </label>

                          {(() => {
                            const bug = masterBugsData.find((b) => b.id === form.matchedBugId);
                            if (!bug) return null;
                            return (
                              <span
                                className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                                  bug.isFirstFound
                                    ? "bg-neutral-200 text-neutral-700"
                                    : "bg-amber-100 text-amber-800 border border-amber-300 font-bold"
                                }`}
                              >
                                {bug.isFirstFound
                                  ? `Already claimed (${bug.firstFoundByTeam || "another team"})`
                                  : "🔥 Unclaimed! First-finder bonus active"}
                              </span>
                            );
                          })()}
                        </div>

                        <div>
                          <label className="text-xs text-neutral-500 block mb-1">
                            Judge Note
                          </label>
                          <input
                            type="text"
                            placeholder="Optional judge note..."
                            value={form.judgeNotes}
                            onChange={(e) =>
                              setJudgeFormState((prev) => ({
                                ...prev,
                                [sub.id]: { ...prev[sub.id], judgeNotes: e.target.value },
                              }))
                            }
                            className="w-full px-2.5 py-1.5 bg-white border border-neutral-300 rounded-sm text-xs focus:outline-none"
                          />
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                          <button
                            onClick={() => submitJudgeVerdict(sub.id, "VERIFIED")}
                            className="w-full sm:flex-1 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs uppercase rounded-sm flex items-center justify-center space-x-1.5"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{sub.status === "VERIFIED" ? "UPDATE VERIFIED" : "VERIFY & AWARD"}</span>
                          </button>

                          <button
                            onClick={() => submitJudgeVerdict(sub.id, "UNVERIFIED")}
                            className="w-full sm:w-auto px-3 py-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 font-bold text-xs uppercase rounded-sm flex items-center justify-center space-x-1.5"
                            title="Revert submission back to Pending status"
                          >
                            <Clock className="w-4 h-4" />
                            <span>SET PENDING</span>
                          </button>

                          <button
                            onClick={() => submitJudgeVerdict(sub.id, "REJECTED")}
                            className="w-full sm:flex-1 py-2 bg-neutral-800 hover:bg-rose-900 text-white font-bold text-xs uppercase rounded-sm flex items-center justify-center space-x-1.5"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>REJECT</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: MASTER BUG MATRIX */}
      {activeTab === "matrix" && (
        <div className="bg-white border border-neutral-200 rounded-md overflow-hidden">
          <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
            <h2 className="text-sm font-mono font-bold uppercase text-neutral-900">
              Master Defects Catalog ({masterBugsData.length})
            </h2>
            <span className="text-xs font-mono text-neutral-500">
              {masterBugsData.length} Identified Platform Bugs
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm font-mono border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-600 font-bold">
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">TITLE & LOCATION</th>
                  <th className="py-3 px-4">TIER</th>
                  <th className="py-3 px-4">POINTS</th>
                  <th className="py-3 px-4">FIRST FOUND BY</th>
                  <th className="py-3 px-4 text-center">REPORTS</th>
                  <th className="py-3 px-4 text-center">AI REFERENCE IMAGE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-900">
                {masterBugsData.map((b) => (
                  <tr key={b.id} className="hover:bg-neutral-50">
                    <td className="py-3 px-4 font-bold">{b.id}</td>
                    <td className="py-3 px-4 font-sans">
                      <div className="font-bold text-neutral-900">{b.title}</div>
                      <div className="text-xs text-neutral-500 font-mono">{b.location}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold ${
                          b.category === "HARD"
                            ? "bg-rose-100 text-rose-900"
                            : b.category === "MEDIUM"
                            ? "bg-amber-100 text-amber-900"
                            : "bg-emerald-100 text-emerald-900"
                        }`}
                      >
                        {b.category}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {b.basePoints} + {b.speedBonusPoints} = {b.maxPoints || b.basePoints + b.speedBonusPoints} pts
                    </td>
                    <td className="py-3 px-4">
                      {b.isFirstFound ? (
                        <span className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          ⚡ {b.firstFoundByTeam || "Claimed"}
                        </span>
                      ) : (
                        <span className="text-neutral-400">Available</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-bold">
                      {b.totalReports || 0} ({b.verifiedReports || 0} verified)
                    </td>
                    <td className="py-3 px-4 text-center">
                      {availableRefImages.includes(b.id) ? (
                        <div className="inline-flex items-center space-x-1.5">
                          <button
                            onClick={() => handlePreviewReferenceScreenshot(b.id)}
                            className="px-2 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded text-xs font-bold hover:bg-emerald-100"
                            title="View ground truth image"
                          >
                            ✓ Attached
                          </button>
                          <button
                            onClick={() => handleDeleteReferenceScreenshot(b.id)}
                            className="text-neutral-400 hover:text-rose-600 text-xs px-1"
                            title="Delete reference image"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-300 rounded text-xs font-bold inline-flex items-center space-x-1">
                          <span>{uploadingRefBugId === b.id ? "Saving..." : "+ Attach"}</span>
                          <input
                            type="file"
                            accept="image/*"
                            disabled={uploadingRefBugId === b.id}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadReferenceScreenshot(b.id, file);
                            }}
                            className="hidden"
                          />
                        </label>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: TREASURE CODES */}
      {activeTab === "treasures" && (
        <div className="bg-white border border-neutral-200 rounded-md p-6 sm:p-8 space-y-4">
          <div className="border-b border-neutral-200 pb-3">
            <h2 className="text-base font-mono font-bold uppercase text-neutral-900">
              Treasure Bug Flag Customization (10 Slots)
            </h2>
            <p className="text-sm text-neutral-500 font-sans mt-1">
              Edit the exact secret flag codes for the 10 Treasure Bugs at any time.
            </p>
          </div>

          <div className="space-y-3">
            {treasuresData.map((t) => (
              <div
                key={t.id}
                className="p-4 bg-neutral-50 border border-neutral-200 rounded-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-sm"
              >
                <div className="flex items-center space-x-3 w-40 flex-shrink-0">
                  <span className="font-bold text-neutral-900">
                    SLOT #{t.id.toString().padStart(2, "0")}
                  </span>
                  {t.isClaimed ? (
                    <span className="px-2 py-0.5 bg-neutral-200 text-neutral-700 text-xs font-bold rounded">
                      CLAIMED
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-xs font-bold rounded">
                      ACTIVE
                    </span>
                  )}
                </div>

                <div className="flex-1 flex items-center space-x-2">
                  <input
                    type="text"
                    value={editingCode[t.id] ?? t.code ?? ""}
                    onChange={(e) =>
                      setEditingCode((prev) => ({ ...prev, [t.id]: e.target.value }))
                    }
                    className="flex-1 px-3 py-2 bg-white border border-neutral-300 rounded-sm font-mono text-sm uppercase focus:outline-none focus:border-neutral-900"
                  />
                  <button
                    onClick={() => saveTreasureCode(t.id)}
                    disabled={savingTreasureId === t.id}
                    className="px-4 py-2 bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50 text-xs font-mono font-bold rounded-sm flex items-center space-x-1"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{savingTreasureId === t.id ? "SAVING..." : "UPDATE"}</span>
                  </button>
                </div>

                <div className="text-xs text-neutral-500 w-44 text-right">
                  {t.isClaimed
                    ? `Claimed by: ${t.claimedByTeam?.name || "Team"}`
                    : "Not yet claimed"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reference Screenshot Preview Modal */}
      {previewRefImageUrl && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-white rounded-md p-5 max-w-2xl w-full space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-mono font-bold text-neutral-900">
                Ground-Truth Reference Image: [{previewRefImageUrl.bugId}]
              </h3>
              <button
                onClick={() => setPreviewRefImageUrl(null)}
                className="text-neutral-500 hover:text-neutral-900 font-bold px-2"
              >
                ✕
              </button>
            </div>
            <img
              src={previewRefImageUrl.url}
              alt="Reference ground truth defect"
              className="max-h-[60vh] w-auto mx-auto object-contain border rounded"
            />
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-neutral-500 font-mono">
                Gemini AI uses this image for visual similarity comparison against student submissions.
              </span>
              <button
                onClick={() => setPreviewRefImageUrl(null)}
                className="px-4 py-1.5 bg-neutral-900 text-white rounded text-xs font-mono font-bold hover:bg-neutral-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
