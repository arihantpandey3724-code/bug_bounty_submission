"use client";

import React, { useState } from "react";
import { useTeam } from "@/context/TeamContext";
import { Bug, Upload, CheckCircle2, AlertCircle, FileCode2, Image as ImageIcon, X, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default function SubmitBugPage() {
  const { team, setIsAuthModalOpen } = useTeam();

  const [description, setDescription] = useState("");
  const [codeSnippet, setCodeSnippet] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

    if (!description.trim() && !codeSnippet.trim() && !screenshotUrl) {
      setErrorMsg("Please provide at least a description, code snippet, or screenshot.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSubmittedResult(null);

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
          <Bug className="w-6 h-6" />
          <h1 className="text-2xl font-bold tracking-tight font-sans">
            Report a Bug
          </h1>
        </div>
        <p className="text-sm text-neutral-600 font-sans">
          Submit reproduction steps, code evidence, or screenshots. Every report is permanently saved.
        </p>
      </div>

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
            className="px-4 py-2 bg-neutral-900 text-white text-xs sm:text-sm font-mono font-bold rounded-sm hover:bg-neutral-800"
          >
            Sign In Team
          </button>
        </div>
      ) : (
        <div className="px-4 py-3 bg-neutral-100 border border-neutral-200 rounded-sm flex items-center justify-between text-sm font-mono">
          <div className="flex items-center space-x-2">
            <span className="text-neutral-500">SUBMITTING AS:</span>
            <span className="font-bold text-neutral-900 uppercase">{team.name}</span>
            <span className="text-neutral-400">({team.email})</span>
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
        <div className="p-5 bg-neutral-900 text-white rounded-md space-y-3 font-mono text-sm">
          <div className="flex items-center space-x-2 text-emerald-400 font-bold">
            <CheckCircle2 className="w-5 h-5" />
            <span>REPORT RECEIVED & QUEUED FOR REVIEW</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-neutral-800 pt-3 text-xs text-neutral-300">
            <div>
              <span className="text-neutral-400 font-bold">REFERENCE ID: </span>
              <span className="text-white font-bold">{submittedResult.id}</span>
            </div>
            <div className="flex items-center space-x-1 text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>Permanently recorded and stored.</span>
            </div>
          </div>
          <div className="pt-2 flex items-center justify-between text-xs border-t border-neutral-800/60">
            <span className="text-neutral-400 font-sans">
              Your report is under review by the judges.
            </span>
            <Link
              href="/my-submissions"
              className="text-emerald-400 hover:underline font-bold"
            >
              View My Submissions →
            </Link>
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
          <label className="block text-sm font-mono font-bold uppercase tracking-wider text-neutral-800 mb-1.5">
            Bug Description & Steps to Reproduce <span className="text-rose-500">*</span>
          </label>
          <textarea
            required
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Explain where the bug occurred, what steps you took, and what went wrong..."
            className="w-full p-3.5 text-sm sm:text-base bg-neutral-50 border border-neutral-300 rounded-sm focus:outline-none focus:border-neutral-900 font-sans"
          />
        </div>

        {/* Code Snippet */}
        <div>
          <label className="block text-sm font-mono font-bold uppercase tracking-wider text-neutral-800 mb-1.5 flex items-center space-x-2">
            <FileCode2 className="w-4 h-4" />
            <span>Code / Network Snippet (Optional)</span>
          </label>
          <textarea
            rows={4}
            value={codeSnippet}
            onChange={(e) => setCodeSnippet(e.target.value)}
            placeholder="Paste relevant HTML, payload, or inspector code..."
            className="w-full p-3.5 text-sm bg-neutral-950 text-neutral-100 border border-neutral-800 rounded-sm focus:outline-none font-mono"
          />
        </div>

        {/* Screenshot */}
        <div>
          <label className="block text-sm font-mono font-bold uppercase tracking-wider text-neutral-800 mb-1.5 flex items-center space-x-2">
            <ImageIcon className="w-4 h-4" />
            <span>Screenshot Proof (Optional)</span>
          </label>

          {screenshotUrl ? (
            <div className="border border-neutral-300 rounded-sm p-3 bg-neutral-50">
              <div className="flex items-center justify-between mb-2 pb-1 border-b border-neutral-200">
                <span className="text-xs font-mono font-bold text-neutral-700">IMAGE ATTACHED</span>
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
            <label className="border-2 border-dashed border-neutral-300 hover:border-neutral-500 rounded-sm p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-neutral-50/50">
              <Upload className="w-6 h-6 text-neutral-400 mb-2" />
              <span className="text-sm font-mono text-neutral-800 font-bold">
                Upload Screenshot or Paste (Ctrl + V)
              </span>
              <span className="text-xs text-neutral-500 mt-1">
                PNG, JPG, or WEBP up to 5MB (or press Ctrl+V anywhere)
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
          <span className="text-xs font-mono text-neutral-500 flex items-center space-x-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Submissions are permanently recorded.</span>
          </span>
          <button
            type="submit"
            disabled={isSubmitting || !team}
            className="px-6 py-3 bg-neutral-900 text-white text-sm font-mono font-bold tracking-wider uppercase hover:bg-neutral-800 disabled:opacity-50 rounded-sm transition-colors shadow-sm"
          >
            {isSubmitting ? "SAVING..." : "SUBMIT BUG REPORT"}
          </button>
        </div>
      </form>
    </div>
  );
}
