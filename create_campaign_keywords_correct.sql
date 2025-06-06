-- Создание правильной таблицы Campaign Keywords
-- На основе структуры из Directus админки

DROP TABLE IF EXISTS campaign_keywords CASCADE;

CREATE TABLE campaign_keywords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL,
    keyword TEXT NOT NULL,
    trend_score DECIMAL(5,2) DEFAULT 0.0,
    mentions_count INTEGER DEFAULT 0,
    last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_campaign_keywords_campaign_id ON campaign_keywords(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_keywords_keyword ON campaign_keywords(keyword);
CREATE INDEX IF NOT EXISTS idx_campaign_keywords_trend_score ON campaign_keywords(trend_score);
CREATE INDEX IF NOT EXISTS idx_campaign_keywords_last_checked ON campaign_keywords(last_checked);

-- Комментарии для Directus интерфейса
COMMENT ON TABLE campaign_keywords IS 'Ключевые слова кампаний';
COMMENT ON COLUMN campaign_keywords.id IS 'ID';
COMMENT ON COLUMN campaign_keywords.campaign_id IS 'Кампания';
COMMENT ON COLUMN campaign_keywords.keyword IS 'Ключевое слово';
COMMENT ON COLUMN campaign_keywords.trend_score IS 'Оценка тренда';
COMMENT ON COLUMN campaign_keywords.mentions_count IS 'Количество упоминаний';
COMMENT ON COLUMN campaign_keywords.last_checked IS 'Последняя проверка';
COMMENT ON COLUMN campaign_keywords.date_created IS 'Дата создания';

-- Проверка результата
SELECT 'campaign_keywords' as table_name, COUNT(*) as records FROM campaign_keywords;