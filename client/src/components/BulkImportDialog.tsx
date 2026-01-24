import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Upload, Download, FileSpreadsheet, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: 'assets' | 'sites' | 'vendors';
  onSuccess?: () => void;
}

export function BulkImportDialog({ open, onOpenChange, entityType, onSuccess }: BulkImportDialogProps) {
  const [fileType, setFileType] = useState<'csv' | 'excel'>('excel');
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; imported: number; failed: number; errors: Array<{ row: number; error: string }> } | null>(null);

  const utils = trpc.useUtils();

  const entityLabels = {
    assets: 'Assets',
    sites: 'Sites',
    vendors: 'Vendors',
  };

  const downloadTemplateMutation = trpc[entityType].downloadTemplate.useQuery(
    { format: fileType },
    { enabled: false }
  );

  const bulkImportMutation = trpc[entityType].bulkImport.useMutation({
    onSuccess: (data) => {
      setResult(data);
      if (data.success) {
        toast.success(`Successfully imported ${data.imported} ${entityLabels[entityType].toLowerCase()}`);
        utils[entityType].list.invalidate();
        onSuccess?.();
      } else {
        toast.error(`Import completed with errors: ${data.failed} failed`);
      }
      setImporting(false);
    },
    onError: (error) => {
      toast.error(`Import failed: ${error.message}`);
      setImporting(false);
    },
  });

  const handleDownloadTemplate = async () => {
    try {
      const { data } = await downloadTemplateMutation.refetch();
      if (!data) return;

      const blob = fileType === 'csv'
        ? new Blob([data.template], { type: 'text/csv' })
        : new Blob([Uint8Array.from(atob(data.template), c => c.charCodeAt(0))], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${entityType}_template.${fileType === 'csv' ? 'csv' : 'xlsx'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Template downloaded successfully');
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      const extension = selectedFile.name.split('.').pop()?.toLowerCase();
      if (fileType === 'csv' && extension !== 'csv') {
        toast.error('Please select a CSV file');
        return;
      }
      if (fileType === 'excel' && !['xlsx', 'xls'].includes(extension || '')) {
        toast.error('Please select an Excel file (.xlsx or .xls)');
        return;
      }
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    setImporting(true);

    try {
      const fileContent = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (fileType === 'csv') {
            resolve(reader.result as string);
          } else {
            // For Excel, convert to base64
            const base64 = btoa(
              new Uint8Array(reader.result as ArrayBuffer).reduce(
                (data, byte) => data + String.fromCharCode(byte),
                ''
              )
            );
            resolve(base64);
          }
        };
        reader.onerror = reject;
        
        if (fileType === 'csv') {
          reader.readAsText(file);
        } else {
          reader.readAsArrayBuffer(file);
        }
      });

      bulkImportMutation.mutate({ fileContent, fileType });
    } catch (error) {
      toast.error('Failed to read file');
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Bulk Import {entityLabels[entityType]}</DialogTitle>
          <DialogDescription>
            Import multiple {entityLabels[entityType].toLowerCase()} from a CSV or Excel file
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* File Type Selection */}
          <div className="space-y-3">
            <Label>File Format</Label>
            <RadioGroup value={fileType} onValueChange={(value) => setFileType(value as 'csv' | 'excel')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="excel" id="excel" />
                <Label htmlFor="excel" className="flex items-center gap-2 cursor-pointer font-normal">
                  <FileSpreadsheet className="h-4 w-4 text-green-600" />
                  Excel (.xlsx, .xls)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="flex items-center gap-2 cursor-pointer font-normal">
                  <FileText className="h-4 w-4 text-blue-600" />
                  CSV (.csv)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Download Template */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm font-medium">Download Template</p>
              <p className="text-xs text-muted-foreground">
                Get a sample file with the correct format
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>

          {/* File Upload */}
          <div className="space-y-3">
            <Label htmlFor="file-upload">Upload File</Label>
            <div className="flex items-center gap-3">
              <input
                id="file-upload"
                type="file"
                accept={fileType === 'csv' ? '.csv' : '.xlsx,.xls'}
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById('file-upload')?.click()}
                className="flex-1"
              >
                <Upload className="h-4 w-4 mr-2" />
                {file ? file.name : 'Choose File'}
              </Button>
            </div>
          </div>

          {/* Import Result */}
          {result && (
            <div className={`p-4 rounded-lg border ${result.success ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
              <div className="flex items-start gap-3">
                {result.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {result.success ? 'Import Successful' : 'Import Completed with Errors'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Imported: {result.imported} | Failed: {result.failed}
                  </p>
                  {result.errors.length > 0 && (
                    <div className="mt-3 space-y-1 max-h-32 overflow-y-auto">
                      {result.errors.slice(0, 5).map((error, idx) => (
                        <p key={idx} className="text-xs text-red-600">
                          Row {error.row}: {error.error}
                        </p>
                      ))}
                      {result.errors.length > 5 && (
                        <p className="text-xs text-muted-foreground">
                          ...and {result.errors.length - 5} more errors
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button onClick={handleImport} disabled={!file || importing}>
              {importing ? 'Importing...' : 'Import'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
