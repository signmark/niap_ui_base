import { useParams } from "wouter";
import { useMemo } from "react";
import StoryEditor from "@/components/stories/StoryEditor";
import { useCampaignStore } from "@/lib/campaignStore";

// ГЛОБАЛЬНЫЙ МЕМОИЗИРОВАННЫЙ КОМПОНЕНТ
const MemoizedStoryEditor = ({ campaignId, storyId }: { campaignId: string; storyId?: string }) => {
  return useMemo(() => (
    <StoryEditor 
      campaignId={campaignId} 
      storyId={storyId}
    />
  ), [campaignId, storyId]);
};

export default function StoriesPage() {
  const params = useParams();
  const { campaignId, storyId } = params;
  const selectedCampaign = useCampaignStore((state) => state.selectedCampaign);
  
  // СТАБИЛЬНЫЕ значения
  const activeCampaignId = useMemo(() => {
    return campaignId || selectedCampaign?.id || "46868c44-c6a4-4bed-accf-9ad07bba790e";
  }, [campaignId, selectedCampaign?.id]);

  return (
    <div className="min-h-screen">
      <div className="max-w-full mx-auto">
        <MemoizedStoryEditor 
          campaignId={activeCampaignId} 
          storyId={storyId}
        />
      </div>
    </div>
  );
}