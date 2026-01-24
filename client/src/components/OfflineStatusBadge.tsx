import { Cloud, CloudOff, CheckCircle2 } from 'lucide-react';
import { Badge } from './ui/badge';

interface OfflineStatusBadgeProps {
  isCached?: boolean;
  isSynced?: boolean;
  size?: 'sm' | 'md';
}

export function OfflineStatusBadge({ 
  isCached = false, 
  isSynced = true,
  size = 'sm' 
}: OfflineStatusBadgeProps) {
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  
  // Online and synced
  if (!isCached && isSynced) {
    return (
      <Badge variant="outline" className="gap-1 bg-emerald-50 text-emerald-700 border-emerald-200">
        <Cloud className={iconSize} />
        <span className="text-xs">Synced</span>
      </Badge>
    );
  }
  
  // Cached (available offline)
  if (isCached && isSynced) {
    return (
      <Badge variant="outline" className="gap-1 bg-blue-50 text-blue-700 border-blue-200">
        <CheckCircle2 className={iconSize} />
        <span className="text-xs">Cached</span>
      </Badge>
    );
  }
  
  // Pending sync (modified offline)
  if (isCached && !isSynced) {
    return (
      <Badge variant="outline" className="gap-1 bg-orange-50 text-orange-700 border-orange-200">
        <CloudOff className={iconSize} />
        <span className="text-xs">Pending Sync</span>
      </Badge>
    );
  }
  
  return null;
}
