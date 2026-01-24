import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

interface QueuedPhoto {
  id: string;
  assetId: number;
  file: File;
  caption: string;
  timestamp: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

const QUEUE_STORAGE_KEY = 'photo_upload_queue';
const MAX_QUEUE_SIZE = 50;

/**
 * Hook for managing offline photo upload queue
 * Automatically syncs photos when connection is restored
 */
export function usePhotoQueue() {
  const [queue, setQueue] = useState<QueuedPhoto[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load queue from localStorage on mount
  useEffect(() => {
    loadQueue();
  }, []);

  // Save queue to localStorage whenever it changes
  useEffect(() => {
    saveQueue(queue);
  }, [queue]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Connection restored. Syncing photos...');
      syncQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.info('You are offline. Photos will be queued for upload.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-sync when online
  useEffect(() => {
    if (isOnline && queue.some(p => p.status === 'pending')) {
      syncQueue();
    }
  }, [isOnline, queue]);

  const loadQueue = () => {
    try {
      const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Filter out old items (older than 7 days)
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const filtered = parsed.filter((item: QueuedPhoto) => item.timestamp > weekAgo);
        setQueue(filtered);
      }
    } catch (error) {
      console.error('Failed to load photo queue:', error);
    }
  };

  const saveQueue = (queueData: QueuedPhoto[]) => {
    try {
      // Don't store file objects in localStorage
      const serializable = queueData.map(({ file, ...rest }) => rest);
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(serializable));
    } catch (error) {
      console.error('Failed to save photo queue:', error);
    }
  };

  const addToQueue = useCallback((
    assetId: number,
    file: File,
    caption: string = ''
  ): string => {
    const id = `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const queuedPhoto: QueuedPhoto = {
      id,
      assetId,
      file,
      caption,
      timestamp: Date.now(),
      status: 'pending',
    };

    setQueue(prev => {
      // Limit queue size
      if (prev.length >= MAX_QUEUE_SIZE) {
        toast.warning('Photo queue is full. Please sync existing photos first.');
        return prev;
      }
      return [...prev, queuedPhoto];
    });

    toast.success('Photo added to upload queue');
    return id;
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    setQueue(prev => prev.filter(p => p.id !== id));
  }, []);

  const updateQueueItem = useCallback((
    id: string,
    updates: Partial<QueuedPhoto>
  ) => {
    setQueue(prev =>
      prev.map(p => (p.id === id ? { ...p, ...updates } : p))
    );
  }, []);

  const syncQueue = useCallback(async () => {
    if (isSyncing || !isOnline) return;

    const pendingPhotos = queue.filter(p => p.status === 'pending');
    if (pendingPhotos.length === 0) return;

    setIsSyncing(true);

    for (const photo of pendingPhotos) {
      try {
        updateQueueItem(photo.id, { status: 'uploading' });

        // Upload photo (this would call your actual upload mutation)
        // For now, we'll simulate the upload
        await uploadPhoto(photo);

        updateQueueItem(photo.id, { status: 'success' });
        
        // Remove successful uploads after a delay
        setTimeout(() => {
          removeFromQueue(photo.id);
        }, 2000);
      } catch (error: any) {
        updateQueueItem(photo.id, {
          status: 'error',
          error: error.message || 'Upload failed',
        });
      }
    }

    setIsSyncing(false);
    toast.success('Photo sync complete');
  }, [queue, isOnline, isSyncing, updateQueueItem, removeFromQueue]);

  const retryFailed = useCallback(() => {
    setQueue(prev =>
      prev.map(p => (p.status === 'error' ? { ...p, status: 'pending' } : p))
    );
    if (isOnline) {
      syncQueue();
    }
  }, [isOnline, syncQueue]);

  const clearQueue = useCallback(() => {
    setQueue([]);
    localStorage.removeItem(QUEUE_STORAGE_KEY);
    toast.success('Photo queue cleared');
  }, []);

  const getPendingCount = useCallback(() => {
    return queue.filter(p => p.status === 'pending' || p.status === 'uploading').length;
  }, [queue]);

  const getFailedCount = useCallback(() => {
    return queue.filter(p => p.status === 'error').length;
  }, [queue]);

  return {
    queue,
    isOnline,
    isSyncing,
    addToQueue,
    removeFromQueue,
    syncQueue,
    retryFailed,
    clearQueue,
    getPendingCount,
    getFailedCount,
  };
}

// Simulated upload function - replace with actual tRPC mutation
async function uploadPhoto(photo: QueuedPhoto): Promise<void> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Simulate occasional failures
  if (Math.random() < 0.1) {
    throw new Error('Upload failed');
  }
  
  // In real implementation, this would call:
  // await trpc.photos.create.mutate({
  //   assetId: photo.assetId,
  //   file: photo.file,
  //   caption: photo.caption,
  // });
}
