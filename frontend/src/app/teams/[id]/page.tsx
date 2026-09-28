"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatTeamSlug } from "@/lib/country";

type Team = {
  id: string;
  country?: string;
  countryCode?: string;
};

export default function LegacyTeamRoute() {
  const params = useParams();
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    const teamId = id;

    async function redirectToCountryPage() {
      try {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "";
        const response = await fetch(`${base}/api/Teams/${encodeURIComponent(teamId)}`);
        if (!response.ok) throw new Error("Team not found.");
        const team = (await response.json()) as Team;
        const slug = formatTeamSlug(team.country, team.countryCode, team.id);
        router.replace(`/team/${slug}`);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Unable to load team.");
      }
    }

    redirectToCountryPage();
  }, [id, router]);

  return (
    <main className="min-h-screen bg-gray-950 p-8 text-white">
      <div className="mx-auto max-w-xl rounded-3xl border border-gray-800 bg-gray-900 p-8 text-center">
        {error ? (
          <>
            <h1 className="text-2xl font-bold">Team not found</h1>
            <p className="mt-3 text-gray-400">{error}</p>
            <Link href="/teams" className="mt-6 inline-block text-sky-400 hover:text-sky-300">Back to teams</Link>
          </>
        ) : (
          <p className="text-gray-300">Opening the team page…</p>
        )}
      </div>
    </main>
  );
}
