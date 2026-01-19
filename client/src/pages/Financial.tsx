import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, Plus } from "lucide-react";
import { toast } from "sonner";

export default function Financial() {
  const { data: transactions, isLoading } = trpc.financial.list.useQuery();

  if (isLoading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  const totalAmount = transactions?.reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold">Financial Tracking</h1><p className="text-muted-foreground mt-2">Monitor asset costs and expenses</p></div>
        <Button onClick={() => toast.info("Feature coming soon")}><Plus className="mr-2 h-4 w-4" />Add Transaction</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Total Expenses</CardTitle></CardHeader>
        <CardContent><div className="text-3xl font-bold">₦{totalAmount.toLocaleString()}</div></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Recent Transactions</CardTitle></CardHeader>
        <CardContent>
          {transactions && transactions.length > 0 ? (
            <div className="space-y-3">
              {transactions.slice(0, 20).map((t) => (
                <div key={t.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                  <div><p className="font-medium">{t.transactionType}</p><p className="text-sm text-muted-foreground">{new Date(t.transactionDate).toLocaleDateString()}</p></div>
                  <div className="text-right"><p className="font-bold">₦{parseFloat(t.amount).toLocaleString()}</p><p className="text-xs text-muted-foreground">{t.currency}</p></div>
                </div>
              ))}
            </div>
          ) : <p className="text-muted-foreground">No transactions found</p>}
        </CardContent>
      </Card>
    </div>
  );
}
