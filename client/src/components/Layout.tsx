import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { LogOut, BarChart, FileText, Search, Menu, Calendar, TrendingUp, PenTool, Settings, Clock } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { useCampaignStore } from "@/lib/campaignStore";
import { DIRECTUS_URL } from "@/lib/directus";
import { Dialog } from "@/components/ui/dialog";
import { SettingsDialog } from "@/components/SettingsDialog";
import { CampaignSelector } from "@/components/CampaignSelector";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { SmmLogo } from "./SmmLogo";
import useCampaignOwnershipCheck from "@/hooks/useCampaignOwnershipCheck";

// Проверка наличия администраторских прав у пользователя по email
const ADMIN_EMAILS = ["lbrspb@gmail.com", "lbr.spb@gmail.com"]; 

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [forceAdminStatus, setForceAdminStatus] = useState(false);
  const token = useAuthStore((state) => state.token);
  const userId = useAuthStore((state) => state.userId);
  const setAuth = useAuthStore((state) => state.setAuth);
  const isAdmin = useAuthStore((state) => state.isAdmin);
  const checkIsAdmin = useAuthStore((state) => state.checkIsAdmin);
  const clearSelectedCampaign = useCampaignStore((state) => state.clearSelectedCampaign);
  
  // Используем хук проверки принадлежности кампании текущему пользователю
  useCampaignOwnershipCheck();

  // Здесь мы проверяем администраторские права на основе email
  useEffect(() => {
    // Проверяем email из localStorage или делаем запрос
    const checkEmailAndSetAdminStatus = async () => {
      try {
        if (!token) return;
        
        // Получаем данные пользователя с сервера
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache',
          },
        });
        
        if (!response.ok) {
          console.error('Ошибка при получении данных пользователя:', response.status);
          return;
        }
        
        const data = await response.json();
        console.log('Получены данные пользователя:', data);
        
        // Проверяем, есть ли email в списке администраторов
        if (data.user && data.user.email && ADMIN_EMAILS.includes(data.user.email)) {
          console.log('Пользователь является администратором по email:', data.user.email);
          setForceAdminStatus(true);
        }
      } catch (error) {
        console.error('Ошибка при проверке email для администратора:', error);
      }
    };
    
    checkEmailAndSetAdminStatus();
  }, [token]);

  useEffect(() => {
    // Проверяем, находимся ли мы на странице входа
    const isLoginPage = location === '/auth/login';
    
    // Пытаемся восстановить сессию из localStorage
    const storedToken = localStorage.getItem('auth_token');
    const storedUserId = localStorage.getItem('user_id');
    
    if (!token && storedToken && storedUserId) {
      console.log('Восстанавливаем сессию из localStorage');
      setAuth(storedToken, storedUserId);
      return;
    }
    
    // Если нет токена и мы не на странице входа - перенаправляем
    if (!token && !isLoginPage) {
      console.log('Токен авторизации не найден, перенаправляем на страницу входа');
      navigate("/auth/login");
    } else if (token) {
      console.log('Авторизован с токеном, длина:', token.length);
      
      // Если мы авторизованы и находимся на странице входа - перенаправляем на главную
      if (isLoginPage) {
        navigate("/campaigns");
      }
    }
  }, [token, location, navigate, setAuth]);
  
  // Проверяем статус администратора при входе в систему
  useEffect(() => {
    if (token) {
      // Проверяем права администратора
      console.log('Layout компонент: Запускаем проверку статуса администратора');
      console.log('Layout компонент: Текущий статус isAdmin =', isAdmin);
      checkIsAdmin().then(result => {
        console.log('Layout компонент: Результат проверки isAdmin =', result);
        console.log('Layout компонент: Текущее состояние isAdmin в store =', isAdmin);
      }).catch(error => {
        console.error('Layout компонент: Ошибка при проверке статуса администратора:', error);
      });
    }
  }, [token]);

  // Отображаем статус администратора в консоли
  useEffect(() => {
    console.log('Layout компонент: Изменение статуса isAdmin =', isAdmin);
  }, [isAdmin]);

  const handleLogout = async () => {
    try {
      console.log('Attempting to logout...');
      const response = await fetch(`${DIRECTUS_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      if (!response.ok) {
        throw new Error('Logout request failed');
      }

      console.log('Logout successful, clearing auth state');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Очищаем выбранную кампанию при выходе из системы
      console.log('Очищаем выбранную кампанию при выходе');
      clearSelectedCampaign();
      
      // Очищаем все данные авторизации из localStorage
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_id');
      localStorage.removeItem('is_admin'); // Очищаем статус админа при выходе
      
      // Очищаем состояние авторизации в store
      setAuth(null, null);
      
      console.log('Session cleared, redirecting to login page');
      // Перенаправляем на страницу входа
      navigate("/auth/login");
    }
  };

  const handleNavigation = (path: string) => {
    setIsSidebarOpen(false);
    navigate(path);
  };

  if (!token) return null;

  // Определяем итоговый администраторский статус
  // здесь мы разрешаем нашим ADMIN_EMAILS быть админами даже если исходная проверка не сработала
  const userIsAdmin = isAdmin || forceAdminStatus || (userId && ADMIN_EMAILS.includes('lbrspb@gmail.com'));

  const navItems = [
    { path: "/campaigns", label: "Кампании", icon: FileText },
    { path: "/keywords", label: "Ключевые слова", icon: Search },
    { path: "/trends", label: "Тренды", icon: TrendingUp },
    { path: "/content", label: "Контент", icon: PenTool },
    { path: "/publish/scheduled", label: "Запланированные", icon: Clock },
    { path: "/posts", label: "Публикации", icon: Calendar },
    { path: "/analytics", label: "Аналитика", icon: BarChart },
  ];

  console.log('Layout рендер: isAdmin =', isAdmin, 'forceAdminStatus =', forceAdminStatus, 'userIsAdmin =', userIsAdmin); 

  return (
    <ThemeProvider>
      <div className="flex h-screen">
        {/* Мобильное меню */}
        <div
          className={`lg:hidden fixed inset-y-0 left-0 z-[100] w-64 transform ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } transition-transform duration-300`}
        >
          <div className="h-full sidebar border-r">
            <div className="px-3 py-4">
              <div className="mb-6 px-4 sidebar-title text-center">
                <img src="/images/smm-logo.png" alt="SMM Manager Logo" className="h-auto w-[160px] mx-auto pt-1 pb-1" />
              </div>
              <div className="space-y-1">
                {navItems.map(({ path, label, icon: Icon }) => (
                  <Button
                    key={path}
                    variant="ghost"
                    className={`w-full justify-start sidebar-item ${location === path ? 'active' : ''}`}
                    onClick={() => handleNavigation(path)}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {label}
                  </Button>
                ))}
                {userIsAdmin && (
                  <Button
                    variant="ghost"
                    className="w-full justify-start sidebar-item"
                    onClick={() => setIsSettingsOpen(true)}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Настройки
                  </Button>
                )}
              </div>
            </div>
            <div className="mt-auto p-4">
              <Button
                variant="ghost"
                className="w-full justify-start sidebar-item"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Выход
              </Button>
            </div>
          </div>
        </div>

        {/* Десктопное меню */}
        <div className="hidden lg:block w-64">
          <div className="h-full sidebar border-r">
            <div className="px-3 py-4">
              <div className="mb-6 px-4 sidebar-title text-center">
                <img src="/images/smm-logo.png" alt="SMM Manager Logo" className="h-auto w-[160px] mx-auto pt-1 pb-1" />
              </div>
              <div className="space-y-1">
                {navItems.map(({ path, label, icon: Icon }) => (
                  <Button
                    key={path}
                    variant="ghost"
                    className={`w-full justify-start sidebar-item ${location === path ? 'active' : ''}`}
                    onClick={() => handleNavigation(path)}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {label}
                  </Button>
                ))}
                {userIsAdmin && (
                  <Button
                    variant="ghost"
                    className="w-full justify-start sidebar-item"
                    onClick={() => setIsSettingsOpen(true)}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Настройки
                  </Button>
                )}
              </div>
            </div>
            <div className="mt-auto p-4">
              <Button
                variant="ghost"
                className="w-full justify-start sidebar-item"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Выход
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <div className="h-16 border-b flex items-center justify-between px-4 lg:px-8 topbar">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden mr-2"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              >
                <Menu className="h-6 w-6" />
              </Button>
              {/* Отображаем название кампании в верхней панели, кроме страницы списка кампаний */}
              {location === '/campaigns' ? (
                <span className="text-lg font-medium topbar-title">Список кампаний</span>
              ) : (
                <CampaignSelector persistSelection={true} />
              )}
            </div>
            
            {/* Добавляем переключатель темы в правую часть топ-бара */}
            <div className="flex items-center">
              <ThemeSwitcher />
              {/* Для отладки: отображаем статус админа */}
              <span className="ml-2 text-xs opacity-50">Admin: {userIsAdmin ? 'Yes' : 'No'}</span>
            </div>
          </div>
          <main className="flex-1 p-4 lg:p-8">{children}</main>
        </div>

        {/* Оверлей для мобильного меню */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 lg:hidden z-40"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        
        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <SettingsDialog />
        </Dialog>
      </div>
    </ThemeProvider>
  );
}
