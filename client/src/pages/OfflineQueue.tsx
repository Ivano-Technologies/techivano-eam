import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Trash2, Upload, AlertCircle, CheckCircle, Image as ImageIcon, FileText, Wrench } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

interface QueueItem {
  id: string;
  type: 'photo' | 'work_order' | 'asset_update';
  title: string;
  description: string;
  timestamp: number;
  status: 'pending' | 'failed' | 'syncing';
  error?: string;
  data: any;
}

export default function OfflineQueue() {
  const [, setLocation] = useLocation();
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [syncing, setSyncing] = useState(false);

  // Load queue from localStorage
  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = () => {
    const items: QueueItem[] = [];
    
    // Load photo queue
    const photoQueue = localStorage.getItem('nrcs_photo_queue');
    if (photoQueue) {
      try {
        const photos = JSON.parse(photoQueue);
        photos.forEach((photo: any) => {
          items.push({
            id: `photo-${photo.timestamp}`,
            type: 'photo',
            title: 'Asset Photo Upload',
            description: photo.caption || 'No caption',
            timestamp: photo.timestamp,
            status: photo.status || 'pending',
            error: photo.error,
            data: photo,
          });
        });
      } catch (e) {
        console.error('Failed to parse photo queue:', e);
      }
    }

    // Sort by timestamp (newest first)
    items.sort((a, b) => b.timestamp - a.timestamp);
    setQueueItems(items);
  };

  const retryItem = async (item: QueueItem) => {
    toast.info(`Retrying ${item.title}...`);
    
    // Update status to syncing
    const updatedItems = queueItems.map(qi =>
      qi.id === item.id ? { ...qi, status: 'syncing' as const } : qi
    );
    setQueueItems(updatedItems);

    // Simulate retry (in real implementation, this would call the actual upload function)
    setTimeout(() => {
      // For demo, randomly succeed or fail
      const success = Math.random() > 0.3;
      
      if (success) {
        toast.success(`${item.title} synced successfully`);
        removeItem(item.id);
      } else {
        const failedItems = queueItems.map(qi =>
          qi.id === item.id 
            ? { ...qi, status: 'failed' as const, error: 'Network error' } 
            : qi
        );
        setQueueItems(failedItems);
        toast.error(`Failed to sync ${item.title}`);
      }
    }, 2000);
  };

  const retryAll = async () => {
    setSyncing(true);
    toast.info('Syncing all pending items...');

    // Retry each item sequentially
    for (const item of queueItems.filter(i => i.status !== 'syncing')) {
      await retryItem(item);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setSyncing(false);
  };

  const removeItem = (id: string) => {
    const item = queueItems.find(qi => qi.id === id);
    if (!item) return;

    // Remove from localStorage based on type
    if (item.type === 'photo') {
      const photoQueue = localStorage.getItem('nrcs_photo_queue');
      if (photoQueue) {
        try {
          const photos = JSON.parse(photoQueue);
          const filtered = photos.filter((p: any) => `photo-${p.timestamp}` !== id);
          localStorage.setItem('nrcs_photo_queue', JSON.stringify(filtered));
        } catch (e) {
          console.error('Failed to update photo queue:', e);
        }
      }
    }

    // Update UI
    setQueueItems(queueItems.filter(qi => qi.id !== id));
    toast.success('Item removed from queue');
  };

  const clearAll = () => {
    if (confirm('Are you sure you want to clear all pending items? This cannot be undone.')) {
      localStorage.removeItem('nrcs_photo_queue');
      setQueueItems([]);
      toast.success('Queue cleared');
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'photo':
        return <ImageIcon className="h-5 w-5" />;
      case 'work_order':
        return <Wrench className="h-5 w-5" />;
      case 'asset_update':
        return <FileText className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'syncing':
        return <Badge className="bg-blue-500">Syncing...</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="container mx-auto max-w-4xl space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Offline Queue</h1>
          <p className="text-muted-foreground mt-2">
            Manage pending uploads and sync status
          </p>
        </div>
        {queueItems.length > 0 && (
          <Button onClick={retryAll} disabled={syncing} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            Sync All
          </Button>
        )}
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Queue Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold">{queueItems.filter(i => i.status === 'pending').length}</p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-red-600">{queueItems.filter(i => i.status === 'failed').length}</p>
              <p className="text-sm text-muted-foreground">Failed</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">{queueItems.filter(i => i.status === 'syncing').length}</p>
              <p className="text-sm text-muted-foreground">Syncing</p>
            </div>
          </div>
          {queueItems.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearAll}
              className="w-full mt-4 gap-2 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Clear All
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Queue Items */}
      {queueItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2">All Synced!</h3>
            <p className="text-muted-foreground">
              No pending items in the queue. All your changes are synced.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {queueItems.map((item) => (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-muted text-muted-foreground">
                    {getIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-semibold truncate">{item.title}</h3>
                      {getStatusBadge(item.status)}
                    </div>
                    <p className="text-sm text-muted-foreground truncate mb-2">
                      {item.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(item.timestamp)}
                    </p>
                    {item.error && (
                      <div className="flex items-center gap-2 mt-2 text-xs text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        {item.error}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {item.status !== 'syncing' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => retryItem(item)}
                          className="gap-1"
                        >
                          <Upload className="h-3 w-3" />
                          Retry
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
