"use client";

import React, { useEffect, useState } from "react";
import { useTeam } from "@/context/TeamContext";
import { ListChecks, CheckCircle2, Clock, XCircle, Zap, RefreshCw, Database, HardDrive, AlertCircle } from "lucide-react";
import Link from "next/link";

interface SubmissionItem {
  id: string;
  description: string | null;
  codeSnippet: string | null;
  screenshotUrl: string | null;
  status: string;
  matchedBugId: string | null;
  matchedBug?: {
    id?: string;
    title: string;
    category: string;
  } | null;
  awardedPoints: number;
  isSpeedBonus: boolean;
  createdAt: string;
}

export default function MySubmissionsPage() {
  const { team, setIsAuthModalOpen, refreshTeam } = useTeam();
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isSyncing, setIsSyncing] = useState(false);

  async function syncLocalVault() {
    if (!team) return;
    try {
      const vault = JSON.parse(localStorage.getItem("entropy_submission_vault") || "[]");
      const pendingItems = vault.filter((v: any) => typeof v.id === "string" && v.id.startsWith("local-"));
      if (pendingItems.length === 0) return;

      setIsSyncing(true);
      for (const item of pendingItems) {
        try {
          const res = await fetch("/api/submissions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              teamId: team.id,
              description: item.description,
              codeSnippet: item.codeSnippet,
              screenshotUrl: item.screenshotUrl,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            const updatedVault = JSON.parse(localStorage.getItem("entropy_submission_vault") || "[]");
            const idx = updatedVault.findIndex((x: any) => x.id === item.id);
            if (idx >= 0 && data.submission) {
              updatedVault[idx] = data.submission;
              localStorage.setItem("entropy_submission_vault", JSON.stringify(updatedVault));
            }
          }
        } catch (syncErr) {
          console.warn("Background sync retry error:", syncErr);
        }
      }
      await fetchSubmissions();
      refreshTeam();
    } catch {} finally {
      setIsSyncing(false);
    }
  }

  async function fetchSubmissions() {
    if (!team) return;
    try {
      const res = await fetch(`/api/submissions?teamId=${team.id}`);
      let serverSubs: any[] = [];
      if (res.ok) {
        const data = await res.json();
        serverSubs = data.submissions || [];
      }

      // Merge with client-side vault to guarantee zero-loss UI rendering
      try {
        const vault = JSON.parse(localStorage.getItem("entropy_submission_vault") || "[]");
        const serverIds = new Set(serverSubs.map((s: any) => s.id));
        for (const v of vault) {
          if (!serverIds.has(v.id)) {
            serverSubs.unshift(v);
            serverIds.add(v.id);
          }
        }
      } catch {}

      setSubmissions(serverSubs);
    } catch (err) {
      console.warn("Failed to load submissions, falling back to local vault:", err);
      try {
        const vault = JSON.parse(localStorage.getItem("entropy_submission_vault") || "[]");
        setSubmissions(vault);
      } catch {}
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (team) {
      fetchSubmissions();
      syncLocalVault();

      // Auto-sync whenever device reconnects to Wi-Fi/Internet
      window.addEventListener("online", syncLocalVault);
      const interval = setInterval(syncLocalVault, 15000);

      return () => {
        window.removeEventListener("online", syncLocalVault);
        clearInterval(interval);
      };
    } else {
      setIsLoading(false);
    }
  }, [team]);

  if (!team) {
    return (
      <div className="max-w-xl mx-auto p-8 bg-white border border-neutral-200 rounded-md text-center space-y-4">
        <ListChecks className="w-10 h-10 text-neutral-400 mx-auto" />
        <h1 className="text-xl font-bold text-neutral-900 font-sans">
          Sign In to View Submissions
        </h1>
        <p className="text-sm text-neutral-500 font-sans">
          Please sign in with your team to review your submitted bug reports and points.
        </p>
        <button
          onClick={() => setIsAuthModalOpen(true)}
          className="px-5 py-2.5 bg-neutral-900 text-white text-sm font-mono font-bold rounded-sm hover:bg-neutral-800"
        >
          Sign In Team
        </button>
      </div>
    );
  }

  const verifiedCount = submissions.filter((s) => s.status === "VERIFIED").length;
  const speedBonusCount = submissions.filter((s) => s.isSpeedBonus).length;
  const pendingCount = submissions.filter((s) => s.status === "UNVERIFIED").length;
  const cloudCount = submissions.filter((s) => typeof s.id === "string" && s.id.startsWith("sub-")).length;
  const localPendingCount = submissions.filter((s) => typeof s.id === "string" && s.id.startsWith("local-")).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="border border-neutral-200 bg-white p-6 rounded-lg shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5 text-neutral-900 mb-1">
            <ListChecks className="w-6 h-6 text-neutral-800" />
            <h1 className="text-2xl font-bold tracking-tight font-sans">
              Submissions: {team.name}
            </h1>
          </div>
          <p className="text-sm text-neutral-600 font-sans">
            {team.email} • Total Score: <strong className="text-neutral-900">{team.totalScore} pts</strong> • Verified Bugs: <strong className="text-neutral-900">{team.validBugsCount}</strong>
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => {
              fetchSubmissions();
              syncLocalVault();
              refreshTeam();
            }}
            disabled={isSyncing}
            className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-sans font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Syncing..." : "Sync / Refresh"}</span>
          </button>
          <Link
            href="/submit"
            className="px-4 py-2 text-xs font-sans font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-md transition-colors"
          >
            + Report Bug
          </Link>
        </div>
      </div>

      {/* Sync Banner if pending local items exist */}
      {localPendingCount > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-950 font-sans shadow-xs">
          <div className="flex items-center space-x-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <span className="font-medium text-sm">
              {localPendingCount} report{localPendingCount > 1 ? "s" : ""} stored locally. You may contact the admin.
            </span>
          </div>
          <button
            onClick={syncLocalVault}
            disabled={isSyncing}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-md shadow-xs flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Syncing..." : "Sync Now"}</span>
          </button>
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm font-sans">
        <div className="p-4 bg-white border border-neutral-200 rounded-lg shadow-xs">
          <span className="text-xs text-neutral-500 font-medium block">Total Reports</span>
          <span className="text-2xl font-bold text-neutral-900 mt-1 block">{submissions.length}</span>
        </div>
        <div className="p-4 bg-white border border-neutral-200 rounded-lg shadow-xs">
          <span className="text-xs text-emerald-700 font-medium flex items-center space-x-1">
            <Database className="w-3.5 h-3.5" />
            <span>Stored in database</span>
          </span>
          <span className="text-2xl font-bold text-emerald-700 mt-1 block">{cloudCount}</span>
        </div>
        <div className="p-4 bg-white border border-neutral-200 rounded-lg shadow-xs">
          <span className="text-xs text-amber-700 font-medium flex items-center space-x-1">
            <HardDrive className="w-3.5 h-3.5" />
            <span>Stored locally</span>
          </span>
          <span className="text-2xl font-bold text-amber-700 mt-1 block">{localPendingCount}</span>
        </div>
        <div className="p-4 bg-white border border-neutral-200 rounded-lg shadow-xs">
          <span className="text-xs text-emerald-800 font-medium block">Verified Points</span>
          <span className="text-2xl font-bold text-emerald-800 mt-1 block">
            {team.totalScore} <span className="text-xs font-normal text-neutral-500">({verifiedCount} bugs)</span>
          </span>
        </div>
      </div>

      {/* Submissions List */}
      <div className="space-y-4">
        {submissions.length === 0 ? (
          <div className="p-8 bg-white border border-neutral-200 rounded-lg text-center text-sm text-neutral-500 font-sans shadow-xs">
            No bug reports submitted yet. Go test the store and report your findings!
          </div>
        ) : (
          submissions.map((sub) => {
            const isVerified = sub.status === "VERIFIED";
            const isRejected = sub.status === "REJECTED";
            const isPending = sub.status === "UNVERIFIED";
            const isCloud = typeof sub.id === "string" && sub.id.startsWith("sub-");
            const isLocal = typeof sub.id === "string" && sub.id.startsWith("local-");

            return (
              <div
                key={sub.id}
                className="bg-white border border-neutral-200 rounded-lg p-5 space-y-3.5 text-sm shadow-xs font-sans"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-neutral-900 text-base">
                      {isVerified && sub.matchedBug
                        ? sub.matchedBug.title
                        : `Report #${sub.id.slice(0, 16)}`}
                    </span>
                    {isVerified && sub.matchedBug?.category && (
                      <span className="px-2 py-0.5 bg-neutral-100 text-neutral-800 text-xs font-medium rounded border border-neutral-200">
                        {sub.matchedBug.category}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto text-xs">
                    {/* Storage Status Pill */}
                    {isCloud ? (
                      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-900 font-medium rounded-md flex items-center space-x-1 border border-emerald-200">
                        <Database className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Stored in database</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-amber-50 text-amber-900 font-medium rounded-md flex items-center space-x-1 border border-amber-300">
                        <HardDrive className="w-3.5 h-3.5 text-amber-600" />
                        <span>Stored locally</span>
                      </span>
                    )}

                    {sub.isSpeedBonus && (
                      <span className="px-2.5 py-1 bg-amber-50 text-amber-900 font-medium rounded-md flex items-center space-x-1 border border-amber-200">
                        <Zap className="w-3.5 h-3.5 fill-amber-500 text-amber-600" />
                        <span>First-to-Find Speed Bonus</span>
                      </span>
                    )}

                    {isVerified && (
                      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-900 font-medium rounded-md flex items-center space-x-1 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Verified (+{sub.awardedPoints} pts)</span>
                      </span>
                    )}

                    {isRejected && (
                      <span className="px-2.5 py-1 bg-rose-50 text-rose-900 font-medium rounded-md flex items-center space-x-1 border border-rose-200">
                        <XCircle className="w-3.5 h-3.5 text-rose-700" />
                        <span>Rejected</span>
                      </span>
                    )}

                    {isPending && (
                      <span className="px-2.5 py-1 bg-neutral-100 text-neutral-700 font-medium rounded-md flex items-center space-x-1 border border-neutral-300">
                        <Clock className="w-3.5 h-3.5 text-neutral-500" />
                        <span>Pending</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                {sub.description && (
                  <div className="text-neutral-800 text-sm font-sans leading-relaxed">
                    {sub.description}
                  </div>
                )}

                {/* Code Snippet */}
                {sub.codeSnippet && (
                  <div className="p-3 bg-neutral-950 text-neutral-100 rounded-md text-xs font-mono overflow-x-auto">
                    <pre>{sub.codeSnippet}</pre>
                  </div>
                )}

                {/* Screenshot */}
                {sub.screenshotUrl && (
                  <div>
                    <img
                      src={sub.screenshotUrl}
                      alt="Submitted Defect Proof"
                      className="max-h-48 w-auto rounded border border-neutral-200 object-contain"
                    />
                  </div>
                )}

                {/* Footer with Clear Timestamp and Storage Identifiers */}
                <div className="text-xs text-neutral-600 pt-2 flex flex-wrap items-center justify-between border-t border-neutral-100 font-sans gap-2">
                  <div className="flex items-center space-x-1.5 text-neutral-700">
                    <Clock className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Submitted at:</span>
                    <strong className="text-neutral-900 font-medium">
                      {new Date(sub.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} • {new Date(sub.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </strong>
                  </div>

                  <div className="flex items-center space-x-2">
                    {isCloud ? (
                      <span className="font-mono text-neutral-600 bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded text-[11px]">
                        ID: {sub.id}
                      </span>
                    ) : (
                      <div className="flex items-center space-x-2 text-xs">
                        <span className="text-amber-800 font-medium text-[11px]">
                          Stored locally. You may contact the admin.
                        </span>
                        <span className="font-mono text-neutral-600 bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded text-[11px]">
                          ID: {sub.id}
                        </span>
                        <button
                          onClick={() => syncLocalVault()}
                          disabled={isSyncing}
                          className="px-2 py-0.5 bg-amber-600 text-white hover:bg-amber-700 rounded text-[11px] font-medium transition-colors"
                        >
                          {isSyncing ? "Syncing..." : "Sync Now"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
