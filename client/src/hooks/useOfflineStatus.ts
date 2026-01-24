import { useState, useEffect } from 'react';

export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
  };
}

/**
 * Check if data is cached (available offline)
 * In a real implementation, this would check IndexedDB or service worker cache
 */
export function useDataCacheStatus(dataKey: string) {
  const [isCached, setIsCached] = useState(false);
  const [isSynced, setIsSynced] = useState(true);

  useEffect(() => {
    // Check if data exists in cache
    const checkCache = async () => {
      try {
        // Check if service worker cache contains this data
        if ('caches' in window) {
          const cache = await caches.open('app-data');
          const response = await cache.match(`/api/data/${dataKey}`);
          setIsCached(!!response);
        }
      } catch (error) {
        console.warn('Cache check failed:', error);
      }
    };

    checkCache();
  }, [dataKey]);

  return {
    isCached,
    isSynced,
  };
}
