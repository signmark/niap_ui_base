interface SentimentEmojiProps {
  sentiment?: {
    sentiment?: string;
    score?: number;
    confidence?: number;
    [key: string]: any;
  } | string;
  className?: string;
}

export function SentimentEmoji({ sentiment, className = "" }: SentimentEmojiProps) {
  const getSentimentEmoji = (sentiment?: { sentiment?: string; score?: number } | string): string => {
    if (!sentiment) return "❓";
    
    // Если передан объект с анализом
    if (typeof sentiment === 'object' && sentiment.sentiment) {
      switch (sentiment.sentiment.toLowerCase()) {
        case 'positive':
          return "😊";
        case 'negative':
          return "😞";
        case 'neutral':
          return "😐";
        default:
          return "❓";
      }
    }
    
    // Если передана строка (старый формат)
    if (typeof sentiment === 'string') {
      const text = sentiment.toLowerCase();
      
      const positiveKeywords = [
        "положительн", "позитивн", "хорош", "отличн", "прекрасн", 
        "великолепн", "успешн", "выгодн", "перспективн", "многообещающ"
      ];
      
      const negativeKeywords = [
        "негативн", "отрицательн", "плох", "ужасн", "проблемн",
        "рискованн", "опасн", "неудачн"
      ];
      
      const neutralKeywords = [
        "нейтральн", "сбалансированн", "умеренн", "стабильн",
        "обычн", "средн", "стандартн"
      ];
      
      if (positiveKeywords.some(keyword => text.includes(keyword))) {
        return "😊";
      }
      
      if (negativeKeywords.some(keyword => text.includes(keyword))) {
        return "😞";
      }
      
      if (neutralKeywords.some(keyword => text.includes(keyword))) {
        return "😐";
      }
    }
    
    return "❓";
  };

  const getSentimentTitle = (sentiment?: { sentiment?: string; score?: number } | string): string => {
    const emoji = getSentimentEmoji(sentiment);
    
    switch (emoji) {
      case "😊":
        return "Позитивный тренд";
      case "😞":
        return "Негативный тренд";
      case "😐":
        return "Нейтральный тренд";
      default:
        return "Тональность не определена";
    }
  };

  return (
    <span 
      className={`text-lg select-none ${className}`}
      title={getSentimentTitle(sentiment)}
    >
      {getSentimentEmoji(sentiment)}
    </span>
  );
}