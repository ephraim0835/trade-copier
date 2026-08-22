'use client';

import * as React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex bg-secondary/50 rounded-lg p-1 animate-pulse">
        <div className="w-8 h-8 rounded-md bg-secondary/80"></div>
        <div className="w-8 h-8 rounded-md"></div>
        <div className="w-8 h-8 rounded-md"></div>
      </div>
    );
  }

  return (
    <div className="flex bg-secondary/50 rounded-lg p-1 border border-border/50">
      <button
        onClick={() => setTheme('light')}
        className={`w-8 h-8 flex items-center justify-center rounded-md transition-all ${
          theme === 'light' 
            ? 'bg-card text-primary shadow-sm ring-1 ring-border' 
            : 'text-muted-foreground hover:text-foreground'
        }`}
        title="Light theme"
      >
        <Sun className="w-4 h-4" />
      </button>
      <button
        onClick={() => setTheme('system')}
        className={`w-8 h-8 flex items-center justify-center rounded-md transition-all ${
          theme === 'system' 
            ? 'bg-card text-primary shadow-sm ring-1 ring-border' 
            : 'text-muted-foreground hover:text-foreground'
        }`}
        title="System theme"
      >
        <Monitor className="w-4 h-4" />
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={`w-8 h-8 flex items-center justify-center rounded-md transition-all ${
          theme === 'dark' 
            ? 'bg-card text-primary shadow-sm ring-1 ring-border' 
            : 'text-muted-foreground hover:text-foreground'
        }`}
        title="Dark theme"
      >
        <Moon className="w-4 h-4" />
      </button>
    </div>
  );
}
