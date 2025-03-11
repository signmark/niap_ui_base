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
  const { toast } = useToast();

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
            <div className="flex items-center">
              <svg 
                className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24"
              >
                <circle 
                  className="opacity-25" 
                  cx="12" 
                  cy="12" 
                  r="10" 
                  stroke="currentColor" 
                  strokeWidth="4"
                />
                <path 
                  className="opacity-75" 
                  fill="currentColor" 
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Поиск источников...</span>
            </div>
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