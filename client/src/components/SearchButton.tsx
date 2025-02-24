
import { Button } from "./ui/button";
import { useToast } from "@/hooks/use-toast";
import { Search } from "lucide-react";
import { directusApi } from "@/lib/directus";
import { useState } from "react";

export default function SearchButton({ campaignId }: { campaignId: string }) {
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  const handleSearch = async () => {
    try {
      setIsSearching(true);
      const response = await directusApi.post("/items/search", {
        campaign_id: campaignId
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
      <Search className="mr-2 h-4 w-4" />
      {isSearching ? "Поиск..." : "Искать упоминания"}
    </Button>
  );
}
