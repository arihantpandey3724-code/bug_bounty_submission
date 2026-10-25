"use client";

import React, { useState } from "react";
import { useTeam } from "@/context/TeamContext";
import { X, ShieldCheck } from "lucide-react";

export default function TeamAuthModal() {
  const { isAuthModalOpen, setIsAuthModalOpen, loginTeam } = useTeam();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isAuthModalOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    setIsSubmitting(true);
    const success = await loginTeam(name.trim(), email.trim());
    setIsSubmitting(false);

    if (success) {
      setName("");
      setEmail("");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md bg-white border border-neutral-200 rounded-lg shadow-2xl p-6">
        <div className="flex items-center justify-between border-b border-neutral-200 pb-3 mb-4">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-neutral-900" />
            <h2 className="text-base font-semibold text-neutral-900 tracking-tight font-sans">
              Sign In Team
            </h2>
          </div>
          <button
            onClick={() => setIsAuthModalOpen(false)}
            className="text-neutral-400 hover:text-neutral-700 p-1 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-neutral-600 mb-5 leading-relaxed font-sans">
          Enter your team name and contact email to report bugs and claim treasure flags.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 font-sans">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
              Team Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Team Apex"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 border border-neutral-300 rounded-md focus:outline-none focus:border-neutral-900 font-sans"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
              Contact Email
            </label>
            <input
              type="email"
              required
              placeholder="lead@team.qa"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 border border-neutral-300 rounded-md focus:outline-none focus:border-neutral-900 font-sans"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 rounded-md transition-colors"
            >
              {isSubmitting ? "Signing in..." : "Continue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
