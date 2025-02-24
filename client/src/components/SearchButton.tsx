import { useState } from "react";
import { Button } from "./ui/button";
import { Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { directusApi } from "@/lib/directus";

export function SearchButton({ campaignId, keywords }: { campaignId: string; keywords: string[] }) {
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  const handleSearch = async () => {
    setIsSearching(true);
    try {
      await directusApi.post("/api/search", { keywords });
      toast({ description: "Поиск запущен" });

      // Обновление через 10 секунд
      setTimeout(() => {
        directusApi.get(`/items/campaign_links?filter[campaign_id][_eq]=${campaignId}`)
          .then(() => toast({ description: "Поиск завершен" }));
      }, 10000);
    } catch (error) {
      toast({ description: "Ошибка при запуске поиска", variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <Button 
      onClick={handleSearch} 
      disabled={isSearching || !keywords.length}
      className="w-full"
    >
      <Search className="mr-2 h-4 w-4" />
      {isSearching ? "Поиск..." : "Искать упоминания"}
    </Button>
  );
}