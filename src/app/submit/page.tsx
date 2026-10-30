"use client";

import React, { useState } from "react";
import { useTeam } from "@/context/TeamContext";
import { Bug, Upload, AlertCircle, FileCode2, Image as ImageIcon, X, Clock } from "lucide-react";
import Link from "next/link";

export default function SubmitBugPage() {
  const { team, setIsAuthModalOpen } = useTeam();

  const [description, setDescription] = useState("");
  const [codeSnippet, setCodeSnippet] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmissionsOpen, setIsSubmissionsOpen] = useState(true);

  React.useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch("/api/admin/portal-status");
        if (res.ok) {
          const data = await res.json();
          if (typeof data.submissionsOpen === "boolean") {
            setIsSubmissionsOpen(data.submissionsOpen);
          }
        }
      } catch (e) {
        // ignore
      }
    }
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  // Convert uploaded image file to Base64 data URL
  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please select an image file (.png, .jpg, .webp)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("Screenshot size must be under 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setScreenshotUrl(reader.result as string);
      setErrorMsg(null);
    };
    reader.onerror = () => {
      setErrorMsg("Failed to read image file");
    };
    reader.readAsDataURL(file);
  }

  // Handle direct clipboard paste (Ctrl + V) for screenshots
  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) {
          if (file.size > 5 * 1024 * 1024) {
            setErrorMsg("Screenshot size must be under 5MB");
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            setScreenshotUrl(reader.result as string);
            setErrorMsg(null);
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!team) {
      setIsAuthModalOpen(true);
      return;
    }

    if (!isSubmissionsOpen) {
      setErrorMsg("Submissions are currently paused by the event organizers. Please wait until submissions are resumed.");
      return;
    }

    if (!description.trim()) {
      setErrorMsg("Please provide a bug description and steps to reproduce.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSubmittedResult(null);

    // Client-side zero-loss vault backup
    const clientVaultId = `local-${Date.now()}`;
    const vaultItem = {
      id: clientVaultId,
      teamId: team.id,
      description: description.trim(),
      codeSnippet: codeSnippet.trim() || null,
      screenshotUrl: screenshotUrl || null,
      status: "CAPTURED",
      awardedPoints: 0,
      isSpeedBonus: false,
      createdAt: new Date().toISOString(),
    };
    try {
      const vault = JSON.parse(localStorage.getItem("entropy_submission_vault") || "[]");
      vault.unshift(vaultItem);
      localStorage.setItem("entropy_submission_vault", JSON.stringify(vault.slice(0, 50)));
    } catch {}

    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: team.id,
          description: description.trim(),
          codeSnippet: codeSnippet.trim() || null,
          screenshotUrl: screenshotUrl || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit bug report");
      }

      setSubmittedResult(data.submission);
      setDescription("");
      setCodeSnippet("");
      setScreenshotUrl(null);

      // Update vault item with server response
      try {
        const vault = JSON.parse(localStorage.getItem("entropy_submission_vault") || "[]");
        const idx = vault.findIndex((v: any) => v.id === clientVaultId);
        if (idx >= 0 && data.submission) {
          vault[idx] = data.submission;
          localStorage.setItem("entropy_submission_vault", JSON.stringify(vault));
        }
      } catch {}
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred while submitting.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-neutral-200 pb-4">
        <div className="flex items-center space-x-2.5 text-neutral-900 mb-1">
          <Bug className="w-6 h-6 text-neutral-800" />
          <h1 className="text-2xl font-bold tracking-tight font-sans">
            Report a Bug
          </h1>
        </div>
        <p className="text-sm text-neutral-600 font-sans">
          Provide reproduction steps explaining what went wrong. Code snippets and screenshots are completely optional.
        </p>
      </div>

      {/* Portal Paused Banner */}
      {!isSubmissionsOpen && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-md flex items-center space-x-3 text-amber-950 font-sans shadow-xs">
          <AlertCircle className="w-5 h-5 text-amber-700 flex-shrink-0" />
          <div>
            <span className="font-bold text-sm block">Submissions are currently paused</span>
            <span className="text-xs text-amber-800">
              The event organizers have temporarily closed the submission portal. You will be able to submit your findings as soon as submissions are resumed.
            </span>
          </div>
        </div>
      )}

      {/* Team Auth Banner */}
      {!team ? (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-md flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-amber-700 flex-shrink-0" />
            <span className="text-sm text-amber-900 font-medium">
              Please sign in with your team to submit bug reports.
            </span>
          </div>
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="px-4 py-2 bg-neutral-900 text-white text-xs sm:text-sm font-sans font-medium rounded-md hover:bg-neutral-800 transition-colors"
          >
            Sign in
          </button>
        </div>
      ) : (
        <div className="px-4 py-3 bg-neutral-100 border border-neutral-200 rounded-md flex items-center justify-between text-sm font-sans">
          <div className="flex items-center space-x-2">
            <span className="text-neutral-500">Submitting as:</span>
            <span className="font-semibold text-neutral-900">{team.name}</span>
            <span className="text-neutral-500 text-xs">({team.email})</span>
          </div>
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="text-neutral-600 hover:text-neutral-900 underline text-xs font-sans"
          >
            Switch Team
          </button>
        </div>
      )}

      {/* Success Notification */}
      {submittedResult && (
        <div className="p-5 bg-neutral-50 border border-neutral-200 rounded-lg space-y-3 font-sans text-sm shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-neutral-900">
                Bug report submitted successfully
              </h3>
              <p className="text-sm text-neutral-600 mt-0.5">
                The judges have received your report and will review your reproduction steps shortly.
              </p>
            </div>
            <Link
              href="/my-submissions"
              className="px-3.5 py-1.5 text-xs font-medium text-neutral-900 bg-white border border-neutral-300 hover:bg-neutral-100 rounded-md transition-colors flex-shrink-0 self-start"
            >
              View your submissions →
            </Link>
          </div>
          <div className="pt-2.5 border-t border-neutral-200/80 flex flex-wrap items-center justify-between text-xs text-neutral-600 gap-2">
            <div className="flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-neutral-500" />
              <span>Submitted at:</span>
              <strong className="text-neutral-900 font-medium">
                {new Date(submittedResult.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} ({new Date(submittedResult.createdAt || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })})
              </strong>
            </div>
            <div className="flex items-center">
              <span>Reference ID:</span>
              <code className="ml-1.5 px-2 py-0.5 bg-neutral-200/60 text-neutral-700 rounded font-mono text-[11px]">
                {submittedResult.id}
              </code>
            </div>
          </div>
        </div>
      )}

      {/* Error Notification */}
      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-300 text-rose-800 text-sm rounded-sm flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        onPaste={handlePaste}
        className="bg-white border border-neutral-200 rounded-md p-6 sm:p-8 space-y-6"
      >
        {/* Description */}
        <div>
          <label className="block text-sm font-sans font-semibold text-neutral-800 mb-1.5">
            Bug Description & Steps to Reproduce <span className="text-rose-500">*</span>
          </label>
          <textarea
            required
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Explain where the bug occurred, what steps you took, and what went wrong..."
            className="w-full p-3.5 text-sm sm:text-base bg-neutral-50 border border-neutral-300 rounded-md focus:outline-none focus:border-neutral-900 font-sans"
          />
        </div>

        {/* Code Snippet */}
        <div>
          <label className="block text-sm font-sans font-semibold text-neutral-800 mb-1.5 flex items-center space-x-2">
            <FileCode2 className="w-4 h-4 text-neutral-600" />
            <span>Code or Console Snippet (Optional)</span>
          </label>
          <textarea
            rows={4}
            value={codeSnippet}
            onChange={(e) => setCodeSnippet(e.target.value)}
            placeholder="Paste relevant HTML, payload, or inspector code..."
            className="w-full p-3.5 text-sm bg-neutral-950 text-neutral-100 border border-neutral-800 rounded-md focus:outline-none font-mono"
          />
        </div>

        {/* Screenshot */}
        <div>
          <label className="block text-sm font-sans font-semibold text-neutral-800 mb-1.5 flex items-center space-x-2">
            <ImageIcon className="w-4 h-4 text-neutral-600" />
            <span>Screenshot Proof (Optional)</span>
          </label>

          {screenshotUrl ? (
            <div className="border border-neutral-300 rounded-md p-3 bg-neutral-50">
              <div className="flex items-center justify-between mb-2 pb-1 border-b border-neutral-200">
                <span className="text-xs font-sans font-medium text-neutral-700">Image attached</span>
                <button
                  type="button"
                  onClick={() => setScreenshotUrl(null)}
                  className="text-neutral-500 hover:text-rose-600 text-xs flex items-center space-x-1"
                >
                  <X className="w-4 h-4" />
                  <span>Remove</span>
                </button>
              </div>
              <img
                src={screenshotUrl}
                alt="Defect Proof Preview"
                className="max-h-64 w-auto object-contain rounded border border-neutral-200 mx-auto"
              />
            </div>
          ) : (
            <label className="border-2 border-dashed border-neutral-300 hover:border-neutral-500 rounded-md p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-neutral-50/50">
              <Upload className="w-6 h-6 text-neutral-400 mb-2" />
              <span className="text-sm font-sans text-neutral-800 font-medium">
                Upload screenshot or paste from clipboard (Ctrl + V)
              </span>
              <span className="text-xs text-neutral-500 mt-1">
                PNG, JPG, or WEBP up to 5MB
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          )}
        </div>

        {/* Action Button */}
        <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-neutral-200">
          <span className="text-xs font-sans text-neutral-500">
            Note: Screenshots and code snippets are strictly optional. A clear description and reproduction steps are sufficient.
          </span>
          <button
            type="submit"
            disabled={isSubmitting || !team || !isSubmissionsOpen}
            className={`px-6 py-2.5 text-sm font-sans font-medium rounded-md transition-colors shadow-sm ${
              !isSubmissionsOpen
                ? "bg-neutral-300 text-neutral-600 cursor-not-allowed border border-neutral-300"
                : "bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50"
            }`}
          >
            {!isSubmissionsOpen
              ? "Submissions Paused"
              : isSubmitting
              ? "Submitting..."
              : "Submit Bug Report"}
          </button>
        </div>
      </form>
    </div>
  );
}
