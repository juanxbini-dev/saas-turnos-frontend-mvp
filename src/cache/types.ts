export interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  cachedAt: number;
}

export interface CacheOptions {
  ttl?: number;
  persist?: boolean;
  revalidateOnFocus?: boolean;
}

export interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}
