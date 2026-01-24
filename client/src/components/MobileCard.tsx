import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReactNode } from "react";

interface MobileCardField {
  label: string;
  value: ReactNode;
  fullWidth?: boolean;
}

interface MobileCardProps {
  title: string;
  subtitle?: string;
  badge?: {
    text: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
    className?: string;
  };
  fields: MobileCardField[];
  actions?: ReactNode;
  onClick?: () => void;
}

/**
 * Mobile-optimized card component for displaying table data
 * Replaces traditional tables on small screens
 */
export function MobileCard({
  title,
  subtitle,
  badge,
  fields,
  actions,
  onClick,
}: MobileCardProps) {
  return (
    <Card 
      className={`${onClick ? 'cursor-pointer hover:bg-accent/50 transition-colors' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Header with title and badge */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base truncate">{title}</h3>
            {subtitle && (
              <p className="text-sm text-muted-foreground truncate mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          {badge && (
            <Badge variant={badge.variant} className={badge.className}>
              {badge.text}
            </Badge>
          )}
        </div>

        {/* Fields in grid layout */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {fields.map((field, index) => (
            <div 
              key={index} 
              className={field.fullWidth ? 'col-span-2' : 'col-span-1'}
            >
              <dt className="text-muted-foreground text-xs mb-0.5">
                {field.label}
              </dt>
              <dd className="font-medium truncate">
                {field.value}
              </dd>
            </div>
          ))}
        </div>

        {/* Actions */}
        {actions && (
          <div className="flex gap-2 mt-4 pt-3 border-t">
            {actions}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Container for mobile cards with proper spacing
 */
export function MobileCardList({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-3">
      {children}
    </div>
  );
}
