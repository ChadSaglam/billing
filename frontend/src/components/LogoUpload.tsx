import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Upload, Link, X } from 'lucide-react';
import { uploadLogo } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface LogoUploadProps {
  value: string | null;
  onChange: (url: string) => void;
}

export function LogoUpload({ value, onChange }: LogoUploadProps) {
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadMut = useMutation({
    mutationFn: uploadLogo,
    onSuccess: (data) => {
      onChange(data.logo_url);
      toast({ title: 'Logo uploaded successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to upload logo', variant: 'destructive' });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMut.mutate(file);
    }
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onChange(urlInput.trim());
      setUrlInput('');
    }
  };

  const handleClear = () => {
    onChange('');
  };

  const logoSrc = value
    ? value.startsWith('/')
      ? `${import.meta.env.VITE_API_URL || 'http://localhost:8001'}${value}`
      : value
    : null;

  return (
    <div className="space-y-3">
      <Label>Company Logo</Label>

      {/* Preview */}
      <div className="relative flex items-center justify-center rounded-lg border-2 border-dashed bg-muted/30 h-32 w-full overflow-hidden">
        {logoSrc ? (
          <>
            <img src={logoSrc} alt="Company logo" className="max-h-28 max-w-full object-contain" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-1 right-1 h-6 w-6"
              onClick={handleClear}
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">No logo set</span>
        )}
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === 'upload' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('upload')}
        >
          <Upload className="mr-2 h-4 w-4" />
          Upload File
        </Button>
        <Button
          type="button"
          variant={mode === 'url' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('url')}
        >
          <Link className="mr-2 h-4 w-4" />
          Enter URL
        </Button>
      </div>

      {mode === 'upload' ? (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploadMut.isPending}
            onClick={() => fileRef.current?.click()}
          >
            {uploadMut.isPending ? 'Uploading...' : 'Choose File'}
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            placeholder="https://example.com/logo.png"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="flex-1"
          />
          <Button type="button" size="sm" onClick={handleUrlSubmit} disabled={!urlInput.trim()}>
            Set
          </Button>
        </div>
      )}
    </div>
  );
}
