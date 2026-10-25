"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTeam } from "@/context/TeamContext";
import { Trophy, Bug, Sparkles, ListChecks, Shield, LogOut } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const { team, logoutTeam, setIsAuthModalOpen } = useTeam();

  const navLinks = [
    { href: "/submit", label: "Report Bug", icon: Bug },
    { href: "/treasures", label: "Treasure Vault", icon: Sparkles },
    { href: "/my-submissions", label: "My Submissions", icon: ListChecks },
    { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center space-x-6">
            <Link href="/" className="flex items-center space-x-2.5">
              <span className="font-mono font-bold text-sm bg-neutral-900 text-white px-2 py-1 rounded-sm">
                ENTROPY
              </span>
              <span className="font-mono text-sm tracking-tight text-neutral-900 font-bold hidden sm:inline">
                QA PORTAL
              </span>
            </Link>

            {/* Nav Links */}
            <nav className="hidden md:flex items-center space-x-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center space-x-2 px-3.5 py-2 rounded-sm text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-neutral-100 text-neutral-900 font-semibold"
                        : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Section */}
          <div className="flex items-center space-x-3">
            {team ? (
              <div className="flex items-center space-x-2 bg-neutral-100 border border-neutral-300 px-3 py-1.5 rounded-sm">
                <span className="font-mono text-xs sm:text-sm font-bold text-neutral-900 uppercase">
                  {team.name}
                </span>
                <span className="text-neutral-300">|</span>
                <span className="font-mono text-xs sm:text-sm font-bold text-neutral-900 bg-white px-2 py-0.5 rounded border border-neutral-200">
                  {team.totalScore} PTS
                </span>
                <button
                  onClick={logoutTeam}
                  title="Switch / Log out Team"
                  className="text-neutral-400 hover:text-neutral-900 ml-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="px-3.5 py-1.5 text-xs sm:text-sm font-mono font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-sm"
              >
                Sign In Team
              </button>
            )}

            <div className="h-5 w-[1px] bg-neutral-200 mx-1" />

            <Link
              href="/judge"
              className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs sm:text-sm font-mono rounded-sm transition-colors ${
                pathname.startsWith("/judge")
                  ? "bg-black text-white font-bold"
                  : "bg-neutral-50 text-neutral-700 hover:bg-neutral-100 border border-neutral-300"
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-neutral-500" />
              <span>JUDGE</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile Sub-Nav */}
      <div className="md:hidden flex items-center justify-around border-t border-neutral-100 py-2 bg-neutral-50 px-2">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center py-1 px-2 text-xs ${
                isActive ? "text-neutral-900 font-bold" : "text-neutral-500"
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
}
