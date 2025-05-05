import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Функция для получения читаемого названия сервиса по его внутреннему идентификатору
export function getServiceDisplayName(serviceName: string): string {
  const serviceNames: Record<string, string> = {
    'perplexity': 'Perplexity',
    'apify': 'Apify',
    'deepseek': 'DeepSeek',
    'fal_ai': 'FAL.AI',
    'xmlriver': 'XMLRiver',
    'claude': 'Claude AI',
    'gemini': 'Google Gemini',
    'qwen': 'Alibaba Qwen',
    'social_searcher': 'Social Searcher'
  };
  
  return serviceNames[serviceName] || serviceName;
}
