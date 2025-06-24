import { useParams } from "wouter";
import { useMemo } from "react";
import StoryEditor from "@/components/stories/StoryEditor";
import { useCampaignStore } from "@/lib/campaignStore";

export default function StoriesPage() {
  const params = useParams();
  console.log('🌟🌟🌟 ALL PARAMS RECEIVED:', params);
  
  const { campaignId, storyId } = params;
  const selectedCampaign = useCampaignStore((state) => state.selectedCampaign);
  
  // КРИТИЧНО: Логирование для отладки
  console.log('🌟 EXTRACTED storyId:', storyId);
  console.log('🌟 EXTRACTED campaignId:', campaignId);
  console.log('🌟 URL pathname:', window.location.pathname);
  console.log('🌟 URL search:', window.location.search);
  
  // Стабилизируем campaignId с приоритетом URL параметру
  const activeCampaignId = useMemo(() => {
    if (campaignId) {
      console.log('🌟 Using campaignId from URL:', campaignId);
      return campaignId;
    }
    
    const storeId = selectedCampaign?.id || "46868c44-c6a4-4bed-accf-9ad07bba790e";
    console.log('🌟 Using campaignId from store:', storeId);
    return storeId;
  }, [campaignId]);

  // КРИТИЧНО: проверяем передачу storyId
  console.log('🌟🌟🌟 FINAL PROPS TO EDITOR:', { 
    storyId, 
    activeCampaignId,
    storyIdExists: !!storyId,
    storyIdType: typeof storyId
  });

  return (
    <div className="min-h-screen">
      <div className="max-w-full mx-auto">
        <StoryEditor 
          campaignId={activeCampaignId} 
          initialStoryId={storyId}
        />
      </div>
    </div>
  );
}