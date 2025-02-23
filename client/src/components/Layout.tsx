import { Sidebar, SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { LogOut, BarChart, FileText, Search } from "lucide-react";
import { logout } from "@/lib/directus";
import { useAuthStore } from "@/lib/store";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const { isAuthenticated, setAuth } = useAuthStore();

  if (!isAuthenticated) {
    navigate("/login");
    return null;
  }

  const handleLogout = async () => {
    await logout();
    setAuth(null, null);
    navigate("/login");
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <Sidebar className="w-64 border-r">
          <div className="px-3 py-4">
            <h2 className="mb-6 px-4 text-lg font-semibold">SEO Manager</h2>
            <div className="space-y-1">
              <Button
                variant={location === "/campaigns" ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => navigate("/campaigns")}
              >
                <FileText className="mr-2 h-4 w-4" />
                Campaigns
              </Button>
              <Button
                variant={location === "/keywords" ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => navigate("/keywords")}
              >
                <Search className="mr-2 h-4 w-4" />
                Keywords
              </Button>
              <Button
                variant={location === "/analytics" ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => navigate("/analytics")}
              >
                <BarChart className="mr-2 h-4 w-4" />
                Analytics
              </Button>
            </div>
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
        </Sidebar>
        <main className="flex-1 overflow-auto p-8">{children}</main>
      </div>
    </SidebarProvider>
  );
}