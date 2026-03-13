export interface FavoriteItem {
  type: "county" | "city";
  name: string;
}

function itemKey(item: FavoriteItem): string {
  return `${item.type}:${item.name}`;
}

export interface FavoritesStore {
  getAll(): FavoriteItem[];
  add(item: FavoriteItem): void;
  remove(item: FavoriteItem): void;
  has(item: FavoriteItem): boolean;
  reorder(type: FavoriteItem["type"], names: string[]): void;
  subscribe(callback: () => void): () => void;
}

const STORAGE_KEY = "cali-vibe-favorites";

const EMPTY: FavoriteItem[] = [];

class LocalStorageFavoritesStore implements FavoritesStore {
  private listeners = new Set<() => void>();
  private snapshot: FavoriteItem[] = EMPTY;
  private snapshotRaw: string | null = null;

  private read(): FavoriteItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === this.snapshotRaw) return this.snapshot;
      this.snapshotRaw = raw;
      this.snapshot = raw ? JSON.parse(raw) : EMPTY;
      return this.snapshot;
    } catch {
      return EMPTY;
    }
  }

  private write(items: FavoriteItem[]): void {
    const raw = JSON.stringify(items);
    localStorage.setItem(STORAGE_KEY, raw);
    this.snapshotRaw = raw;
    this.snapshot = items;
    this.notify();
  }

  private notify(): void {
    this.listeners.forEach((cb) => cb());
  }

  getAll(): FavoriteItem[] {
    return this.read();
  }

  add(item: FavoriteItem): void {
    const items = this.read();
    const key = itemKey(item);
    if (items.some((i) => itemKey(i) === key)) return;
    this.write([...items, item]);
  }

  remove(item: FavoriteItem): void {
    const key = itemKey(item);
    this.write(this.read().filter((i) => itemKey(i) !== key));
  }

  has(item: FavoriteItem): boolean {
    const key = itemKey(item);
    return this.read().some((i) => itemKey(i) === key);
  }

  reorder(type: FavoriteItem["type"], names: string[]): void {
    const items = this.read();
    const others = items.filter((i) => i.type !== type);
    const reordered = names.map((name) => ({ type, name }));
    this.write([...others, ...reordered]);
  }

  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
}

export const favoritesStore: FavoritesStore = new LocalStorageFavoritesStore();
