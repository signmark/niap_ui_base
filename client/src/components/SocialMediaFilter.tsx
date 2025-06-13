import React, { useState } from 'react';
import { SocialPlatform } from '@/types';
import { SiInstagram, SiTelegram, SiVk, SiFacebook } from 'react-icons/si';

interface SocialMediaFilterProps {
  platforms: string[];
  onPlatformChange: (selected: string[]) => void;
  availablePlatforms: string[];
  showCounts?: boolean;
  platformCounts?: Record<string, number>;
  className?: string;
}

export default function SocialMediaFilter({
  platforms,
  onPlatformChange,
  availablePlatforms,
  showCounts = false,
  platformCounts = {},
  className = ''
}: SocialMediaFilterProps) {
  const [selected, setSelected] = useState<string[]>(platforms);

  const platformOptions = [
    {
      id: 'instagram' as SocialPlatform,
      name: 'Instagram',
      icon: SiInstagram,
      color: 'text-pink-600',
      bgColor: 'bg-pink-100',
      count: platformCounts.instagram || 0
    },
    {
      id: 'telegram' as SocialPlatform,
      name: 'Telegram',
      icon: SiTelegram,
      color: 'text-blue-500',
      bgColor: 'bg-blue-100',
      count: platformCounts.telegram || 0
    },
    {
      id: 'vk' as SocialPlatform,
      name: 'ВКонтакте',
      icon: SiVk,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      count: platformCounts.vk || 0
    },
    {
      id: 'facebook' as SocialPlatform,
      name: 'Facebook',
      icon: SiFacebook,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
      count: platformCounts.facebook || 0
    }
  ];

  const handleToggle = (platform: string) => {
    const newSelected = selected.includes(platform)
      ? selected.filter(p => p !== platform)
      : [...selected, platform];
    
    setSelected(newSelected);
    onPlatformChange(newSelected);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="text-sm text-muted-foreground mb-2">
        Фильтр по платформам
      </div>
      
      <div className="flex flex-wrap gap-2">
        {platformOptions.filter(opt => availablePlatforms.includes(opt.id)).map(platform => (
          <button
            key={platform.id}
            onClick={() => handleToggle(platform.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md border transition-colors ${
              selected.includes(platform.id)
                ? `${platform.bgColor} ${platform.color} border-current`
                : 'bg-muted/40 text-muted-foreground border-transparent hover:bg-muted/60'
            }`}
          >
            <platform.icon className={`h-4 w-4 ${selected.includes(platform.id) ? platform.color : ''}`} />
            <span>{platform.name}</span>
            {showCounts && (
              <span className={`ml-1 inline-flex items-center justify-center rounded-full text-xs font-medium 
                ${selected.includes(platform.id) ? 'bg-white/80' : 'bg-muted-foreground/20'} 
                w-5 h-5`}
              >
                {platform.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}