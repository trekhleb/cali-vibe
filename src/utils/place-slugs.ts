/**
 * Slug utilities for county/city detail page URLs.
 *
 * URL pattern: /cali-vibe/county/{slug}  or  /cali-vibe/city/{slug}
 * Example:     /cali-vibe/county/los-angeles
 */

export type PlaceType = "county" | "city";

/** Convert a place name to a URL-safe slug. */
export function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/** Resolve a slug back to the original name from a list of known names. */
export function slugToName(slug: string, allNames: string[]): string | null {
  return allNames.find((n) => nameToSlug(n) === slug) ?? null;
}

/** Build the full detail page path (without base). */
export function detailPath(type: PlaceType, name: string): string {
  return `${type}/${nameToSlug(name)}`;
}

/** Build the full detail page URL (with base). */
export function detailUrl(type: PlaceType, name: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}/${detailPath(type, name)}`;
}
