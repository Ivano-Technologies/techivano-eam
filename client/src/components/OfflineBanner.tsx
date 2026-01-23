import { useState, useEffect } from 'react';
import { WifiOff, Wifi, CloudOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * OfflineBanner - Shows connection status and pending offline changes
 * Displays at the top of the screen when offline or when there are pending syncs
 */
export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // When coming back online, trigger sync
      syncPendingChanges();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check for pending changes on mount and periodically
    checkPendingChanges();
    const interval = setInterval(checkPendingChanges, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    // Show banner if offline OR if there are pending changes
    setShowBanner(!isOnline || pendingChanges > 0);
  }, [isOnline, pendingChanges]);

  const checkPendingChanges = () => {
    // Check localStorage for pending offline changes
    // This is a simplified implementation - in production, you'd integrate with your offline storage
    try {
      const pending = localStorage.getItem('pendingOfflineChanges');
      if (pending) {
        const changes = JSON.parse(pending);
        setPendingChanges(Array.isArray(changes) ? changes.length : 0);
      } else {
        setPendingChanges(0);
      }
    } catch (error) {
      console.error('Error checking pending changes:', error);
      setPendingChanges(0);
    }
  };

  const syncPendingChanges = async () => {
    if (!isOnline || pendingChanges === 0) return;

    try {
      // In production, this would sync pending changes to the server
      // For now, just clear the pending changes
      localStorage.removeItem('pendingOfflineChanges');
      setPendingChanges(0);
      
      // Show success feedback
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]); // Success vibration pattern
      }
    } catch (error) {
      console.error('Error syncing changes:', error);
    }
  };

  if (!showBanner) return null;

  return (
    <div 
      className={`fixed top-0 left-0 right-0 z-50 ${
        isOnline ? 'bg-blue-600' : 'bg-orange-600'
      } text-white shadow-lg transition-all duration-300`}
      role="alert"
      aria-live="polite"
    >
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {isOnline ? (
              <>
                <Wifi className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm font-medium truncate">
                  Back online
                </span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 flex-shrink-0 animate-pulse" />
                <span className="text-sm font-medium truncate">
                  No internet connection
                </span>
              </>
            )}
            
            {pendingChanges > 0 && (
              <>
                <span className="text-white/70">•</span>
                <CloudOff className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm truncate">
                  {pendingChanges} {pendingChanges === 1 ? 'change' : 'changes'} pending
                </span>
              </>
            )}
          </div>

          {isOnline && pendingChanges > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="text-white hover:bg-white/20 h-7 px-2 flex-shrink-0"
              onClick={syncPendingChanges}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              <span className="text-xs">Sync</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Helper function to add a pending change to offline storage
 * Call this when making changes while offline
 */
export function addPendingChange(change: {
  type: 'create' | 'update' | 'delete';
  entity: string;
  data: any;
  timestamp: number;
}) {
  try {
    const existing = localStorage.getItem('pendingOfflineChanges');
    const changes = existing ? JSON.parse(existing) : [];
    changes.push(change);
    localStorage.setItem('pendingOfflineChanges', JSON.stringify(changes));
    
    // Dispatch custom event to trigger banner update
    window.dispatchEvent(new Event('pendingChangesUpdated'));
  } catch (error) {
    console.error('Error adding pending change:', error);
  }
}

/**
 * Helper function to get all pending changes
 */
export function getPendingChanges(): any[] {
  try {
    const pending = localStorage.getItem('pendingOfflineChanges');
    return pending ? JSON.parse(pending) : [];
  } catch (error) {
    console.error('Error getting pending changes:', error);
    return [];
  }
}
