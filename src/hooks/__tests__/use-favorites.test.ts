import { renderHook, act } from "@testing-library/react";
import { useFavorites } from "@/hooks/use-favorites";
import { favoritesStore } from "@/lib/favorites";

describe("useFavorites", () => {
  beforeEach(() => {
    localStorage.clear();
    // Clear store state
    favoritesStore.getAll().forEach((item) => favoritesStore.remove(item));
  });

  it("starts with empty favorites", () => {
    const { result } = renderHook(() => useFavorites());
    expect(result.current.favorites).toEqual([]);
    expect(result.current.favoriteCounties).toEqual([]);
    expect(result.current.favoriteCities).toEqual([]);
  });

  it("toggleFavorite adds and removes", () => {
    const { result } = renderHook(() => useFavorites());
    act(() => result.current.toggleFavorite("county", "LA"));
    expect(result.current.favoriteCounties).toContain("LA");
    expect(result.current.favoriteCountySet.has("LA")).toBe(true);

    act(() => result.current.toggleFavorite("county", "LA"));
    expect(result.current.favoriteCounties).not.toContain("LA");
  });

  it("separates counties and cities", () => {
    const { result } = renderHook(() => useFavorites());
    act(() => {
      result.current.toggleFavorite("county", "Orange");
      result.current.toggleFavorite("city", "SF");
    });
    expect(result.current.favoriteCounties).toEqual(["Orange"]);
    expect(result.current.favoriteCities).toEqual(["SF"]);
    expect(result.current.favoriteCitySet.has("SF")).toBe(true);
  });

  it("reorderFavorites changes order", () => {
    const { result } = renderHook(() => useFavorites());
    act(() => {
      result.current.toggleFavorite("county", "A");
      result.current.toggleFavorite("county", "B");
    });
    act(() => result.current.reorderFavorites("county", ["B", "A"]));
    expect(result.current.favoriteCounties).toEqual(["B", "A"]);
  });
});
