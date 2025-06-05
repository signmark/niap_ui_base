import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { LogOut, BarChart, FileText, Search, Menu, Calendar, TrendingUp, PenTool, Settings, Clock, Key, Users } from "lucide-react";
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
// Только в случае, если не работает основная проверка через is_smm_admin
const ADMIN_EMAILS = ["lbrspb@gmail.com", "lbr.spb@gmail.com"]; 

// ID администратора
const ADMIN_USER_ID = '53921f16-f51d-4591-80b9-8caa4fde4d13';

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSmmAdmin, setIsSmmAdmin] = useState<boolean>(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const token = useAuthStore((state) => state.token);
  const userId = useAuthStore((state) => state.userId);
  const setAuth = useAuthStore((state) => state.setAuth);
  const isAdmin = useAuthStore((state) => state.isAdmin);
  const checkIsAdmin = useAuthStore((state) => state.checkIsAdmin);
  const clearSelectedCampaign = useCampaignStore((state) => state.clearSelectedCampaign);
  
  // Используем хук проверки принадлежности кампании текущему пользователю
  useCampaignOwnershipCheck();

  // Здесь мы получаем информацию о пользователе и проверяем админ. права по is_smm_admin
  useEffect(() => {
    const fetchUserData = async () => {
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
        // User data retrieved
        
        if (data.user && data.user.email) {
          setUserEmail(data.user.email);
          
          // Основная проверка - через поле is_smm_admin
          const adminStatus = data.user.is_smm_admin === true || 
                           data.user.is_smm_admin === 1 || 
                           data.user.is_smm_admin === '1' || 
                           data.user.is_smm_admin === 'true';
          
          // Admin status checked
          setIsSmmAdmin(adminStatus);
          
          // Дополнительная проверка - через email
          const isAdminByEmail = ADMIN_EMAILS.includes(data.user.email);
          if (isAdminByEmail) {
            // User is admin by email verification
          }
        }
      } catch (error) {
        console.error('Ошибка при проверке администратора:', error);
      }
    };
    
    fetchUserData();
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
      // Redirecting to login page
      navigate("/auth/login");
    } else if (token) {
      // User authenticated with token
      
      // Если мы авторизованы и находимся на странице входа - перенаправляем на главную
      if (isLoginPage) {
        navigate("/campaigns");
      }
    }
  }, [token, location, navigate, setAuth]);
  
  // Вызываем проверку статуса администратора из store для совместимости
  useEffect(() => {
    if (token) {
      checkIsAdmin().catch(error => {
        console.error('Ошибка при проверке статуса администратора:', error);
      });
    }
  }, [token]);

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

  // Итоговый администраторский статус
  // Основная проверка - поле is_smm_admin, дополнительные - userId и email
  const userIsAdmin = isSmmAdmin || userId === ADMIN_USER_ID || (userEmail && ADMIN_EMAILS.includes(userEmail));

  const navItems = [
    { path: "/campaigns", label: "Кампании", icon: FileText },
    { path: "/keywords", label: "Ключевые слова", icon: Search },
    { path: "/trends", label: "Тренды", icon: TrendingUp },
    { path: "/content", label: "Контент", icon: PenTool },
    { path: "/publish/scheduled", label: "Запланированные", icon: Clock },
    { path: "/posts", label: "Публикации", icon: Calendar },
    { path: "/analytics", label: "Аналитика", icon: BarChart },
  ];

  // Layout render state tracked 

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
                  <>
                    <Button
                      variant="ghost"
                      className="w-full justify-start sidebar-item"
                      onClick={() => setIsSettingsOpen(true)}
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Настройки
                    </Button>
                    <Button
                      variant="ghost"
                      className={`w-full justify-start sidebar-item ${location === '/admin/global-api-keys' ? 'active' : ''}`}
                      onClick={() => handleNavigation('/admin/global-api-keys')}
                    >
                      <Key className="mr-2 h-4 w-4" />
                      Глобальные API ключи
                    </Button>
                    <Button
                      variant="ghost"
                      className={`w-full justify-start sidebar-item ${location === '/admin/users' ? 'active' : ''}`}
                      onClick={() => handleNavigation('/admin/users')}
                    >
                      <Users className="mr-2 h-4 w-4" />
                      Управление пользователями
                    </Button>
                  </>
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
                  <>
                    <Button
                      variant="ghost"
                      className="w-full justify-start sidebar-item"
                      onClick={() => setIsSettingsOpen(true)}
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Настройки
                    </Button>
                    <Button
                      variant="ghost"
                      className={`w-full justify-start sidebar-item ${location === '/admin/global-api-keys' ? 'active' : ''}`}
                      onClick={() => handleNavigation('/admin/global-api-keys')}
                    >
                      <Key className="mr-2 h-4 w-4" />
                      Глобальные API ключи
                    </Button>
                    <Button
                      variant="ghost"
                      className={`w-full justify-start sidebar-item ${location === '/admin/users' ? 'active' : ''}`}
                      onClick={() => handleNavigation('/admin/users')}
                    >
                      <Users className="mr-2 h-4 w-4" />
                      Управление пользователями
                    </Button>
                  </>
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
