import React, { useEffect } from 'react';
import { useThemeStore } from '@/lib/themeStore';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { getCssVariables, colorMode } = useThemeStore();
  
  // Применяем переменные темы к документу при изменении темы
  useEffect(() => {
    const variables = getCssVariables();
    const root = document.documentElement;
    
    // Устанавливаем CSS-переменные
    Object.entries(variables).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    
    // Устанавливаем класс для темного режима
    if (colorMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [getCssVariables, colorMode]);
  
  return <>{children}</>;
}