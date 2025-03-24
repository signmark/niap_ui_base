-- =======================================
-- Скрипты для обслуживания базы данных
-- =======================================

-- =======================================
-- 1. ПОИСК И УДАЛЕНИЕ ПОСТОВ БЕЗ SOCIAL_PLATFORMS
-- =======================================

-- Найти все посты без social_platforms или с пустым social_platforms
SELECT id, title, scheduled_at 
FROM campaign_content
WHERE social_platforms IS NULL 
   OR social_platforms = '{}'::jsonb;

-- Удаление постов без social_platforms
-- ВНИМАНИЕ: Этот запрос удаляет данные! Сначала выполните SELECT, чтобы проверить, какие записи будут удалены
DELETE FROM campaign_content
WHERE id IN (
  SELECT id 
  FROM campaign_content
  WHERE social_platforms IS NULL 
     OR social_platforms = '{}'::jsonb
);

-- =======================================
-- 2. ПОИСК И УДАЛЕНИЕ ДУБЛИКАТОВ
-- =======================================

-- Найти дубликаты постов на одну и ту же дату
WITH grouped_posts AS (
  SELECT 
    id, 
    title, 
    scheduled_at, 
    created_at,
    ROW_NUMBER() OVER (PARTITION BY DATE(scheduled_at) ORDER BY created_at) as row_num
  FROM campaign_content
  WHERE scheduled_at IS NOT NULL
    AND campaign_id = '46868c44-c6a4-4bed-accf-9ad07bba790e'
)
SELECT id, title, scheduled_at
FROM grouped_posts
WHERE row_num > 1;

-- Удаление дубликатов на одну дату (кроме самого старого поста)
-- ВНИМАНИЕ: Этот запрос удаляет данные!
DELETE FROM campaign_content
WHERE id IN (
  WITH grouped_posts AS (
    SELECT 
      id, 
      scheduled_at, 
      created_at,
      ROW_NUMBER() OVER (PARTITION BY DATE(scheduled_at) ORDER BY created_at) as row_num
    FROM campaign_content
    WHERE scheduled_at IS NOT NULL
      AND campaign_id = '46868c44-c6a4-4bed-accf-9ad07bba790e'
  )
  SELECT id
  FROM grouped_posts
  WHERE row_num > 1
);

-- =======================================
-- 3. ПРОВЕРКА КОЛИЧЕСТВА ПОСТОВ
-- =======================================

-- Общее количество постов для данной кампании
SELECT COUNT(*) FROM campaign_content WHERE campaign_id = '46868c44-c6a4-4bed-accf-9ad07bba790e';

-- Количество постов без social_platforms
SELECT COUNT(*) FROM campaign_content 
WHERE (social_platforms IS NULL OR social_platforms = '{}'::jsonb)
AND campaign_id = '46868c44-c6a4-4bed-accf-9ad07bba790e';

-- Количество дубликатов
WITH grouped_posts AS (
  SELECT 
    id, 
    scheduled_at,
    ROW_NUMBER() OVER (PARTITION BY DATE(scheduled_at) ORDER BY created_at) as row_num
  FROM campaign_content
  WHERE scheduled_at IS NOT NULL
    AND campaign_id = '46868c44-c6a4-4bed-accf-9ad07bba790e'
)
SELECT COUNT(*) 
FROM grouped_posts
WHERE row_num > 1;

-- =======================================
-- 4. РЕЗЕРВНОЕ КОПИРОВАНИЕ И ВОССТАНОВЛЕНИЕ
-- =======================================

-- Создание резервной копии таблицы
CREATE TABLE campaign_content_backup AS 
SELECT * FROM campaign_content 
WHERE campaign_id = '46868c44-c6a4-4bed-accf-9ad07bba790e';

-- Восстановление из резервной копии
INSERT INTO campaign_content 
SELECT * FROM campaign_content_backup;

-- Удаление резервной копии
DROP TABLE campaign_content_backup;

-- =======================================
-- 5. СОЗДАНИЕ ТАБЛИЦ ПРОЕКТА
-- =======================================

-- Создание таблицы кампаний пользователей
CREATE TABLE IF NOT EXISTS user_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  user_id UUID NOT NULL,
  trend_analysis_settings JSONB DEFAULT '{}',
  social_media_settings JSONB DEFAULT '{}'
);

-- Создание таблицы контента кампаний
CREATE TABLE IF NOT EXISTS campaign_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  image_url TEXT,
  keywords TEXT[],
  status VARCHAR(50) DEFAULT 'draft',
  campaign_id UUID NOT NULL REFERENCES user_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  social_platforms JSONB DEFAULT '{}',
  visibility VARCHAR(50) DEFAULT 'published'
);

-- Создание таблицы источников контента
CREATE TABLE IF NOT EXISTS content_sources (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  source_type VARCHAR(50) NOT NULL,
  platform VARCHAR(50),
  followers_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  user_id UUID NOT NULL,
  campaign_id UUID REFERENCES user_campaigns(id) ON DELETE CASCADE
);

-- Создание таблицы трендовых тем
CREATE TABLE IF NOT EXISTS trend_topics (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  source_id INTEGER REFERENCES content_sources(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  trend_score FLOAT DEFAULT 0,
  mentions_count INTEGER DEFAULT 0,
  campaign_id INTEGER REFERENCES user_campaigns(id) ON DELETE CASCADE
);

-- Создание таблицы трендовых тем кампаний
CREATE TABLE IF NOT EXISTS campaign_trend_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  source_post JSONB,
  source_url TEXT,
  source_platform VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  trend_score FLOAT DEFAULT 0,
  mentions_count INTEGER DEFAULT 0,
  is_bookmarked BOOLEAN DEFAULT FALSE,
  campaign_id UUID REFERENCES user_campaigns(id) ON DELETE CASCADE
);

-- Создание таблицы бизнес-опросника
CREATE TABLE IF NOT EXISTS business_questionnaire (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID UNIQUE REFERENCES user_campaigns(id) ON DELETE CASCADE,
  business_name VARCHAR(255),
  business_description TEXT,
  business_goals TEXT[],
  target_audience JSONB DEFAULT '{}',
  competitors TEXT[],
  keywords TEXT[],
  tone_of_voice TEXT,
  content_preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Создание таблицы API ключей кампаний (вместо ключей пользователей)
CREATE TABLE IF NOT EXISTS campaign_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES user_campaigns(id) ON DELETE CASCADE,
  service_name VARCHAR(50) NOT NULL,
  api_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  CONSTRAINT unique_campaign_service UNIQUE (campaign_id, service_name)
);

-- Миграция данных из старой таблицы пользовательских API ключей (если она существует)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_api_keys') THEN
        INSERT INTO campaign_api_keys (campaign_id, service_name, api_key, created_at, updated_at, is_active)
        SELECT 
            c.id AS campaign_id,
            k.service_name,
            k.api_key,
            k.created_at,
            k.updated_at,
            k.is_active
        FROM user_api_keys k
        JOIN user_campaigns c ON k.user_id = c.user_id
        ON CONFLICT (campaign_id, service_name) DO NOTHING;
        
        -- Удаление старой таблицы после миграции
        -- DROP TABLE user_api_keys;
    END IF;
END $$;

-- =======================================
-- 6. ИНДЕКСЫ ДЛЯ ОПТИМИЗАЦИИ ЗАПРОСОВ
-- =======================================

-- Индекс для запросов по дате публикации
CREATE INDEX IF NOT EXISTS idx_campaign_content_scheduled_at 
ON campaign_content(scheduled_at);

-- Индекс для запросов по кампании и статусу
CREATE INDEX IF NOT EXISTS idx_campaign_content_campaign_status 
ON campaign_content(campaign_id, status);

-- Индекс для запросов по пользователю
CREATE INDEX IF NOT EXISTS idx_campaign_content_user_id 
ON campaign_content(user_id);

-- Индекс для запросов по кампании в трендовых темах
CREATE INDEX IF NOT EXISTS idx_campaign_trend_topics_campaign_id 
ON campaign_trend_topics(campaign_id);

-- Индекс для эффективного поиска закладок
CREATE INDEX IF NOT EXISTS idx_campaign_trend_topics_is_bookmarked 
ON campaign_trend_topics(is_bookmarked);

-- Индекс для быстрого поиска API ключей по кампании
CREATE INDEX IF NOT EXISTS idx_campaign_api_keys_campaign_id
ON campaign_api_keys(campaign_id);

-- Индекс для поиска API ключей по сервису
CREATE INDEX IF NOT EXISTS idx_campaign_api_keys_service_name
ON campaign_api_keys(service_name);