import { useParams } from "wouter";
import { useMemo } from "react";
import { SimpleStoryEditor } from "@/components/stories/SimpleStoryEditor";
import { useCampaignStore } from "@/lib/campaignStore";

export default function StoriesPage() {
  const { campaignId, storyId } = useParams();
  const selectedCampaign = useCampaignStore((state) => state.selectedCampaign);
  
  // Стабилизируем campaignId с приоритетом URL параметру
  const activeCampaignId = useMemo(() => {
    // URL параметр имеет приоритет и НЕ должен перезаписываться
    if (campaignId) {
      console.log('🌟 Using campaignId from URL:', campaignId);
      return campaignId;
    }
    
    const storeId = selectedCampaign?.id || "46868c44-c6a4-4bed-accf-9ad07bba790e";
    console.log('🌟 Using campaignId from store:', storeId);
    return storeId;
  }, [campaignId]); // Убираем selectedCampaign?.id из зависимостей!

  // Если storyId отсутствует, это новая Stories - очищаем состояние
  const cleanStoryId = storyId || undefined;

  return (
    <div className="min-h-screen">
      <div className="max-w-full mx-auto">
        <SimpleStoryEditor 
          storyId={cleanStoryId || 'new'}
        />
      </div>
    </div>
  );
}