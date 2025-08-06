import React from 'react';
import { useParams } from 'wouter';
import SimpleStoriesEditor from '@/components/stories/SimpleStoriesEditor';
import { useCampaignStore } from '@/lib/campaignStore';

export default function NewStoriesEditorPage() {
  const { campaignId } = useParams();
  const selectedCampaign = useCampaignStore((state) => state.selectedCampaign);
  
  // Определяем активный campaignId
  const activeCampaignId = campaignId || selectedCampaign?.id;

  return (
    <div className="min-h-screen bg-gray-50">
      <SimpleStoriesEditor 
        campaignId={activeCampaignId}
        onSave={(storyData, imageDataUrl) => {
          console.log('Story сохранена:', storyData);
          console.log('Изображение готово для Instagram API');
        }}
      />
    </div>
  );
}