"use client";

// The data side of the hero's creator fan, kept apart from its looks. Real creators need users.allow_on_landing
// (a migration) and GET /api/landing/creators, both waiting for the owner's approval; until then the hook hands
// back nothing and the fan shows coloured placeholder tiles with the demo note.

export interface LandingCreator {
  id: string;
  firstName: string;
  category: string;
  poster: string;
  tag: "UGC" | "POST";
}

export function useLandingCreators(): { creators: LandingCreator[] | null; loading: boolean } {
  return { creators: null, loading: false };
}
