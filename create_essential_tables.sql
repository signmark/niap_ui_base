-- Создание всех основных таблиц для системы
-- user_campaigns, global_api_keys, campaign_content, user_api_keys и другие

-- 1. Таблица кампаний пользователей
CREATE TABLE IF NOT EXISTS user_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    link TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    trend_analysis_settings JSONB DEFAULT '{}',
    social_media_settings JSONB DEFAULT '{}'
);

-- Индексы для user_campaigns
CREATE INDEX IF NOT EXISTS idx_user_campaigns_user_id ON user_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_user_campaigns_created_at ON user_campaigns(created_at);

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_user_campaigns_updated_at ON user_campaigns;
CREATE TRIGGER update_user_campaigns_updated_at
    BEFORE UPDATE ON user_campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Комментарии для user_campaigns
COMMENT ON TABLE user_campaigns IS 'Кампании пользователей';
COMMENT ON COLUMN user_campaigns.id IS 'ID';
COMMENT ON COLUMN user_campaigns.user_id IS 'Пользователь';
COMMENT ON COLUMN user_campaigns.name IS 'Название кампании';
COMMENT ON COLUMN user_campaigns.link IS 'Ссылка';
COMMENT ON COLUMN user_campaigns.description IS 'Описание';
COMMENT ON COLUMN user_campaigns.created_at IS 'Создано';
COMMENT ON COLUMN user_campaigns.updated_at IS 'Обновлено';
COMMENT ON COLUMN user_campaigns.trend_analysis_settings IS 'Настройки анализа трендов';
COMMENT ON COLUMN user_campaigns.social_media_settings IS 'Настройки соцсетей';

-- 2. Таблица глобальных API ключей
CREATE TABLE IF NOT EXISTS global_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR(100) NOT NULL UNIQUE,
    api_key TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    description TEXT
);

-- Индексы для global_api_keys
CREATE INDEX IF NOT EXISTS idx_global_api_keys_service ON global_api_keys(service_name);
CREATE INDEX IF NOT EXISTS idx_global_api_keys_active ON global_api_keys(is_active);

-- Комментарии для global_api_keys
COMMENT ON TABLE global_api_keys IS 'Глобальные API ключи для AI сервисов';
COMMENT ON COLUMN global_api_keys.id IS 'ID';
COMMENT ON COLUMN global_api_keys.service_name IS 'Сервис';
COMMENT ON COLUMN global_api_keys.api_key IS 'API Ключ';
COMMENT ON COLUMN global_api_keys.is_active IS 'Активен';
COMMENT ON COLUMN global_api_keys.description IS 'Описание';

-- Базовые данные для global_api_keys (если не существуют)
INSERT INTO global_api_keys (service_name, api_key, is_active, description) 
SELECT * FROM (VALUES
    ('gemini', 'your_gemini_key_here', true, 'Google Gemini API'),
    ('claude', 'your_claude_key_here', true, 'Anthropic Claude API'),
    ('deepseek', 'your_deepseek_key_here', true, 'DeepSeek API'),
    ('qwen', 'your_qwen_key_here', true, 'Qwen API'),
    ('fal_ai', 'your_fal_ai_key_here', true, 'FAL AI API')
) AS t(service_name, api_key, is_active, description)
WHERE NOT EXISTS (SELECT 1 FROM global_api_keys WHERE global_api_keys.service_name = t.service_name);

-- Проверка результатов
SELECT 'user_campaigns' as table_name, COUNT(*) as records FROM user_campaigns
UNION ALL
SELECT 'global_api_keys' as table_name, COUNT(*) as records FROM global_api_keys;