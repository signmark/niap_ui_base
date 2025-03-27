import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useThemeStore } from '@/lib/themeStore';

export function ThemeSwitcher() {
  const { 
    colorMode, 
    setColorMode
  } = useThemeStore();
  
  const toggleColorMode = () => {
    setColorMode(colorMode === 'light' ? 'dark' : 'light');
  };
  
  return (
    <div className="flex items-center">
      {/* Переключатель темного/светлого режима */}
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={toggleColorMode}
        aria-label={colorMode === 'light' ? 'Включить темный режим' : 'Включить светлый режим'}
      >
        {colorMode === 'light' ? (
          <Sun className="h-5 w-5" />
        ) : (
          <Moon className="h-5 w-5" />
        )}
      </Button>
    </div>
  );
}