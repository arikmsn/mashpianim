// The identity colour of the login / register screens (design package v3, "צבעי זהות"): businesses are pink,
// creators are lemon. The persona comes from ?type=, from the role an account signed in as, and is remembered
// on the device (localStorage, with sessionStorage as the per-tab copy) so /login without a parameter, a
// re-opened browser and an installed app all open on the colour of the account that uses this device. Pure
// helpers plus thin storage wrappers; unit-tested.

export type Persona = "brand" | "creator";

export const PERSONA_STORAGE_KEY = "mashpian.persona";

export function parsePersona(value: unknown): Persona | null {
  return value === "brand" || value === "creator" ? value : null;
}

// The URL parameter wins; otherwise what the device remembers
export function resolvePersona(typeParam: string | null | undefined, stored: string | null | undefined): Persona | null {
  return parsePersona(typeParam) ?? parsePersona(stored);
}

export function otherPersona(persona: Persona): Persona {
  return persona === "brand" ? "creator" : "brand";
}

// The persona of a signed-in role (admins keep whatever the device remembered)
export function personaForRole(role: string | null | undefined): Persona | null {
  return role === "brand" ? "brand" : role === "creator" ? "creator" : null;
}

export function readStoredPersona(): Persona | null {
  try {
    return parsePersona(window.sessionStorage.getItem(PERSONA_STORAGE_KEY)) ?? parsePersona(window.localStorage.getItem(PERSONA_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function storePersona(persona: Persona | null): void {
  try {
    if (persona) {
      window.sessionStorage.setItem(PERSONA_STORAGE_KEY, persona);
      window.localStorage.setItem(PERSONA_STORAGE_KEY, persona);
    } else {
      window.sessionStorage.removeItem(PERSONA_STORAGE_KEY);
      window.localStorage.removeItem(PERSONA_STORAGE_KEY);
    }
  } catch {
    // private mode or blocked storage: the URL parameter still carries the type
  }
}

export function withType(path: string, persona: Persona | null): string {
  if (!persona) return path;
  return `${path}${path.includes("?") ? "&" : "?"}type=${persona}`;
}

// The web app manifest of a persona: an installed app opens on the screen of the account that installed it
export function manifestHref(persona: Persona | null): string {
  return persona ? `/api/manifest?persona=${persona}` : "/manifest.json";
}
