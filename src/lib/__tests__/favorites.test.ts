import { favoritesStore, type FavoriteItem } from "@/lib/favorites";

describe("favoritesStore", () => {
  beforeEach(() => {
    localStorage.clear();
    // Re-initialize by triggering a read after clearing
  });

  const county: FavoriteItem = { type: "county", name: "Los Angeles" };
  const city: FavoriteItem = { type: "city", name: "San Francisco" };

  it("returns empty array initially", () => {
    expect(favoritesStore.getAll()).toEqual([]);
  });

  it("add() stores item and has() returns true", () => {
    favoritesStore.add(county);
    expect(favoritesStore.has(county)).toBe(true);
    expect(favoritesStore.getAll()).toContainEqual(county);
  });

  it("add() is idempotent", () => {
    favoritesStore.add(county);
    favoritesStore.add(county);
    expect(favoritesStore.getAll().filter((i) => i.name === county.name)).toHaveLength(1);
  });

  it("remove() removes item", () => {
    favoritesStore.add(county);
    favoritesStore.remove(county);
    expect(favoritesStore.has(county)).toBe(false);
  });

  it("reorder() changes order within type, preserves others", () => {
    const c1: FavoriteItem = { type: "county", name: "A" };
    const c2: FavoriteItem = { type: "county", name: "B" };
    favoritesStore.add(city);
    favoritesStore.add(c1);
    favoritesStore.add(c2);
    favoritesStore.reorder("county", ["B", "A"]);
    const all = favoritesStore.getAll();
    const counties = all.filter((i) => i.type === "county");
    expect(counties[0].name).toBe("B");
    expect(counties[1].name).toBe("A");
    expect(all.some((i) => i.name === "San Francisco")).toBe(true);
  });

  it("subscribe() calls callback on mutations", () => {
    const cb = vi.fn();
    const unsub = favoritesStore.subscribe(cb);
    favoritesStore.add(county);
    expect(cb).toHaveBeenCalledTimes(1);
    favoritesStore.remove(county);
    expect(cb).toHaveBeenCalledTimes(2);
    unsub();
    favoritesStore.add(city);
    expect(cb).toHaveBeenCalledTimes(2); // no more calls after unsub
  });

  it("handles corrupted localStorage JSON", () => {
    localStorage.setItem("cali-vibe-favorites", "not-json");
    expect(favoritesStore.getAll()).toEqual([]);
  });
});
