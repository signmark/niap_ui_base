import { Button } from "./ui/button";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2 } from "lucide-react";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";

interface SearchButtonProps {
  campaignId: string;
  selectedKeywords: string[];
}

export function SearchButton({ campaignId, selectedKeywords }: SearchButtonProps) {
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  const handleSearch = async () => {
    if (selectedKeywords.length === 0) {
      toast({
        title: "Внимание",
        description: "Выберите ключевые слова для поиска",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSearching(true);
      await apiRequest("POST", "/api/sources/collect", { keywords: selectedKeywords.map(kw => kw.keyword) });

      toast({
        title: "Поиск запущен",
        description: "Результаты будут доступны через несколько секунд"
      });

      // Обновление через 10 секунд
      setTimeout(() => {
        window.location.reload();
      }, 10000);
    } catch (error) {
      //Improved error handling
      const errorMessage = error.message.includes("API request failed") ? error.message : "Не удалось запустить поиск";
      toast({
        title: "Ошибка",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <Button onClick={handleSearch} disabled={isSearching}>
      {isSearching ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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

// Assuming this is in "@/lib/queryClient.ts" or a similar location.
export const apiRequest = async (method: string, url: string, body?: any) => {
  const token = localStorage.getItem('auth_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`API request failed with status ${response.status}: ${JSON.stringify(errorData)}`);
  }

  return response.json();
};