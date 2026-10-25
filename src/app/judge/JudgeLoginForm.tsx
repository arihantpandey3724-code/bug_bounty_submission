"use client";

import React, { useState } from "react";
import { ShieldCheck, AlertCircle } from "lucide-react";

export default function JudgeLoginForm() {
  const [pinInput, setPinInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/judge/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinInput.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Invalid Judge Passcode PIN");
      }

      // Reload so Next.js server component verifies the newly set HTTP-only cookie
      window.location.reload();
    } catch (err: any) {
      setAuthError(err.message || "Failed to authenticate");
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto my-14 p-6 sm:p-8 bg-white border border-neutral-300 rounded-md shadow-sm space-y-4">
      <div className="flex items-center space-x-2 text-neutral-900 border-b border-neutral-200 pb-3">
        <ShieldCheck className="w-6 h-6" />
        <h1 className="text-base font-bold uppercase font-mono">
          Lead Judge Access
        </h1>
      </div>

      <p className="text-sm text-neutral-600 leading-relaxed font-sans">
        Enter judge passcode PIN to access triage desk and scoring controls.
      </p>

      {authError && (
        <div className="p-3 bg-rose-50 border border-rose-300 text-rose-700 text-sm font-mono rounded-sm flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{authError}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-mono font-bold uppercase text-neutral-700 mb-1.5">
            Judge Passcode PIN
          </label>
          <input
            type="password"
            required
            autoFocus
            disabled={isLoading}
            placeholder="Enter Judge Passcode PIN..."
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 border border-neutral-300 rounded-sm font-mono focus:outline-none focus:border-neutral-900 disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !pinInput.trim()}
          className="w-full py-2.5 bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50 text-sm font-mono font-bold uppercase rounded-sm transition-colors"
        >
          {isLoading ? "Verifying Passcode..." : "Access Triage Console"}
        </button>
      </form>
    </div>
  );
}
