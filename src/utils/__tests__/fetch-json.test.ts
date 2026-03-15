describe("fetchJsonCached", () => {
  let fetchJsonCached: typeof import("@/utils/fetch-json").fetchJsonCached;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: 1 }),
      })
    );
    const mod = await import("@/utils/fetch-json");
    fetchJsonCached = mod.fetchJsonCached;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed JSON", async () => {
    const result = await fetchJsonCached("/test.json");
    expect(result).toEqual({ data: 1 });
  });

  it("caches subsequent calls to the same URL", async () => {
    await fetchJsonCached("/cached.json");
    await fetchJsonCached("/cached.json");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("fetches different URLs separately", async () => {
    await fetchJsonCached("/a.json");
    await fetchJsonCached("/b.json");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("throws on non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve({}) })
    );
    const mod = await import("@/utils/fetch-json");
    await expect(mod.fetchJsonCached("/bad.json")).rejects.toThrow("HTTP 404");
  });

  it("evicts failed promises from cache so retry works", async () => {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ retry: true }) });
      })
    );
    const mod = await import("@/utils/fetch-json");
    await expect(mod.fetchJsonCached("/retry.json")).rejects.toThrow("HTTP 500");
    const result = await mod.fetchJsonCached("/retry.json");
    expect(result).toEqual({ retry: true });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
