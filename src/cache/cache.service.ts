import { CacheEntry } from './types';

class CacheService {
  private memoryCache = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string, persist: boolean = false): T | null {
    const now = Date.now();
    
    // Primero buscar en memoria
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry) {
      if (memoryEntry.expiresAt > now) {
        return memoryEntry.data as T;
      } else {
        // Expirado, limpiar de memoria
        this.memoryCache.delete(key);
      }
    }
    
    // Si no se encuentra en memoria y persist es true, buscar en localStorage
    if (persist) {
      try {
        const stored = localStorage.getItem(`cache:${key}`);
        if (stored) {
          const entry: CacheEntry<T> = JSON.parse(stored);
          if (entry.expiresAt > now) {
            // Subir a memoria antes de retornar
            this.memoryCache.set(key, entry);
            return entry.data;
          } else {
            // Expirado, limpiar de localStorage
            localStorage.removeItem(`cache:${key}`);
          }
        }
      } catch (error) {
        console.warn('Error reading from localStorage:', error);
        localStorage.removeItem(`cache:${key}`);
      }
    }
    
    return null;
  }

  set<T>(key: string, data: T, ttl: number, persist: boolean = false): void {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      data,
      expiresAt: now + ttl,
      cachedAt: now
    };
    
    // Siempre escribir en memoria
    this.memoryCache.set(key, entry);
    
    // Adicionalmente en localStorage si persist es true
    if (persist) {
      try {
        localStorage.setItem(`cache:${key}`, JSON.stringify(entry));
      } catch (error) {
        console.warn('Error writing to localStorage:', error);
      }
    }
  }

  invalidate(key: string): void {
    // Limpiar de memoria
    this.memoryCache.delete(key);
    
    // Limpiar de localStorage si existe
    try {
      localStorage.removeItem(`cache:${key}`);
    } catch (error) {
      console.warn('Error removing from localStorage:', error);
    }
  }

  invalidateByPrefix(prefix: string): void {
    // Limpiar de memoria
    for (const [key] of this.memoryCache) {
      if (key.startsWith(prefix)) {
        this.memoryCache.delete(key);
      }
    }
    
    // Limpiar de localStorage
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('cache:') && key.slice(6).startsWith(prefix)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (error) {
      console.warn('Error clearing localStorage by prefix:', error);
    }
  }
}

export const cacheService = new CacheService();
