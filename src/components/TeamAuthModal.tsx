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
      <div className="w-full max-w-md bg-white border border-neutral-300 rounded-md shadow-2xl p-6">
        <div className="flex items-center justify-between border-b border-neutral-200 pb-3 mb-4">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-neutral-900" />
            <h2 className="text-base font-bold text-neutral-900 tracking-tight font-sans">
              Sign In Team
            </h2>
          </div>
          <button
            onClick={() => setIsAuthModalOpen(false)}
            className="text-neutral-400 hover:text-neutral-700 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-neutral-500 mb-5 leading-relaxed">
          Enter your team name and contact email to submit bugs and redeem flags.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
              Team Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Team Apex"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 border border-neutral-300 rounded-sm focus:outline-none focus:border-neutral-900 font-sans"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
              Contact Email
            </label>
            <input
              type="email"
              required
              placeholder="lead@team.qa"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 border border-neutral-300 rounded-sm focus:outline-none focus:border-neutral-900 font-sans"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-bold text-white bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 rounded-sm"
            >
              {isSubmitting ? "Connecting..." : "Continue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
