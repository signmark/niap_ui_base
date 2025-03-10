import { PostCalendar } from "@/components/PostCalendar";
import { useQuery } from "@tanstack/react-query";
import { useCampaignStore } from "@/lib/campaignStore";

export default function Posts() {
  // Используем глобальный стор выбранной кампании
  const { selectedCampaign } = useCampaignStore();

  return (
    <div className="space-y-4">
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold">Календарь публикаций</h1>
        <p className="text-muted-foreground mt-2">
          Управляйте публикациями для выбранной кампании
        </p>
      </div>

      {selectedCampaign ? (
        <PostCalendar campaignId={selectedCampaign.id} />
      ) : (
        <div className="text-center py-10 text-muted-foreground">
          Пожалуйста, выберите кампанию в селекторе сверху
        </div>
      )}
    </div>
  );
}