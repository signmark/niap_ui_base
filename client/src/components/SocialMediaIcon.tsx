import React from 'react';
import { Instagram, MessageCircle, Facebook } from 'lucide-react';
import { SiVk } from 'react-icons/si';

export interface SocialMediaIconProps {
  platform: string;
  className?: string;
}

export const SocialMediaIcon: React.FC<SocialMediaIconProps> = ({ platform, className = 'h-5 w-5' }) => {
  switch (platform.toLowerCase()) {
    case 'instagram':
      return <Instagram className={className} />;
    case 'telegram':
      return <MessageCircle className={className} />;
    case 'facebook':
      return <Facebook className={className} />;
    case 'vk':
      return <SiVk className={className} />;
    default:
      return null;
  }
};