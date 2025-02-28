import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { directusApi } from "@/lib/directus";

interface SearchButtonProps {
  campaignId: string;
  keywords: Array<{ keyword: string }>;
}

export function SearchButton({ campaignId, keywords }: SearchButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [sourcesData, setSourcesData] = useState(null);
  const toast = useToast();

  const handleSearch = async () => {
    if (!keywords.length) {
      toast.add({
        title: "Ошибка",
        description: "Добавьте ключевые слова для поиска",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
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
      if (error instanceof Error) {
        toast.add({
          title: "Ошибка",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast.add({
          title: "Ошибка",
          description: "Не удалось запустить поиск",
          variant: "destructive"
        });
      }
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