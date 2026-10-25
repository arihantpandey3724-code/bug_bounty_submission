"use client";

import React, { useEffect, useState } from "react";
import { useTeam } from "@/context/TeamContext";
import { ListChecks, CheckCircle2, Clock, XCircle, Zap, RefreshCw } from "lucide-react";
import Link from "next/link";

interface SubmissionItem {
  id: string;
  description: string | null;
  codeSnippet: string | null;
  screenshotUrl: string | null;
  status: string;
  matchedBugId: string | null;
  matchedBug?: {
    id: string;
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

  async function fetchSubmissions() {
    if (!team) return;
    try {
      const res = await fetch(`/api/submissions?teamId=${team.id}`);
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions || []);
      }
    } catch (err) {
      console.warn("Failed to load submissions:", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (team) {
      fetchSubmissions();
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
              refreshTeam();
            }}
            className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-sans font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <Link
            href="/submit"
            className="px-4 py-2 text-xs font-sans font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-md transition-colors"
          >
            + Report Bug
          </Link>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-3 text-sm font-sans">
        <div className="p-4 bg-white border border-neutral-200 rounded-lg shadow-xs">
          <span className="text-xs text-neutral-500 font-medium block">Total Reports</span>
          <span className="text-2xl font-bold text-neutral-900 mt-1 block">{submissions.length}</span>
        </div>
        <div className="p-4 bg-white border border-neutral-200 rounded-lg shadow-xs">
          <span className="text-xs text-emerald-700 font-medium block">Verified Bugs</span>
          <span className="text-2xl font-bold text-emerald-700 mt-1 block">
            {verifiedCount} {speedBonusCount > 0 ? <span className="text-xs text-amber-700 font-medium">({speedBonusCount} Speed)</span> : ""}
          </span>
        </div>
        <div className="p-4 bg-white border border-neutral-200 rounded-lg shadow-xs">
          <span className="text-xs text-neutral-600 font-medium block">Pending</span>
          <span className="text-2xl font-bold text-neutral-800 mt-1 block">{pendingCount}</span>
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
                        ? `[${sub.matchedBug.id}] ${sub.matchedBug.title}`
                        : `Report #${sub.id.slice(0, 16)}`}
                    </span>
                    {isVerified && sub.matchedBug?.category && (
                      <span className="px-2 py-0.5 bg-neutral-100 text-neutral-800 text-xs font-medium rounded border border-neutral-200">
                        {sub.matchedBug.category}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 self-start sm:self-auto text-xs">
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

                {/* Footer */}
                <div className="text-xs text-neutral-400 pt-1 flex items-center justify-between border-t border-neutral-100 font-sans">
                  <span>Submitted: {new Date(sub.createdAt).toLocaleString()}</span>
                  <span className="font-mono text-neutral-500">ID: {sub.id}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
