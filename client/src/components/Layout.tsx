import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { LogOut, BarChart, FileText, Search, Menu, Calendar, TrendingUp } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { DIRECTUS_URL } from "@/lib/directus";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const token = useAuthStore((state) => state.token);
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => {
    if (!token) {
      navigate("/auth/login");
    }
  }, [token, navigate]);

  const handleLogout = async () => {
    try {
      await fetch(`${DIRECTUS_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setAuth(null, null);
    }
  };

  const handleNavigation = (path: string) => {
    setIsSidebarOpen(false);
    navigate(path);
  };

  if (!token) return null;

  const navItems = [
    { path: "/campaigns", label: "Campaigns", icon: FileText },
    { path: "/keywords", label: "Keywords", icon: Search },
    { path: "/posts", label: "Posts", icon: Calendar },
    { path: "/trends", label: "Trends", icon: TrendingUp },
    { path: "/analytics", label: "Analytics", icon: BarChart },
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
              Logout
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
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="h-16 border-b flex items-center px-4 lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <Menu className="h-6 w-6" />
          </Button>
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
    </div>
  );
}