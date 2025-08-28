import { Button } from "@/components/ui/button";
import { Bell, Plus } from "lucide-react";
import { useLocation } from "wouter";

const pageNames = {
  "/": "Дашборд",
  "/campaigns": "Кампании",
  "/content-creator": "Создание контента",
  "/scheduler": "Планировщик",
  "/analytics": "Аналитика",
  "/trends": "Тренды",
  "/ai-generator": "AI Генератор",
  "/social-media": "Социальные сети",
};

const pageDescriptions = {
  "/": "Обзор ваших кампаний и контента",
  "/campaigns": "Управление кампаниями и проектами",
  "/content-creator": "Создание и редактирование контента",
  "/scheduler": "Планирование публикаций",
  "/analytics": "Анализ эффективности контента",
  "/trends": "Актуальные тренды и темы",
  "/ai-generator": "Генерация контента с помощью ИИ",
  "/social-media": "Настройки социальных сетей",
};

export default function Header() {
  const [location] = useLocation();
  
  const currentPageName = pageNames[location as keyof typeof pageNames] || "Страница";
  const currentPageDescription = pageDescriptions[location as keyof typeof pageDescriptions] || "";

  return (
    <header className="bg-card border-b border-border px-6 py-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground" data-testid="page-title">
            {currentPageName}
          </h1>
          <p className="text-muted-foreground" data-testid="page-description">
            {currentPageDescription}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            size="icon"
            className="relative"
            data-testid="button-notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full"></span>
          </Button>
          <Button data-testid="button-create-content">
            <Plus className="mr-2 h-4 w-4" />
            Создать контент
          </Button>
        </div>
      </div>
    </header>
  );
}
