import { resolveVanityRedirect, VANITY_ROUTES } from "../vanity-redirect";

describe("resolveVanityRedirect", () => {
  // ── Matching routes ──

  it("redirects /cali-vibe/transit to /cali-vibe/?transit=1&relief=0", () => {
    expect(resolveVanityRedirect("/cali-vibe/transit", "/cali-vibe/")).toBe(
      "/cali-vibe/?transit=1&relief=0",
    );
  });

  it("handles trailing slash on pathname", () => {
    expect(resolveVanityRedirect("/cali-vibe/transit/", "/cali-vibe/")).toBe(
      "/cali-vibe/?transit=1&relief=0",
    );
  });

  it("handles base without trailing slash", () => {
    expect(resolveVanityRedirect("/cali-vibe/transit", "/cali-vibe")).toBe(
      "/cali-vibe/?transit=1&relief=0",
    );
  });

  it("handles both trailing slashes", () => {
    expect(resolveVanityRedirect("/cali-vibe/transit/", "/cali-vibe")).toBe(
      "/cali-vibe/?transit=1&relief=0",
    );
  });

  // ── Non-matching routes ──

  it("returns null for the root path", () => {
    expect(resolveVanityRedirect("/cali-vibe/", "/cali-vibe/")).toBeNull();
  });

  it("returns null for the root path without trailing slash", () => {
    expect(resolveVanityRedirect("/cali-vibe", "/cali-vibe/")).toBeNull();
  });

  it("returns null for unknown vanity paths", () => {
    expect(resolveVanityRedirect("/cali-vibe/unknown", "/cali-vibe/")).toBeNull();
  });

  it("returns null when pathname does not start with base", () => {
    expect(resolveVanityRedirect("/other-app/transit", "/cali-vibe/")).toBeNull();
  });

  // ── VANITY_ROUTES config ──

  it("exports VANITY_ROUTES with /transit entry", () => {
    expect(VANITY_ROUTES).toHaveProperty("/transit", "?transit=1&relief=0");
  });

  it("covers all defined vanity routes", () => {
    for (const [suffix, target] of Object.entries(VANITY_ROUTES)) {
      const result = resolveVanityRedirect(`/cali-vibe${suffix}`, "/cali-vibe/");
      expect(result).toBe(`/cali-vibe/${target}`);
    }
  });
});
