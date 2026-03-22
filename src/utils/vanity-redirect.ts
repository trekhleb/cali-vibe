// Vanity URL redirects (e.g. /cali-vibe/transit → /cali-vibe/?transit=1&relief=0)
export const VANITY_ROUTES: Record<string, string> = {
  "/transit": "?transit=1&relief=0",
};

/**
 * Given a pathname and base path, returns the URL to redirect to,
 * or null if no vanity route matches.
 */
export function resolveVanityRedirect(pathname: string, base: string): string | null {
  const normalizedBase = base.replace(/\/$/, "");
  const normalizedPath = pathname.replace(/\/$/, "");
  const suffix = normalizedPath.startsWith(normalizedBase)
    ? normalizedPath.slice(normalizedBase.length)
    : null;
  if (suffix && VANITY_ROUTES[suffix]) {
    return `${normalizedBase}/${VANITY_ROUTES[suffix]}`;
  }
  return null;
}
