import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { LogOut, BarChart, FileText, Search, Menu, Calendar, TrendingUp, PenTool, Settings, Clock } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { DIRECTUS_URL } from "@/lib/directus";
import { Dialog } from "@/components/ui/dialog";
import { SettingsDialog } from "@/components/SettingsDialog";
import { CampaignSelector } from "@/components/CampaignSelector";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const token = useAuthStore((state) => state.token);
  const setAuth = useAuthStore((state) => state.setAuth);

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
      // Очищаем все данные авторизации из localStorage
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_id');
      
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

  const navItems = [
    { path: "/campaigns", label: "Кампании", icon: FileText },
    { path: "/keywords", label: "Ключевые слова", icon: Search },
    { path: "/content", label: "Контент", icon: PenTool },
    { path: "/posts", label: "Публикации", icon: Calendar },
    { path: "/publish/scheduled", label: "Запланированные", icon: Clock },
    { path: "/trends", label: "Тренды", icon: TrendingUp },
    { path: "/analytics", label: "Аналитика", icon: BarChart },
  ];

  const renderNavItems = () => (
    <div className="space-y-1">
      {navItems.map(({ path, label, icon: Icon }) => (
        <Button
          key={path}
          variant={location === path ? "secondary" : "ghost"}
          className="w-full justify-start"
          onClick={() => handleNavigation(path)}
        >
          <Icon className="mr-2 h-4 w-4" />
          {label}
        </Button>
      ))}
      <Button
        variant="ghost"
        className="w-full justify-start"
        onClick={() => setIsSettingsOpen(true)}
      >
        <Settings className="mr-2 h-4 w-4" />
        Настройки
      </Button>
    </div>
  );

  return (
    <div className="flex h-screen">
      {/* Мобильное меню */}
      <div
        className={`lg:hidden fixed inset-y-0 left-0 z-[100] w-64 transform ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } transition-transform duration-300`}
      >
        <div className="h-full bg-background border-r">
          <div className="px-3 py-4">
            <h2 className="mb-6 px-4 text-lg font-semibold">SMM Manager</h2>
            {renderNavItems()}
          </div>
          <div className="mt-auto p-4">
            <Button
              variant="ghost"
              className="w-full justify-start"
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
        <div className="h-full bg-background border-r">
          <div className="px-3 py-4">
            <h2 className="mb-6 px-4 text-lg font-semibold">SMM Manager</h2>
            {renderNavItems()}
          </div>
          <div className="mt-auto p-4">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Выход
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="h-16 border-b flex items-center justify-between px-4 lg:px-8">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden mr-2"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              <Menu className="h-6 w-6" />
            </Button>
            {/* Исключаем отображение селектора на странице списка кампаний, где уже есть список */}
            {!location.startsWith('/campaigns') && <CampaignSelector persistSelection={true} />}
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
  );
}