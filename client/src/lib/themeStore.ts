import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Типы для цветовых тем
export type ColorMode = 'light' | 'dark';
export type SidebarTheme = 'blue' | 'green' | 'purple';
export type TopbarTheme = 'light' | 'accent' | 'colored';

// Интерфейс для хранилища тем
interface ThemeState {
  // Основной режим (светлый/темный)
  colorMode: ColorMode;
  
  // Тема боковой панели
  sidebarTheme: SidebarTheme;
  
  // Тема верхней панели
  topbarTheme: TopbarTheme;
  
  // Методы изменения состояния
  setColorMode: (mode: ColorMode) => void;
  setSidebarTheme: (theme: SidebarTheme) => void;
  setTopbarTheme: (theme: TopbarTheme) => void;
  
  // Генерация CSS переменных для текущей темы
  getCssVariables: () => Record<string, string>;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      // Начальные значения
      colorMode: 'light',
      sidebarTheme: 'blue',
      topbarTheme: 'light',
      
      // Методы изменения
      setColorMode: (mode) => set({ colorMode: mode }),
      setSidebarTheme: (theme) => set({ sidebarTheme: theme }),
      setTopbarTheme: (theme) => set({ topbarTheme: theme }),
      
      // Получение CSS переменных для темы
      getCssVariables: () => {
        const { colorMode, sidebarTheme, topbarTheme } = get();
        const variables: Record<string, string> = {};
        
        // Определение основных цветов в зависимости от цветового режима
        if (colorMode === 'light') {
          variables['--background'] = '#ffffff';
          variables['--foreground'] = '#000000';
          variables['--card'] = '#ffffff';
          variables['--card-foreground'] = '#000000';
          variables['--muted'] = '#f1f5f9';
          variables['--muted-foreground'] = '#64748b';
        } else {
          variables['--background'] = '#121212';
          variables['--foreground'] = '#ffffff';
          variables['--card'] = '#1e1e1e';
          variables['--card-foreground'] = '#ffffff';
          variables['--muted'] = '#2d3748';
          variables['--muted-foreground'] = '#a0aec0';
        }
        
        // Цвета боковой панели
        switch (sidebarTheme) {
          case 'blue':
            variables['--sidebar-bg'] = colorMode === 'light' ? '#1e3a8a' : '#1e3a8a';
            variables['--sidebar-fg'] = '#ffffff';
            variables['--sidebar-accent'] = '#60a5fa';
            variables['--sidebar-accent-fg'] = '#ffffff';
            variables['--sidebar-border'] = colorMode === 'light' ? '#2563eb' : '#3b82f6';
            break;
          case 'green':
            variables['--sidebar-bg'] = colorMode === 'light' ? '#065f46' : '#064e3b';
            variables['--sidebar-fg'] = '#ffffff';
            variables['--sidebar-accent'] = '#10b981';
            variables['--sidebar-accent-fg'] = '#ffffff';
            variables['--sidebar-border'] = colorMode === 'light' ? '#059669' : '#10b981';
            break;
          case 'purple':
            variables['--sidebar-bg'] = colorMode === 'light' ? '#701a75' : '#581c87';
            variables['--sidebar-fg'] = '#ffffff';
            variables['--sidebar-accent'] = '#a855f7';
            variables['--sidebar-accent-fg'] = '#ffffff';
            variables['--sidebar-border'] = colorMode === 'light' ? '#7e22ce' : '#9333ea';
            break;
        }
        
        // Цвета верхней панели
        switch (topbarTheme) {
          case 'light':
            variables['--topbar-bg'] = colorMode === 'light' ? '#f1f5f9' : '#1e1e1e';
            variables['--topbar-fg'] = colorMode === 'light' ? '#0f172a' : '#f8fafc';
            variables['--topbar-border'] = colorMode === 'light' ? '#cbd5e1' : '#334155';
            break;
          case 'accent':
            // Использует акцентный цвет от боковой панели
            variables['--topbar-bg'] = colorMode === 'light' ? '#f8fafc' : '#1e1e1e';
            variables['--topbar-fg'] = variables['--sidebar-accent'];
            variables['--topbar-border'] = variables['--sidebar-accent'];
            break;
          case 'colored':
            // Использует основной цвет боковой панели, но в более светлом оттенке
            const baseColor = variables['--sidebar-bg'];
            variables['--topbar-bg'] = colorMode === 'light' 
              ? adjustBrightness(baseColor, 80) 
              : adjustBrightness(baseColor, 20);
            variables['--topbar-fg'] = colorMode === 'light' ? '#0f172a' : '#f8fafc';
            variables['--topbar-border'] = variables['--sidebar-bg'];
            break;
        }
        
        return variables;
      }
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// Вспомогательная функция для регулировки яркости цвета
function adjustBrightness(hexColor: string, percent: number): string {
  // Убираем # из начала строки, если она есть
  hexColor = hexColor.replace(/^#/, '');
  
  // Разбираем на RGB компоненты
  let r = parseInt(hexColor.substring(0, 2), 16);
  let g = parseInt(hexColor.substring(2, 4), 16);
  let b = parseInt(hexColor.substring(4, 6), 16);
  
  // Регулируем яркость
  r = Math.floor(r * (percent / 100));
  g = Math.floor(g * (percent / 100));
  b = Math.floor(b * (percent / 100));
  
  // Убеждаемся, что значения остаются в пределах 0-255
  r = Math.max(Math.min(255, r), 0);
  g = Math.max(Math.min(255, g), 0);
  b = Math.max(Math.min(255, b), 0);
  
  // Преобразуем назад в HEX строку
  return `#${(r.toString(16).padStart(2, '0'))}${(g.toString(16).padStart(2, '0'))}${(b.toString(16).padStart(2, '0'))}`;
}