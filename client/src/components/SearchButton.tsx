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
      await apiRequest("POST", "/api/perplexity/search", {
        keywords: selectedKeywords
      });

      toast({
        title: "Поиск запущен",
        description: "Результаты будут доступны через несколько секунд"
      });

      // Обновление через 10 секунд
      setTimeout(() => {
        window.location.reload();
      }, 10000);
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось запустить поиск",
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