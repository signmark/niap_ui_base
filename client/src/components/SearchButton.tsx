import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog } from "@/components/ui/dialog";
import { NewSourcesDialog } from "@/components/NewSourcesDialog";

interface SearchButtonProps {
  campaignId: string;
  keywords: Array<{ keyword: string }>;
}

export function SearchButton({ campaignId, keywords }: SearchButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [sourcesData, setSourcesData] = useState(null);
  const { add: toast } = useToast();

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
      if (data?.success && data?.data?.sources) {
        setSourcesData(data);
        setIsDialogOpen(true);
      } else {
        throw new Error('Некорректный формат данных от сервера');
      }

    } catch (error) {
      if (error instanceof Error) {
        toast({
          title: "Ошибка",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
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
    <>
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        {sourcesData && (
          <NewSourcesDialog
            campaignId={campaignId}
            onClose={() => setIsDialogOpen(false)}
            sourcesData={sourcesData}
          />
        )}
      </Dialog>
    </>
  );
}

export default SearchButton;