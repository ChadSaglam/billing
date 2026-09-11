import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { login, register } from '@/lib/api';
import { setToken } from '@/lib/auth';
import { getApiErrorMessage } from '@/lib/errors';
import { useT } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function Login() {
  const navigate = useNavigate();
  const { t } = useT();
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    company_name: '',
  });

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = isRegister
        ? await register(form)
        : await login({ email: form.email, password: form.password });

      setToken(result.access_token);
      navigate('/');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, t('auth.genericError')));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 gap-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">🧾 {t('common.appName')}</CardTitle>
          <CardDescription>
            {isRegister ? t('auth.createAccountDesc') : t('auth.signInDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="full_name">{t('auth.fullName')}</Label>
                  <Input
                    id="full_name"
                    value={form.full_name}
                    onChange={(e) => update('full_name', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_name">{t('auth.companyName')}</Label>
                  <Input
                    id="company_name"
                    value={form.company_name}
                    onChange={(e) => update('company_name', e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                required
              />
            </div>

            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t('auth.pleaseWait') : isRegister ? t('auth.createAccount') : t('auth.signIn')}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {isRegister ? t('auth.haveAccount') : t('auth.noAccount')}{' '}
              <button
                type="button"
                className="text-primary underline"
                onClick={() => {
                  setIsRegister(!isRegister);
                  setError('');
                }}
              >
                {isRegister ? t('auth.signIn') : t('auth.register')}
              </button>
            </p>
          </form>
        </CardContent>
      </Card>
      <LanguageSwitcher />
    </div>
  );
}
