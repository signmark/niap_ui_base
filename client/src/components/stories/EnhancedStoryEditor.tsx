import React, { useState } from 'react';
import { useCampaignStore } from '@/lib/campaignStore';
import { useParams } from 'wouter';
import StoryModeSelector, { StoryMode } from './StoryModeSelector';
import SimpleStoryEditor from './SimpleStoryEditor';
import StoryEditor from './StoryEditor';

interface EnhancedStoryEditorProps {
  campaignId?: string;
  storyId?: string;
}

export default function EnhancedStoryEditor({ campaignId: propCampaignId, storyId: propStoryId }: EnhancedStoryEditorProps) {
  const { campaignId: urlCampaignId, storyId } = useParams();
  const selectedCampaign = useCampaignStore((state) => state.selectedCampaign);
  
  // Определяем активный campaignId с приоритетом URL параметру
  const activeCampaignId = propCampaignId || urlCampaignId || selectedCampaign?.id || "46868c44-c6a4-4bed-accf-9ad07bba790e";
  const activeStoryId = propStoryId || storyId;

  const [selectedMode, setSelectedMode] = useState<StoryMode | null>(null);

  // Если режим не выбран, показываем селектор
  if (!selectedMode) {
    return (
      <StoryModeSelector 
        onModeSelect={setSelectedMode}
      />
    );
  }

  // Функция для возврата к селектору режимов
  const handleBack = () => {
    setSelectedMode(null);
  };

  // Рендерим соответствующий редактор
  if (selectedMode === 'simple') {
    return (
      <SimpleStoryEditor 
        campaignId={activeCampaignId}
        onBack={handleBack}
      />
    );
  }

  if (selectedMode === 'advanced') {
    return (
      <StoryEditor 
        campaignId={activeCampaignId}
        storyId={activeStoryId}
      />
    );
  }

  return null;
}