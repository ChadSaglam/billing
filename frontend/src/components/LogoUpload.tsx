import { useState, useRef } from 'react';
import { Upload, Link, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getToken } from '@/lib/auth';

interface LogoUploadProps {
  value: string | null;
  onChange: (url: string) => void;
}

export function LogoUpload({ value, onChange }: LogoUploadProps) {
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    setUploading(true);
    setProgress(0);

    xhr.upload.addEventListener('progress', (evt) => {
      if (evt.lengthComputable) {
        setProgress(Math.round((evt.loaded / evt.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      setUploading(false);
      setProgress(0);
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        onChange(data.logo_url);
        toast({ title: 'Logo uploaded successfully' });
      } else {
        toast({ title: 'Failed to upload logo', variant: 'destructive' });
      }
    });

    xhr.addEventListener('error', () => {
      setUploading(false);
      setProgress(0);
      toast({ title: 'Failed to upload logo', variant: 'destructive' });
    });

    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001';
    xhr.open('POST', `${baseUrl}/api/settings/logo`);
    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
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

      <div className="relative flex items-center justify-center rounded-lg border-2 border-dashed bg-muted/30 h-32 w-full overflow-hidden">
        {logoSrc ? (
          <>
            <img src={logoSrc} alt="Company logo" className="max-h-28 max-w-full object-contain" />
            <Button
              type="button" variant="ghost" size="icon"
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

      <div className="flex gap-2">
        <Button type="button" variant={mode === 'upload' ? 'default' : 'outline'} size="sm" onClick={() => setMode('upload')}>
          <Upload className="mr-2 h-4 w-4" /> Upload File
        </Button>
        <Button type="button" variant={mode === 'url' ? 'default' : 'outline'} size="sm" onClick={() => setMode('url')}>
          <Link className="mr-2 h-4 w-4" /> Enter URL
        </Button>
      </div>

      {mode === 'upload' ? (
        <div className="space-y-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <Button
            type="button" variant="outline" size="sm"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? 'Uploading…' : <><Upload className="mr-2 h-4 w-4" /> Choose File</>}
          </Button>
          {uploading && (
            <div className="space-y-1">
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-200 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{progress}%</p>
            </div>
          )}
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