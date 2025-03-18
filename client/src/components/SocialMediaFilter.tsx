import React from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { SocialMediaIcon } from './SocialMediaIcon';
import { Badge } from '@/components/ui/badge';
import { Filter } from 'lucide-react';

export interface SocialMediaFilterProps {
  selectedPlatforms: string[];
  onChange: (platforms: string[]) => void;
  counts?: Record<string, number>;
}

export const SocialMediaFilter: React.FC<SocialMediaFilterProps> = ({ 
  selectedPlatforms, 
  onChange,
  counts = {}
}) => {
  // Поддерживаемые платформы
  const platforms = [
    { id: 'instagram', name: 'Instagram' },
    { id: 'telegram', name: 'Telegram' },
    { id: 'vk', name: 'ВКонтакте' },
    { id: 'facebook', name: 'Facebook' }
  ];

  return (
    <div className="flex flex-col space-y-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span>Фильтр по платформам</span>
      </div>
      <ToggleGroup type="multiple" value={selectedPlatforms} onValueChange={onChange}>
        {platforms.map(platform => (
          <ToggleGroupItem 
            key={platform.id} 
            value={platform.id}
            aria-label={`Фильтровать по ${platform.name}`}
            className="flex items-center gap-1"
          >
            <SocialMediaIcon platform={platform.id} className="h-4 w-4" />
            <span className="hidden sm:inline">{platform.name}</span>
            {counts[platform.id] && counts[platform.id] > 0 && (
              <Badge variant="outline" className="ml-1 text-xs">
                {counts[platform.id]}
              </Badge>
            )}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
};