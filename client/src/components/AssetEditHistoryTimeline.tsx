import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, User, Edit } from "lucide-react";
import { format } from "date-fns";

interface AssetEditHistoryTimelineProps {
  assetId: number;
}

export function AssetEditHistoryTimeline({ assetId }: AssetEditHistoryTimelineProps) {
  const { data: history, isLoading } = trpc.assets.getEditHistory.useQuery({ assetId });

  const formatFieldName = (field: string) => {
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Edit History
          </CardTitle>
          <CardDescription>Loading edit history...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!history || history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Edit History
          </CardTitle>
          <CardDescription>No edit history available</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No changes have been made to this asset yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Edit className="h-5 w-5" />
          Edit History
        </CardTitle>
        <CardDescription>
          Track all changes made to this asset
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {history.map((entry, index) => (
            <div
              key={entry.id}
              className={`relative pl-8 pb-4 ${
                index !== history.length - 1 ? 'border-l-2 border-muted ml-2' : ''
              }`}
            >
              <div className="absolute left-0 top-0 -ml-2 h-4 w-4 rounded-full bg-primary" />
              
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {formatFieldName(entry.fieldName)}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">Previous Value</p>
                        <p className="font-mono text-xs bg-muted px-2 py-1 rounded">
                          {entry.oldValue || <span className="italic text-muted-foreground">empty</span>}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">New Value</p>
                        <p className="font-mono text-xs bg-muted px-2 py-1 rounded">
                          {entry.newValue || <span className="italic text-muted-foreground">empty</span>}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span>{entry.userName || 'Unknown User'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{format(new Date(entry.changedAt), 'PPp')}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
