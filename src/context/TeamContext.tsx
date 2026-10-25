"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export interface TeamState {
  id: string;
  name: string;
  email: string;
  totalScore: number;
  validBugsCount: number;
  hasMilestoneBonus: boolean;
}

interface TeamContextType {
  team: TeamState | null;
  isLoading: boolean;
  loginTeam: (name: string, email: string) => Promise<boolean>;
  logoutTeam: () => void;
  refreshTeam: () => Promise<void>;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const [team, setTeam] = useState<TeamState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("entropy_team_session");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setTeam(parsed);
        // Refresh latest scores from API
        fetchTeamStats(parsed.id);
      } catch {
        localStorage.removeItem("entropy_team_session");
      }
    }
    setIsLoading(false);
  }, []);

  async function fetchTeamStats(teamId: string) {
    try {
      const res = await fetch(`/api/teams?id=${teamId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.team) {
          setTeam(data.team);
          localStorage.setItem("entropy_team_session", JSON.stringify(data.team));
        }
      }
    } catch (err) {
      console.warn("Failed to refresh team stats:", err);
    }
  }

  async function loginTeam(name: string, email: string): Promise<boolean> {
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        alert(errorData.error || "Authentication failed");
        return false;
      }

      const data = await res.json();
      setTeam(data.team);
      localStorage.setItem("entropy_team_session", JSON.stringify(data.team));
      setIsAuthModalOpen(false);
      return true;
    } catch (err) {
      console.error("Login error:", err);
      alert("Network error while connecting to team portal.");
      return false;
    }
  }

  function logoutTeam() {
    setTeam(null);
    localStorage.removeItem("entropy_team_session");
  }

  async function refreshTeam() {
    if (team?.id) {
      await fetchTeamStats(team.id);
    }
  }

  return (
    <TeamContext.Provider
      value={{
        team,
        isLoading,
        loginTeam,
        logoutTeam,
        refreshTeam,
        isAuthModalOpen,
        setIsAuthModalOpen,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  const context = useContext(TeamContext);
  if (!context) {
    throw new Error("useTeam must be used within a TeamProvider");
  }
  return context;
}
