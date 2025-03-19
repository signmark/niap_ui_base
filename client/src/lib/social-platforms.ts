import { SocialPlatform } from "@/types";

// Массив доступных социальных платформ для безопасного использования в коде
export const safeSocialPlatforms: SocialPlatform[] = [
  'instagram',
  'facebook',
  'telegram',
  'vk'
];

// Словарь с переводами названий платформ для отображения в UI
export const platformNames: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  telegram: 'Telegram',
  vk: 'ВКонтакте'
};

// Иконки для платформ (можно расширить при необходимости)
export const platformIcons: Record<SocialPlatform, string> = {
  instagram: 'instagram',
  facebook: 'facebook',
  telegram: 'send',
  vk: 'message-circle'
};

// Перечисление для удобства доступа к цветам платформ
export const platformColors: Record<SocialPlatform, string> = {
  instagram: 'bg-gradient-to-r from-purple-500 to-pink-500',
  facebook: 'bg-blue-600',
  telegram: 'bg-blue-400',
  vk: 'bg-blue-500'
};