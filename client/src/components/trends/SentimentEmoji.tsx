interface SentimentEmojiProps {
  sentimentAnalysis?: string;
  className?: string;
}

export function SentimentEmoji({ sentimentAnalysis, className = "" }: SentimentEmojiProps) {
  const getSentimentEmoji = (sentimentAnalysis?: string): string => {
    if (!sentimentAnalysis) return "❓";
    
    const text = sentimentAnalysis.toLowerCase();
    
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
    
    return "❓";
  };

  const getSentimentTitle = (sentimentAnalysis?: string): string => {
    const emoji = getSentimentEmoji(sentimentAnalysis);
    
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
      title={getSentimentTitle(sentimentAnalysis)}
    >
      {getSentimentEmoji(sentimentAnalysis)}
    </span>
  );
}