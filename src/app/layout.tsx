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
        </TeamProvider>
      </body>
    </html>
  );
}
