// The identity colour of the login / register screens (design package v3, "צבעי זהות"): businesses are pink,
// creators are lemon. The persona comes from ?type= and is remembered for the session so /login without a
// parameter keeps the colour chosen on the home page. Pure, unit-tested.

export type Persona = "brand" | "creator";

export const PERSONA_STORAGE_KEY = "mashpian.persona";

export function parsePersona(value: unknown): Persona | null {
  return value === "brand" || value === "creator" ? value : null;
}

// The URL parameter wins; otherwise what the session remembers
export function resolvePersona(typeParam: string | null | undefined, stored: string | null | undefined): Persona | null {
  return parsePersona(typeParam) ?? parsePersona(stored);
}

export function otherPersona(persona: Persona): Persona {
  return persona === "brand" ? "creator" : "brand";
}

export function readStoredPersona(): Persona | null {
  try {
    return parsePersona(window.sessionStorage.getItem(PERSONA_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function storePersona(persona: Persona | null): void {
  try {
    if (persona) window.sessionStorage.setItem(PERSONA_STORAGE_KEY, persona);
    else window.sessionStorage.removeItem(PERSONA_STORAGE_KEY);
  } catch {
    // private mode or blocked storage: the URL parameter still carries the type
  }
}

export function withType(path: string, persona: Persona | null): string {
  if (!persona) return path;
  return `${path}${path.includes("?") ? "&" : "?"}type=${persona}`;
}
