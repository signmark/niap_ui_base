import React from 'react';
import { SiInstagram, SiTelegram, SiVk, SiFacebook } from 'react-icons/si';
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
  // Поддерживаемые платформы с иконками
  const platforms = [
    { id: 'instagram', name: 'Instagram', icon: SiInstagram, color: 'text-pink-600' },
    { id: 'telegram', name: 'Telegram', icon: SiTelegram, color: 'text-blue-500' },
    { id: 'vk', name: 'ВКонтакте', icon: SiVk, color: 'text-blue-600' },
    { id: 'facebook', name: 'Facebook', icon: SiFacebook, color: 'text-blue-700' }
  ];

  const togglePlatform = (platformId: string) => {
    if (selectedPlatforms.includes(platformId)) {
      onChange(selectedPlatforms.filter(id => id !== platformId));
    } else {
      onChange([...selectedPlatforms, platformId]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <Filter className="h-4 w-4" />
        <span>Фильтр по платформам</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {platforms.map(platform => {
          const Icon = platform.icon;
          const isSelected = selectedPlatforms.includes(platform.id);
          const count = counts[platform.id] || 0;
          
          return (
            <button
              key={platform.id}
              onClick={() => togglePlatform(platform.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors
                ${isSelected 
                  ? 'bg-primary/10 text-primary border border-primary/30' 
                  : 'bg-muted/50 text-muted-foreground border border-transparent hover:bg-muted'
                }`}
              aria-pressed={isSelected}
            >
              <Icon className={`h-4 w-4 ${platform.color}`} />
              <span>{platform.name}</span>
              {count > 0 && (
                <span className={`ml-1 text-xs rounded-full w-5 h-5 flex items-center justify-center
                  ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/30 text-muted-foreground'}
                `}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};