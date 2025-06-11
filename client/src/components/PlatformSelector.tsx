import React from 'react';
import { SafeSocialPlatform } from '@/lib/social-platforms';
import { SiInstagram, SiTelegram, SiVk, SiFacebook } from 'react-icons/si';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface PlatformSelectorProps {
  selectedPlatforms: Record<string, boolean>;
  onChange: (platform: SafeSocialPlatform, isSelected: boolean) => void;
}

export default function PlatformSelector({
  selectedPlatforms,
  onChange
}: PlatformSelectorProps) {
  const platforms = [
    {
      id: 'instagram' as SafeSocialPlatform,
      name: 'Instagram',
      icon: SiInstagram,
      color: 'text-pink-600'
    },
    {
      id: 'telegram' as SafeSocialPlatform,
      name: 'Telegram',
      icon: SiTelegram,
      color: 'text-blue-500'
    },
    {
      id: 'vk' as SafeSocialPlatform,
      name: 'ВКонтакте',
      icon: SiVk,
      color: 'text-blue-600'
    },
    {
      id: 'facebook' as SafeSocialPlatform,
      name: 'Facebook',
      icon: SiFacebook,
      color: 'text-indigo-600'
    }
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {platforms.map((platform) => {
        const isSelected = selectedPlatforms[platform.id] || false;
        
        return (
          <div 
            key={platform.id}
            className={`flex items-center gap-2 p-3 border rounded-md ${
              isSelected ? 'border-primary bg-primary/5' : 'border-input'
            }`}
          >
            <Checkbox
              id={`platform-${platform.id}`}
              checked={isSelected}
              onCheckedChange={(checked) => {
                onChange(platform.id, checked === true);
              }}
            />
            <Label 
              htmlFor={`platform-${platform.id}`}
              className="flex items-center gap-2 cursor-pointer"
            >
              <platform.icon className={`h-5 w-5 ${platform.color}`} />
              <span>{platform.name}</span>
            </Label>
          </div>
        );
      })}
    </div>
  );
}