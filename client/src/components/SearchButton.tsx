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
    setIsLoading(true);
    try {
      // Получаем токен из хранилища или из localStorage, если он не доступен в хранилище
      const authToken = token || localStorage.getItem('auth_token');

      if (!authToken) {
        throw new Error("Требуется авторизация. Пожалуйста, войдите в систему снова.");
      }

      const response = await fetch("/api/sources/collect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify({ keywords }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || "API request failed");
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