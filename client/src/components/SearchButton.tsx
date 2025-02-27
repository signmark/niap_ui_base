import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import { useStore } from "@/lib/store";
import { NewSourcesDialog } from "./NewSourcesDialog";

export function SearchButton({ campaignId, keywords }: { campaignId: string; keywords: string[] }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [sourcesData, setSourcesData] = useState(null);
  const { toast } = useToast();
  const { token } = useStore((state) => state);

  const handleSearch = async () => {
    if (!keywords.length) {
      toast({
        title: "Ошибка",
        description: "Добавьте ключевые слова для поиска",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      // Получаем токен напрямую из localStorage
      const token = localStorage.getItem('auth_token');

      if (!token) {
        throw new Error('Не найден токен авторизации');
      }

      const response = await fetch('/api/sources/collect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ keywords: keywords.map(k => k.keyword) }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to start source collection');
      }

      const data = await response.json();
      setSourcesData(data);
      setIsDialogOpen(true);

      // Refresh page after dialog close
      setTimeout(() => {
        window.location.reload();
      }, 10000);
    } catch (error) {
      //Improved error handling
      const errorMessage = error.message || "Не удалось запустить поиск";
      toast({
        title: "Ошибка",
        description: errorMessage,
        variant: "destructive"
      });
      console.error("Search error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button onClick={handleSearch} disabled={isLoading}>
      {isLoading ? (
        <>
          <Search className="animate-spin mr-2 h-4 w-4" />
          Поиск...
        </>
      ) : (
        <>
          <Search className="mr-2 h-4 w-4" />
          Искать упоминания
        </>
      )}
    </Button>
  );
}

export default SearchButton;