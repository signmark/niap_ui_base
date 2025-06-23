import { useParams } from "wouter";
import StoryEditor from "@/components/stories/StoryEditor";
import { useCampaignStore } from "@/lib/campaignStore";

export default function StoriesPage() {
  const { campaignId } = useParams();
  const selectedCampaign = useCampaignStore((state) => state.selectedCampaign);
  
  // Получаем ID кампании из параметров URL или из глобального состояния
  const activeCampaignId = campaignId || selectedCampaign?.id || "46868c44-c6a4-4bed-accf-9ad07bba790e";

  return (
    <div className="min-h-screen">
      <div className="max-w-full mx-auto">
        <StoryEditor campaignId={activeCampaignId} />
      </div>
    </div>
  );
}