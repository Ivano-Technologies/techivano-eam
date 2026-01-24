import { usePhotoQueue } from '@/hooks/usePhotoQueue';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, AlertCircle, CheckCircle, RefreshCw, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * Photo queue status indicator
 * Shows pending uploads and allows manual sync/retry
 */
export function PhotoQueueStatus() {
  const {
    queue,
    isOnline,
    isSyncing,
    syncQueue,
    retryFailed,
    clearQueue,
    getPendingCount,
    getFailedCount,
  } = usePhotoQueue();

  const pendingCount = getPendingCount();
  const failedCount = getFailedCount();

  // Don't show if queue is empty
  if (queue.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Upload className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium text-sm">Photo Upload Queue</p>
              <div className="flex items-center gap-2 mt-1">
                {pendingCount > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {pendingCount} pending
                  </Badge>
                )}
                {failedCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {failedCount} failed
                  </Badge>
                )}
                {!isOnline && (
                  <Badge variant="secondary" className="text-xs">
                    Offline
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {failedCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={retryFailed}
                disabled={!isOnline || isSyncing}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Retry
              </Button>
            )}
            
            {pendingCount > 0 && isOnline && (
              <Button
                size="sm"
                onClick={syncQueue}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-1" />
                    Sync Now
                  </>
                )}
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={clearQueue}
              disabled={isSyncing}
              title="Clear queue"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Queue items list */}
        {queue.length > 0 && (
          <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
            {queue.map((photo) => (
              <div
                key={photo.id}
                className="flex items-center justify-between text-xs p-2 rounded bg-muted/50"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {photo.status === 'success' && (
                    <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />
                  )}
                  {photo.status === 'error' && (
                    <AlertCircle className="h-3 w-3 text-destructive shrink-0" />
                  )}
                  {photo.status === 'uploading' && (
                    <RefreshCw className="h-3 w-3 text-primary animate-spin shrink-0" />
                  )}
                  {photo.status === 'pending' && (
                    <Upload className="h-3 w-3 text-muted-foreground shrink-0" />
                  )}
                  <span className="truncate">
                    Asset #{photo.assetId} - {photo.caption || 'No caption'}
                  </span>
                </div>
                <span className="text-muted-foreground ml-2">
                  {new Date(photo.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
