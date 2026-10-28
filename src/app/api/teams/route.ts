import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import localStore from "@/lib/localStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    const id = searchParams.get("id");

    try {
      if (id) {
        const team = await prisma.team.findUnique({
          where: { id },
          include: {
            submissions: { orderBy: { createdAt: "desc" } },
            claimedTreasures: true,
          },
        });
        return NextResponse.json({ team });
      }

      if (email) {
        const team = await prisma.team.findFirst({
          where: { email: { equals: email.trim(), mode: "insensitive" } },
          include: {
            submissions: { orderBy: { createdAt: "desc" } },
            claimedTreasures: true,
          },
        });
        return NextResponse.json({ team });
      }

      const teams = await prisma.team.findMany({
        orderBy: { totalScore: "desc" },
        include: { claimedTreasures: true },
      });

      return NextResponse.json({ teams });
    } catch (dbErr: any) {
      console.warn("[api/teams GET fallback to localStore]:", dbErr.message);
      if (id) {
        const team = localStore.findTeamById(id);
        return NextResponse.json({ team });
      }
      if (email) {
        const team = localStore.findTeamByEmail(email);
        return NextResponse.json({ team });
      }
      return NextResponse.json({ teams: localStore.getTeams() });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to fetch teams", details: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: "Team Name and Email are required" },
        { status: 400 }
      );
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    try {
      // Find existing team across all 3 laptops case-insensitively by name or email
      let team = await prisma.team.findFirst({
        where: {
          OR: [
            { email: { equals: cleanEmail, mode: "insensitive" } },
            { name: { equals: cleanName, mode: "insensitive" } },
          ],
        },
        include: {
          submissions: { orderBy: { createdAt: "desc" } },
          claimedTreasures: true,
        },
      });

      if (!team) {
        try {
          team = await prisma.team.create({
            data: {
              name: cleanName,
              email: cleanEmail,
              totalScore: 0,
              validBugsCount: 0,
              hasMilestoneBonus: false,
            },
            include: {
              submissions: { orderBy: { createdAt: "desc" } },
              claimedTreasures: true,
            },
          });
        } catch {
          // If a concurrent creation occurred simultaneously from another teammate's laptop
          team = await prisma.team.findFirst({
            where: {
              OR: [
                { email: { equals: cleanEmail, mode: "insensitive" } },
                { name: { equals: cleanName, mode: "insensitive" } },
              ],
            },
            include: {
              submissions: { orderBy: { createdAt: "desc" } },
              claimedTreasures: true,
            },
          });
        }
      }

      localStore.createTeam(cleanName, cleanEmail);
      return NextResponse.json({
        team,
        message: "Team recognized and authenticated successfully across all team devices",
      });
    } catch (dbErr: any) {
      console.warn("[api/teams POST fallback to localStore]:", dbErr.message);
      const team = localStore.createTeam(cleanName, cleanEmail);
      return NextResponse.json({
        team,
        message: "Team authenticated successfully in local store",
      });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to authenticate team", details: err.message },
      { status: 500 }
    );
  }
}
