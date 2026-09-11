import { useState, useRef } from 'react';
import { Upload, Link, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getToken } from '@/lib/auth';
import { useT } from '@/lib/i18n';

interface LogoUploadProps {
  value: string | null;
  onChange: (url: string) => void;
}

export function LogoUpload({ value, onChange }: LogoUploadProps) {
  const { t } = useT();
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
        toast({ title: t('logo.uploaded') });
      } else {
        toast({ title: t('logo.uploadFailed'), variant: 'destructive' });
      }
    });

    xhr.addEventListener('error', () => {
      setUploading(false);
      setProgress(0);
      toast({ title: t('logo.uploadFailed'), variant: 'destructive' });
    });

    const baseUrl = import.meta.env.VITE_API_URL;
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
      ? `${import.meta.env.VITE_API_URL}${value}`
      : value
    : null;

  return (
    <div className="space-y-3">
      <Label id="logo-label">{t('logo.companyLogo')}</Label>

      <div className="relative flex items-center justify-center rounded-lg border-2 border-dashed bg-muted/30 h-32 w-full overflow-hidden">
        {logoSrc ? (
          <>
            <img src={logoSrc} alt="Company logo" className="max-h-28 max-w-full object-contain" />
            <Button
              type="button" variant="ghost" size="icon"
              className="absolute top-1 right-1 h-6 w-6"
              onClick={handleClear}
              aria-label={t('logo.remove')}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">{t('logo.none')}</span>
        )}
      </div>

      <div className="flex gap-2">
        <Button type="button" variant={mode === 'upload' ? 'default' : 'outline'} size="sm" onClick={() => setMode('upload')} aria-pressed={mode === 'upload'}>
          <Upload className="mr-2 h-4 w-4" aria-hidden="true" /> {t('logo.uploadFile')}
        </Button>
        <Button type="button" variant={mode === 'url' ? 'default' : 'outline'} size="sm" onClick={() => setMode('url')} aria-pressed={mode === 'url'}>
          <Link className="mr-2 h-4 w-4" aria-hidden="true" /> {t('logo.enterUrl')}
        </Button>
      </div>

      {mode === 'upload' ? (
        <div className="space-y-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} aria-labelledby="logo-label" tabIndex={-1} />
          <Button
            type="button" variant="outline" size="sm"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? t('logo.uploading') : <><Upload className="mr-2 h-4 w-4" aria-hidden="true" /> {t('logo.chooseFile')}</>}
          </Button>
          {uploading && (
            <div className="space-y-1">
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
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
            aria-label={t('logo.urlLabel')}
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="flex-1"
          />
          <Button type="button" size="sm" onClick={handleUrlSubmit} disabled={!urlInput.trim()}>
            {t('logo.set')}
          </Button>
        </div>
      )}
    </div>
  );
}