import { useCallback, useMemo, useSyncExternalStore } from "react";
import { favoritesStore, type FavoriteItem } from "@/lib/favorites";

const subscribe = favoritesStore.subscribe.bind(favoritesStore);
const getSnapshot = () => favoritesStore.getAll();

export function useFavorites() {
  const favorites = useSyncExternalStore(subscribe, getSnapshot);

  const favoriteCounties = useMemo(
    () => favorites.filter((f) => f.type === "county").map((f) => f.name),
    [favorites]
  );

  const favoriteCities = useMemo(
    () => favorites.filter((f) => f.type === "city").map((f) => f.name),
    [favorites]
  );

  const favoriteCountySet = useMemo(() => new Set(favoriteCounties), [favoriteCounties]);
  const favoriteCitySet = useMemo(() => new Set(favoriteCities), [favoriteCities]);

  const toggleFavorite = useCallback((type: FavoriteItem["type"], name: string) => {
    const item: FavoriteItem = { type, name };
    if (favoritesStore.has(item)) {
      favoritesStore.remove(item);
    } else {
      favoritesStore.add(item);
    }
  }, []);

  const reorderFavorites = useCallback((type: FavoriteItem["type"], names: string[]) => {
    favoritesStore.reorder(type, names);
  }, []);

  return {
    favorites,
    favoriteCounties,
    favoriteCities,
    favoriteCountySet,
    favoriteCitySet,
    toggleFavorite,
    reorderFavorites,
  };
}
