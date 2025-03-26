import React, { useState } from 'react';
import { Sun, Moon, Palette, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { useThemeStore } from '@/lib/themeStore';
import { cn } from '@/lib/utils';

export function ThemeSwitcher() {
  const { 
    colorMode, 
    sidebarTheme, 
    topbarTheme, 
    setColorMode, 
    setSidebarTheme, 
    setTopbarTheme,
    resetToDefault
  } = useThemeStore();
  
  const [open, setOpen] = useState(false);
  
  const toggleColorMode = () => {
    setColorMode(colorMode === 'light' ? 'dark' : 'light');
  };
  
  return (
    <div className="flex items-center space-x-2">
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
      
      {/* Выпадающее меню выбора цветовой схемы */}
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Выбрать цветовую схему">
            <Palette className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Цветовая схема</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <DropdownMenuItem 
            className="flex items-center justify-center py-2 mt-1 mb-2"
            onClick={() => resetToDefault()}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            <span>Вернуть стандартную тему</span>
          </DropdownMenuItem>
          
          <DropdownMenuLabel className="text-xs font-normal opacity-60">Боковая панель</DropdownMenuLabel>
          <div className="grid grid-cols-3 gap-1 p-1">
            {['default', 'blue', 'green', 'purple'].map((theme) => (
              <div 
                key={`sidebar-${theme}`}
                className={cn(
                  "w-full h-8 rounded-md cursor-pointer flex items-center justify-center",
                  {
                    "border-2 border-primary": sidebarTheme === theme,
                  }
                )}
                style={{ 
                  backgroundColor: getThemePreviewColor(theme, 'sidebar'),
                  color: '#fff'
                }}
                onClick={() => {
                  setSidebarTheme(theme as any);
                }}
              >
                {getThemeLabel(theme)}
              </div>
            ))}
          </div>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuLabel className="text-xs font-normal opacity-60">Верхняя панель</DropdownMenuLabel>
          <div className="grid grid-cols-3 gap-1 p-1">
            {['default', 'light', 'accent', 'colored'].map((theme) => (
              <div 
                key={`topbar-${theme}`}
                className={cn(
                  "w-full h-8 rounded-md cursor-pointer flex items-center justify-center",
                  {
                    "border-2 border-primary": topbarTheme === theme,
                    "text-black": theme === 'light' || theme === 'default',
                    "text-white": theme !== 'light' && theme !== 'default',
                  }
                )}
                style={{ 
                  backgroundColor: getThemePreviewColor(theme, 'topbar', 
                    getThemePreviewColor(sidebarTheme, 'sidebar'))
                }}
                onClick={() => {
                  setTopbarTheme(theme as any);
                }}
              >
                {getThemeLabel(theme)}
              </div>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// Вспомогательные функции
function getThemeLabel(theme: string): string {
  switch (theme) {
    case 'default': return 'Стд';
    case 'blue': return 'Синий';
    case 'green': return 'Зеленый';
    case 'purple': return 'Фиолет';
    case 'light': return 'Светлая';
    case 'accent': return 'Акцент';
    case 'colored': return 'Цветная';
    default: return theme;
  }
}

function getThemePreviewColor(theme: string, type: 'sidebar' | 'topbar', sidebarColor?: string): string {
  if (type === 'sidebar') {
    switch (theme) {
      case 'default': return '#000000'; // Черно-белая тема
      case 'blue': return '#1e3a8a';
      case 'green': return '#065f46';
      case 'purple': return '#701a75';
      default: return '#1e3a8a';
    }
  } else {
    switch (theme) {
      case 'default': return '#f0f0f0'; // Черно-белая тема
      case 'light': return '#f1f5f9';
      case 'accent': 
        // Акцентный цвет от цвета боковой панели
        switch (sidebarColor) {
          case '#000000': return '#444444'; // Для черно-белой темы
          case '#1e3a8a': return '#60a5fa';
          case '#065f46': return '#10b981';
          case '#701a75': return '#a855f7';
          default: return '#60a5fa';
        }
      case 'colored':
        // Более светлый оттенок цвета боковой панели
        switch (sidebarColor) {
          case '#000000': return '#333333'; // Для черно-белой темы
          case '#1e3a8a': return '#3b82f6';
          case '#065f46': return '#10b981';
          case '#701a75': return '#c026d3';
          default: return '#3b82f6';
        }
      default: return '#f1f5f9';
    }
  }
}