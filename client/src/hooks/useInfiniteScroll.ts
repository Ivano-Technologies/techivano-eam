import { useEffect, useRef, useState, useCallback } from 'react';

interface UseInfiniteScrollOptions {
  threshold?: number; // Distance from bottom to trigger load (in pixels)
  enabled?: boolean;
}

/**
 * Hook for implementing infinite scroll / lazy loading
 * Triggers callback when user scrolls near the bottom of the page
 */
export function useInfiniteScroll(
  onLoadMore: () => void | Promise<void>,
  options: UseInfiniteScrollOptions = {}
) {
  const { threshold = 300, enabled = true } = options;
  const [isLoading, setIsLoading] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const handleLoadMore = useCallback(async () => {
    if (isLoading || !enabled) return;

    setIsLoading(true);
    try {
      await onLoadMore();
    } catch (error) {
      console.error('Error loading more items:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, enabled, onLoadMore]);

  useEffect(() => {
    if (!enabled || !sentinelRef.current) return;

    // Use Intersection Observer for better performance
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          handleLoadMore();
        }
      },
      {
        rootMargin: `${threshold}px`,
      }
    );

    observerRef.current.observe(sentinelRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [enabled, threshold, handleLoadMore]);

  return {
    sentinelRef,
    isLoading,
  };
}

/**
 * Hook for paginated data with infinite scroll
 */
export function usePaginatedData<T>(
  initialData: T[] = [],
  pageSize: number = 20
) {
  const [displayedItems, setDisplayedItems] = useState<T[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const allItemsRef = useRef<T[]>(initialData);

  // Update when data changes
  useEffect(() => {
    allItemsRef.current = initialData;
    setDisplayedItems(initialData.slice(0, pageSize));
    setCurrentPage(1);
    setHasMore(initialData.length > pageSize);
  }, [initialData, pageSize]);

  const loadMore = useCallback(() => {
    const nextPage = currentPage + 1;
    const startIndex = 0;
    const endIndex = nextPage * pageSize;
    const newItems = allItemsRef.current.slice(startIndex, endIndex);

    setDisplayedItems(newItems);
    setCurrentPage(nextPage);
    setHasMore(endIndex < allItemsRef.current.length);
  }, [currentPage, pageSize]);

  const reset = useCallback(() => {
    setDisplayedItems(allItemsRef.current.slice(0, pageSize));
    setCurrentPage(1);
    setHasMore(allItemsRef.current.length > pageSize);
  }, [pageSize]);

  return {
    displayedItems,
    hasMore,
    loadMore,
    reset,
    totalCount: allItemsRef.current.length,
    displayedCount: displayedItems.length,
  };
}
