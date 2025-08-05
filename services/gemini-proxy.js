import * as logger from '../utils/logger';
import { SocksProxyAgent } from 'socks-proxy-agent';
import fetch from 'node-fetch';
import { vertexAIAuth } from './vertex-ai-auth';
/**
 * Реализация сервиса Gemini с поддержкой SOCKS5 прокси
 */
export class GeminiProxyService {
    /**
     * Определяет правильную версию API и URL для модели
     * @param model Название модели
     * @returns Объект с версией API и базовым URL
     */
    getApiVersionForModel(model) {
        // Gemini 2.5 модели требуют Vertex AI
        if (model === 'gemini-2.5-flash' || model === 'gemini-2.5-pro') {
            return {
                version: 'v1',
                baseUrl: vertexAIAuth.getVertexAIUrl(model),
                isVertexAI: true
            };
        }
        // Остальные модели используют стандартный Generative Language API
        return {
            version: 'v1beta',
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta'
        };
    }
    /**
     * Преобразует упрощенные названия моделей в правильные названия API
     * @param model Упрощенное название модели
     * @returns Правильное название для API
     */
    mapModelToApiName(model) {
        const modelMap = {
            // Gemini 2.5 модели используют правильные названия для Vertex AI (из документации)
            'gemini-2.5-flash': 'gemini-2.5-flash',
            'gemini-2.5-pro': 'gemini-2.5-pro',
            // Gemini 2.0 модели для стандартного API
            'gemini-2.0-flash': 'gemini-2.0-flash-exp',
            'gemini-2.0-flash-lite': 'gemini-2.0-flash-thinking-exp-1219',
            // Gemini 1.5 модели
            'gemini-1.5-flash': 'gemini-1.5-flash-latest',
            'gemini-1.5-pro': 'gemini-1.5-pro-latest'
        };
        return modelMap[model] || model;
    }
    /**
     * Создает новый экземпляр GeminiProxyService
     * @param options Опции для инициализации сервиса
     */
    constructor(options) {
        this.maxRetries = 3;
        this.apiKey = options.apiKey;
        // Настройки прокси по умолчанию (канадский прокси)
        const proxyHost = options.proxyHost || '138.219.123.68';
        const proxyPort = options.proxyPort || 9710;
        const proxyUsername = options.proxyUsername || 'PGjuJV';
        const proxyPassword = options.proxyPassword || 'cwZmJ3';
        // Формируем URL прокси с учетными данными
        this.proxyUrl = `socks5://${proxyUsername}:${proxyPassword}@${proxyHost}:${proxyPort}`;
        // Создаем прокси-агент
        try {
            // Проверяем, доступен ли SocksProxyAgent
            if (SocksProxyAgent) {
                this.agent = new SocksProxyAgent(this.proxyUrl);
                // Скрываем пароль из лога (для безопасности)
                const safeProxyUrl = this.proxyUrl.replace(/:[^:@]*@/, ':***@');
                logger.log(`[gemini-proxy] Инициализирован SOCKS5 прокси: ${safeProxyUrl}`, 'gemini');
            }
            else {
                logger.warn('[gemini-proxy] SOCKS5 прокси не используется, т.к. модуль socks-proxy-agent не установлен', 'gemini');
                this.agent = null;
            }
        }
        catch (error) {
            logger.error(`[gemini-proxy] Ошибка инициализации SOCKS5 прокси: ${error.message}`, 'gemini');
            this.agent = null;
            this.proxyUrl = null;
        }
    }
    /**
     * Отправляет запрос к Gemini API через SOCKS5 прокси
     * @param url URL для запроса
     * @param body Тело запроса
     * @param isVertexAI Использовать ли Vertex AI
     * @returns Ответ от API в виде JSON
     */
    async sendRequest(url, body, isVertexAI = false) {
        let retries = 0;
        let lastError = null;
        
        // Создаем базовые опции один раз для использования в fallback
        const baseFetchOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        };
        
        while (retries < this.maxRetries) {
            try {
                // Маскируем API ключ в URL для логов
                const safeUrl = url.replace(/key=[^&]+/, 'key=****');
                logger.log(`[gemini-proxy] Отправка запроса к: ${safeUrl}`, 'gemini');
                const fetchOptions = { ...baseFetchOptions };
                // Для Vertex AI используем Service Account авторизацию
                if (url.includes('aiplatform.googleapis.com')) {
                    logger.log(`[gemini-proxy] Используется Vertex AI, получаем Service Account токен`, 'gemini');
                    logger.log(`[gemini-proxy] Данные для Vertex AI: ${JSON.stringify(body, null, 2)}`, 'gemini');
                    const accessToken = await vertexAIAuth.getAccessToken();
                    if (accessToken) {
                        fetchOptions.headers = {
                            ...fetchOptions.headers,
                            'Authorization': `Bearer ${accessToken}`
                        };
                        logger.log(`[gemini-proxy] Service Account токен добавлен для Vertex AI`, 'gemini');
                    }
                    else {
                        throw new Error('Не удалось получить Service Account токен для Vertex AI');
                    }
                }
                // КРИТИЧЕСКИ ВАЖНО: Используем прокси для доступа к Gemini API во ВСЕХ средах
                // Прямое соединение к Gemini заблокировано по региону - нужен SOCKS5 прокси
                if (this.agent) {
                    // Используем прокси для ВСЕХ запросов (включая Vertex AI)
                    fetchOptions.agent = this.agent;
                    logger.log(`[gemini-proxy] Используется SOCKS5 прокси: ${this.proxyUrl?.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`, 'gemini');
                }
                else {
                    logger.warn(`[gemini-proxy] ⚠️ ПРОКСИ НЕДОСТУПЕН! Прямое соединение может не работать из-за региональных ограничений Gemini API`, 'gemini');
                }
                // Выполняем запрос
                const response = await fetch(url, fetchOptions);
                const status = response.status;
                logger.log(`[gemini-proxy] Получен ответ со статусом: ${status}`, 'gemini');
                if (status === 200) {
                    // Успешный ответ
                    const data = await response.json();
                    return data;
                }
                else {
                    // Обрабатываем ошибку
                    const errorText = await response.text();
                    throw new Error(`HTTP error ${status}: ${errorText}`);
                }
            }
            catch (error) {
                lastError = error;
                retries++;
                
                // Если ошибка подключения к прокси, попробуем без прокси на последней попытке
                if (retries === this.maxRetries && error.message.includes('ECONNREFUSED') && this.agent) {
                    logger.warn(`[gemini-proxy] ⚠️ SOCKS5 прокси недоступен. Пробуем прямое соединение как fallback...`, 'gemini');
                    try {
                        // Создаем новые опции без прокси для fallback
                        const fallbackOptions = { ...baseFetchOptions };
                        // НЕ добавляем agent (прокси) для прямого соединения
                        
                        const fallbackResponse = await fetch(url, fallbackOptions);
                        const status = fallbackResponse.status;
                        logger.log(`[gemini-proxy] Fallback ответ со статусом: ${status}`, 'gemini');
                        
                        if (status === 200) {
                            const data = await fallbackResponse.json();
                            logger.log(`[gemini-proxy] ✅ Fallback успешен - прямое соединение работает`, 'gemini');
                            return data;
                        } else {
                            const errorText = await fallbackResponse.text();
                            throw new Error(`HTTP error ${status}: ${errorText}`);
                        }
                    } catch (fallbackError) {
                        logger.error(`[gemini-proxy] ❌ Fallback также неудачен: ${fallbackError.message}`, 'gemini');
                        // Продолжаем к обычной обработке ошибки
                    }
                }
                
                if (retries < this.maxRetries) {
                    const backoffTime = Math.pow(2, retries) * 500; // Экспоненциальная задержка
                    logger.warn(`[gemini-proxy] Попытка ${retries} из ${this.maxRetries} не удалась. Повтор через ${backoffTime}ms. Ошибка: ${lastError.message}`, 'gemini');
                    await new Promise(resolve => setTimeout(resolve, backoffTime));
                }
            }
        }
        // Если все попытки неудачны
        throw new Error(`[gemini-proxy] Максимальное количество попыток исчерпано. Последняя ошибка: ${lastError?.message || 'Неизвестная ошибка'}`);
    }
    /**
     * Тестирует доступность API Gemini и валидность API ключа
     * @returns true если API ключ действителен и доступен, иначе false
     */
    async testApiKey() {
        try {
            // URL для запроса к API Gemini (обновлено на v1beta для поддержки Gemini 2.5)
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${this.apiKey}`;
            // Тестовый промпт
            const requestData = {
                contents: [
                    {
                        parts: [
                            {
                                text: "Hello, this is a test message."
                            }
                        ]
                    }
                ]
            };
            // Отправляем запрос
            await this.sendRequest(url, requestData, false);
            return true;
        }
        catch (error) {
            logger.error(`[gemini-proxy] Ошибка при тестировании API ключа: ${error.message}`, 'gemini');
            return false;
        }
    }
    /**
     * Улучшает текст с помощью Gemini API
     * @param params Параметры для улучшения текста
     * @returns Улучшенный текст
     */
    async improveText(params) {
        try {
            const { text, prompt, model = 'gemini-2.5-flash' } = params;
            logger.log(`[gemini-proxy] Improving text with model: ${model}`, 'gemini');
            // Преобразуем модель в правильное название API
            const apiModel = this.mapModelToApiName(model);
            logger.log(`[gemini-proxy] Mapped model ${model} to API model: ${apiModel}`, 'gemini');
            // Определяем правильную версию API для модели
            const { baseUrl, isVertexAI } = this.getApiVersionForModel(apiModel);
            let url;
            if (isVertexAI) {
                // Для Vertex AI baseUrl уже содержит полный путь с моделью
                url = baseUrl;
            }
            else {
                // Для генеративного API используем стандартный формат
                url = `${baseUrl}/models/${apiModel}:generateContent?key=${this.apiKey}`;
            }
            // Формируем запрос
            const requestData = {
                contents: [
                    {
                        parts: [
                            {
                                text: `${prompt}\n\n${text}`
                            }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.4,
                    topP: 0.9,
                    topK: 40,
                    maxOutputTokens: 8192
                }
            };
            // Отправляем запрос
            const response = await this.sendRequest(url, requestData, isVertexAI);
            // Обрабатываем ответ
            if (response.candidates && response.candidates.length > 0 &&
                response.candidates[0].content &&
                response.candidates[0].content.parts &&
                response.candidates[0].content.parts.length > 0) {
                // Получаем текст из ответа
                let resultText = response.candidates[0].content.parts[0].text || '';
                // Очищаем текст от HTML-тегов и других артефактов
                resultText = resultText.replace(/<automatic_updates>[\s\S]*?<\/automatic_updates>/g, '');
                resultText = resultText.replace(/<[^>]*>/g, '');
                resultText = resultText.replace(/```html/g, ''); // Удаляем маркеры начала HTML-кода
                resultText = resultText.replace(/```/g, ''); // Удаляем оставшиеся маркеры кода
                // Удаляем лишние разделители --- в начале и конце текста
                resultText = resultText.replace(/^---\s*\n?/g, ''); // Удаляем --- в начале
                resultText = resultText.replace(/\n?\s*---\s*$/g, ''); // Удаляем --- в конце
                resultText = resultText.trim(); // Убираем лишние пробелы
                return resultText;
            }
            throw new Error('Неожиданный формат ответа от Gemini API');
        }
        catch (error) {
            logger.error(`[gemini-proxy] Ошибка при улучшении текста: ${error.message}`, 'gemini');
            throw error;
        }
    }
    /**
     * Генерирует текст с помощью Gemini API
     * @param params Параметры для генерации текста
     * @returns Сгенерированный текст
     */
    async generateText(params) {
        try {
            // Если передана строка вместо объекта, используем её как prompt
            let prompt, model;
            if (typeof params === 'string') {
                prompt = params;
                model = 'gemini-2.0-flash-exp';
            } else {
                prompt = params.prompt;
                model = params.model || 'gemini-2.0-flash-exp';
            }
            logger.log(`[gemini-proxy] Generating text with model: ${model}, prompt: "${prompt?.substring(0, 100)}..."`, 'gemini');
            // Преобразуем модель в правильное название API
            const apiModel = this.mapModelToApiName(model);
            logger.log(`[gemini-proxy] Mapped model ${model} to API model: ${apiModel}`, 'gemini');
            // Определяем правильную версию API для модели
            const { baseUrl, isVertexAI } = this.getApiVersionForModel(apiModel);
            logger.log(`[gemini-proxy] API версия: baseUrl=${baseUrl}, isVertexAI=${isVertexAI}`, 'gemini');
            let url;
            if (isVertexAI) {
                // Для Vertex AI baseUrl уже содержит полный путь с моделью
                url = baseUrl;
            }
            else {
                // Для генеративного API используем стандартный формат
                url = `${baseUrl}/models/${apiModel}:generateContent?key=${this.apiKey}`;
            }
            // Проверяем что prompt не пустой
            if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
                throw new Error('Prompt не может быть пустым');
            }
            
            logger.log(`[gemini-proxy] Отправляем prompt длиной: ${prompt.length} символов`, 'gemini');
            
            // Формируем запрос
            const requestData = {
                contents: [
                    {
                        role: "user",
                        parts: [
                            {
                                text: prompt.trim()
                            }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.7,
                    topP: 0.95,
                    topK: 40,
                    maxOutputTokens: 8192
                }
            };
            // Отправляем запрос
            const response = await this.sendRequest(url, requestData, isVertexAI);
            // Обрабатываем ответ
            if (response.candidates && response.candidates.length > 0 &&
                response.candidates[0].content &&
                response.candidates[0].content.parts &&
                response.candidates[0].content.parts.length > 0) {
                // Получаем текст из ответа
                let resultText = response.candidates[0].content.parts[0].text || '';
                // Очищаем текст от HTML-тегов и других артефактов
                resultText = resultText.replace(/<automatic_updates>[\s\S]*?<\/automatic_updates>/g, '');
                resultText = resultText.replace(/<[^>]*>/g, '');
                resultText = resultText.replace(/```html/g, ''); // Удаляем маркеры начала HTML-кода
                resultText = resultText.replace(/```/g, ''); // Удаляем оставшиеся маркеры кода
                // Удаляем лишние разделители --- в начале и конце текста
                resultText = resultText.replace(/^---\s*\n?/g, ''); // Удаляем --- в начале
                resultText = resultText.replace(/\n?\s*---\s*$/g, ''); // Удаляем --- в конце
                resultText = resultText.trim(); // Убираем лишние пробелы
                return resultText;
            }
            throw new Error('Неожиданный формат ответа от Gemini API');
        }
        catch (error) {
            logger.error(`[gemini-proxy] Ошибка при генерации текста: ${error.message}`, 'gemini');
            throw error;
        }
    }
}
// Создаем глобальный экземпляр сервиса с использованием API ключа из переменных окружения
export const geminiProxyService = new GeminiProxyService({
    apiKey: process.env.GEMINI_API_KEY || 'AIzaSyDaYtWfHwI9vq3kTatny217HnbKauAvdxE'
});
// Выводим информацию об инициализации сервиса с API ключом (скрываем полный ключ для безопасности)
const apiKeyPrefix = (process.env.GEMINI_API_KEY || 'AIzaSyDaYtWfHwI9vq3kTatny217HnbKauAvdxE').substring(0, 10);
logger.log(`[gemini-proxy] Инициализирован с API ключом: ${apiKeyPrefix}...`, 'gemini');
