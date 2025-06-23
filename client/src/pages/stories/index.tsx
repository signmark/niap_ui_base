import { useParams } from "wouter";
import { useMemo } from "react";
import StoryEditor from "@/components/stories/StoryEditor";
import { useCampaignStore } from "@/lib/campaignStore";

export default function StoriesPage() {
  const { campaignId } = useParams();
  const selectedCampaign = useCampaignStore((state) => state.selectedCampaign);
  
  // Стабилизируем campaignId чтобы избежать перемонтирования
  const activeCampaignId = useMemo(() => {
    const id = campaignId || selectedCampaign?.id || "46868c44-c6a4-4bed-accf-9ad07bba790e";
    console.log('🌟 StoriesPage stabilizing campaignId:', id);
    return id;
  }, [campaignId, selectedCampaign?.id]);

  return (
    <div className="min-h-screen">
      <div className="max-w-full mx-auto">
        <StoryEditor key="story-editor-stable" campaignId={activeCampaignId} />
      </div>
    </div>
  );
}