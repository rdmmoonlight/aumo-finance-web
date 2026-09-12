import { IconSun, IconMoon, IconDeviceDesktop, IconCheck } from '@tabler/icons-react';
import { useTheme } from '@/hooks/useTheme';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  const options = [
    { id: 'light', label: 'Light', desc: 'Tampilan terang', icon: IconSun },
    { id: 'dark', label: 'Dark', desc: 'Mata gak perih', icon: IconMoon },
    { id: 'system', label: 'System', desc: 'Ngikutin OS', icon: IconDeviceDesktop },
  ] as const;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Manage your account and system preferences.
        </p>
      </div>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
          <CardDescription>
            Pilih tema Aumo Finance. Disimpan otomatis di local storage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={theme}
            onValueChange={(v) => setTheme(v as any)}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            {options.map((opt) => {
              const isActive = theme === opt.id;
              return (
                <Label
                  key={opt.id}
                  htmlFor={opt.id}
                  className={cn(
                    'relative flex flex-col rounded-xl border-2 p-4 cursor-pointer transition-all hover:bg-accent/50',
                    isActive? 'border-primary bg-primary/5' : 'border-muted bg-card'
                  )}
                >
                  <RadioGroupItem value={opt.id} id={opt.id} className="sr-only" />
                  <opt.icon size={20} className={cn('mb-3', isActive && 'text-primary')} />
                  <span className="font-medium text-sm">{opt.label}</span>
                  <span className="text-xs text-muted-foreground mt-1">{opt.desc}</span>

                  {isActive && (
                    <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary text-primary-foreground grid place-items-center">
                      <IconCheck size={12} stroke={3} />
                    </div>
                  )}
                </Label>
              );
            })}
          </RadioGroup>

          <div className="mt-6 rounded-lg bg-muted p-3 text- font-mono text-muted-foreground">
            current: <span className="text-foreground font-bold">{theme}</span> • html class: "
            {typeof document!== 'undefined' && document.documentElement.classList.contains('dark')? 'dark' : 'light'}"
          </div>
        </CardContent>
      </Card>
    </div>
  );
}