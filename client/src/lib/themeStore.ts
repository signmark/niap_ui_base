import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Типы для цветовых тем
export type ColorMode = 'light' | 'dark';

// Интерфейс для хранилища тем
interface ThemeState {
  // Основной режим (светлый/темный)
  colorMode: ColorMode;
  
  // Методы изменения состояния
  setColorMode: (mode: ColorMode) => void;
  
  // Сбросить на дефолтные настройки
  resetToDefault: () => void;
  
  // Генерация CSS переменных для текущей темы
  getCssVariables: () => Record<string, string>;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      // Начальные значения
      colorMode: 'light' as ColorMode,
      
      // Методы изменения
      setColorMode: (mode: ColorMode) => set({ colorMode: mode }),
      
      // Сброс к дефолтным настройкам
      resetToDefault: () => set({ 
        colorMode: 'light' as ColorMode
      }),
      
      // Получение CSS переменных для темы
      getCssVariables: () => {
        const { colorMode } = get();
        const variables: Record<string, string> = {};
        
        // Определение основных цветов в зависимости от цветового режима
        if (colorMode === 'light') {
          // Светлая тема
          variables['--background'] = '#ffffff';
          variables['--foreground'] = '#000000';
          variables['--card'] = '#ffffff';
          variables['--card-foreground'] = '#000000';
          variables['--muted'] = '#f1f5f9';
          variables['--muted-foreground'] = '#64748b';
          
          // Боковая панель в светлой теме (белая)
          variables['--sidebar-bg'] = '#ffffff';
          variables['--sidebar-fg'] = '#000000';
          variables['--sidebar-accent'] = '#e0e0e0';
          variables['--sidebar-accent-fg'] = '#000000';
          variables['--sidebar-border'] = '#dddddd';
          
          // Верхняя панель в светлой теме (светло-серая)
          variables['--topbar-bg'] = '#f0f0f0';
          variables['--topbar-fg'] = '#000000';
          variables['--topbar-border'] = '#cccccc';
        } else {
          // Темная тема (с темно-синим оттенком, как на скриншотах)
          variables['--background'] = '#1a202c';
          variables['--foreground'] = '#ffffff';
          variables['--card'] = '#252d3d';
          variables['--card-foreground'] = '#ffffff';
          variables['--muted'] = '#2d3748';
          variables['--muted-foreground'] = '#a0aec0';
          
          // Боковая панель в темной теме (темно-синяя)
          variables['--sidebar-bg'] = '#111827';
          variables['--sidebar-fg'] = '#ffffff';
          variables['--sidebar-accent'] = '#2d3748';
          variables['--sidebar-accent-fg'] = '#ffffff';
          variables['--sidebar-border'] = '#1e293b';
          
          // Верхняя панель в темной теме (темно-синяя)
          variables['--topbar-bg'] = '#111827';
          variables['--topbar-fg'] = '#ffffff';
          variables['--topbar-border'] = '#1e293b';
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