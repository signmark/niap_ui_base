import { useParams } from "wouter";
import { useMemo } from "react";
import StoryEditor from "@/components/stories/StoryEditor";
import { useCampaignStore } from "@/lib/campaignStore";

export default function StoriesPage() {
  const params = useParams();
  const { campaignId, storyId } = params;
  const selectedCampaign = useCampaignStore((state) => state.selectedCampaign);
  
  // Стабилизируем campaignId с приоритетом URL параметру
  const activeCampaignId = useMemo(() => {
    if (campaignId) {
      return campaignId;
    }
    return selectedCampaign?.id || "46868c44-c6a4-4bed-accf-9ad07bba790e";
  }, [campaignId, selectedCampaign?.id]);

  // Стабильные пропы для редактора

  return (
    <div className="min-h-screen">
      <div className="max-w-full mx-auto">
        <StoryEditor 
          key="story-editor-stable"
          campaignId={activeCampaignId} 
          storyId={storyId}
        />
      </div>
    </div>
  );
}