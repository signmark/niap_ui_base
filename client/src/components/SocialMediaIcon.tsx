import React from 'react';
import { SocialPlatform } from '@/types';
import { SiInstagram, SiTelegram, SiVk, SiFacebook } from 'react-icons/si';

interface SocialMediaIconProps {
  platform: SocialPlatform;
  className?: string;
}

// Иконки социальных сетей для использования в разных компонентах
export default function SocialMediaIcon({ platform, className = 'h-4 w-4' }: SocialMediaIconProps) {
  // Цвета по умолчанию для каждой платформы
  const platformColors: Record<SocialPlatform, string> = {
    instagram: 'text-pink-600',
    telegram: 'text-blue-500',
    vk: 'text-blue-600',
    facebook: 'text-indigo-600'
  };
  
  // Компоненты иконок для каждой платформы
  const icons: Record<SocialPlatform, React.ElementType> = {
    instagram: SiInstagram,
    telegram: SiTelegram,
    vk: SiVk,
    facebook: SiFacebook
  };
  
  const Icon = icons[platform];
  const color = platformColors[platform];
  
  return <Icon className={`${className} ${color}`} />;
}