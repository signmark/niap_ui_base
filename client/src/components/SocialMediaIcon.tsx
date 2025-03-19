import React from 'react';
import { SocialPlatform } from '@/types';
import { SiInstagram, SiTelegram, SiVk, SiFacebook, SiYoutube } from 'react-icons/si';

interface SocialMediaIconProps {
  platform: SocialPlatform | string;
  className?: string;
  size?: number;
}

export default function SocialMediaIcon({ platform, className = 'h-4 w-4', size }: SocialMediaIconProps) {
  const style = size ? { width: size, height: size } : {};
  switch (platform) {
    case 'instagram':
      return <SiInstagram className={`text-pink-600 ${className}`} style={style} />;
    case 'telegram':
      return <SiTelegram className={`text-blue-500 ${className}`} style={style} />;
    case 'vk':
      return <SiVk className={`text-blue-600 ${className}`} style={style} />;
    case 'facebook':
      return <SiFacebook className={`text-indigo-600 ${className}`} style={style} />;
    case 'youtube':
      return <SiYoutube className={`text-red-600 ${className}`} style={style} />;
    default:
      return null;
  }
}