import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { TeamProvider } from "@/context/TeamContext";
import Navbar from "@/components/Navbar";
import TeamAuthModal from "@/components/TeamAuthModal";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Entropy 2026 | QA Bug Bounty Portal",
  description:
    "Official bug bounty reporting and competition platform for Entropy 2026.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen flex flex-col bg-[#fafafa] text-neutral-900`}>
        <TeamProvider>
          <Navbar />
          <TeamAuthModal />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </main>
          <footer className="w-full bg-white border-t border-neutral-200 py-4 mt-auto font-sans">
            <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-500 gap-2">
              <div>
                Entropy 2026 Bug Bounty Platform
              </div>
              <div className="flex items-center space-x-3 text-neutral-400">
                <span>55 Target Bugs</span>
                <span>•</span>
                <span>10 Treasure Flags</span>
                <span>•</span>
                <span>Live Scoring</span>
              </div>
            </div>
          </footer>
        </TeamProvider>
      </body>
    </html>
  );
}
