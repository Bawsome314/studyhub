import { useState, useEffect, useRef } from 'react';

export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // Track last JSON we wrote so we can detect external writes
  const lastWrittenRef = useRef(null);

  // Write to localStorage and notify sync layer
  useEffect(() => {
    try {
      const json = JSON.stringify(storedValue);
      lastWrittenRef.current = json;
      localStorage.setItem(key, json);
      // Notify SyncProvider and other hook instances that a key changed
      window.dispatchEvent(new CustomEvent('studyhub-storage-write', { detail: { key } }));
    } catch {
      // Storage full or unavailable
    }
  }, [key, storedValue]);

  // Re-read when another hook instance writes to the same key
  useEffect(() => {
    const handleStorageWrite = (e) => {
      if (e.detail?.key === key) {
        try {
          const item = localStorage.getItem(key);
          if (item !== null && item !== lastWrittenRef.current) {
            lastWrittenRef.current = item;
            setStoredValue(JSON.parse(item));
          }
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('studyhub-storage-write', handleStorageWrite);
    return () => window.removeEventListener('studyhub-storage-write', handleStorageWrite);
  }, [key]);

  // Re-read from localStorage when a sync pull happens (data may have changed)
  useEffect(() => {
    const handleSyncPull = () => {
      try {
        const item = localStorage.getItem(key);
        if (item !== null) {
          lastWrittenRef.current = item;
          setStoredValue(JSON.parse(item));
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener('studyhub-sync-pull', handleSyncPull);
    return () => window.removeEventListener('studyhub-sync-pull', handleSyncPull);
  }, [key]);

  return [storedValue, setStoredValue];
}
