import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { TeamProvider } from "@/context/TeamContext";
import Navbar from "@/components/Navbar";
import TeamAuthModal from "@/components/TeamAuthModal";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Entropy 2K26 | QA Submission & Triage Portal",
  description:
    "Official bug submission, automated AI grading, and judge triage portal for the Entropy 2K26 E-Commerce Bug Bounty Simulation.",
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
          <footer className="w-full bg-white border-t border-neutral-200 py-4 mt-auto">
            <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-500 font-mono">
              <div>
                [ENTROPY 2K26] QA BUG BOUNTY SIMULATION PORTAL
              </div>
              <div className="mt-1 sm:mt-0 flex items-center space-x-4">
                <span>55 MASTER DEFECTS</span>
                <span>•</span>
                <span>10 TREASURE BUGS</span>
                <span>•</span>
                <span>MILESTONE: +10 PTS</span>
              </div>
            </div>
          </footer>
        </TeamProvider>
      </body>
    </html>
  );
}
