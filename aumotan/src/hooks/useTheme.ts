import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('aumo-theme') as Theme) || 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const apply = (t: Theme) => {
      root.classList.remove('light', 'dark');
      if (t === 'system') {
        root.classList.add(media.matches? 'dark' : 'light');
      } else {
        root.classList.add(t);
      }
    };

    apply(theme);
    localStorage.setItem('aumo-theme', theme);

    const listener = () => theme === 'system' && apply('system');
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [theme]);

  return { theme, setTheme };
}