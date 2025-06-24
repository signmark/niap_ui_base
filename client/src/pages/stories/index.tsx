import { useParams } from "wouter";
import { useMemo, useCallback } from "react";
import StoryEditor from "@/components/stories/StoryEditor";
import { useCampaignStore } from "@/lib/campaignStore";

export default function StoriesPage() {
  const params = useParams();
  const { campaignId, storyId } = params;
  const selectedCampaign = useCampaignStore((state) => state.selectedCampaign);
  
  // КРИТИЧНО: стабильные значения без пересоздания
  const activeCampaignId = useMemo(() => {
    return campaignId || selectedCampaign?.id || "46868c44-c6a4-4bed-accf-9ad07bba790e";
  }, [campaignId, selectedCampaign?.id]);

  // СТАБИЛЬНЫЙ КОМПОНЕНТ без перемонтирования
  const storyEditor = useMemo(() => (
    <StoryEditor 
      campaignId={activeCampaignId} 
      storyId={storyId}
    />
  ), [activeCampaignId, storyId]);

  return (
    <div className="min-h-screen">
      <div className="max-w-full mx-auto">
        {storyEditor}
      </div>
    </div>
  );
}