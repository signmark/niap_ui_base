const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Настройка для работы за прокси
app.set('trust proxy', true);

app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

// Логирование всех запросов для диагностики
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url} - Origin: ${req.get('origin')} - Host: ${req.get('host')}`);
    next();
});

// Временное хранение для OAuth flow (в продакшене использовать Redis)
const oauthSessions = new Map();

// Эндпоинт для начала OAuth flow
app.post('/api/auth/start', (req, res) => {
    const { appId, appSecret, redirectUri, webhookUrl, instagramId } = req.body;

    if (!appId || !appSecret || !redirectUri) {
        return res.status(400).json({
            error: 'Требуются: appId, appSecret, redirectUri'
        });
    }

    // Используем зашитый webhook URL если не передан
    const finalWebhookUrl = webhookUrl || 'https://n8n.pushrom.ru/webhook/testinstapp';

    // Генерируем уникальный state для безопасности
    const state = Math.random().toString(36).substring(2, 15);

    // Сохраняем данные сессии
    oauthSessions.set(state, {
        appId,
        appSecret,
        redirectUri,
        webhookUrl: finalWebhookUrl, // Используем зашитый webhook URL
        instagramId, // Сохраняем Instagram ID из формы
        timestamp: Date.now()
    });

    // Формируем URL для авторизации Facebook
    const scopes = [
        'pages_manage_posts',
        'pages_read_engagement',
        'pages_show_list',
        'instagram_basic',
        'instagram_content_publish'
    ].join(',');

    const authUrl = `https://www.facebook.com/v23.0/dialog/oauth?` +
        `client_id=${appId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scopes)}&` +
        `response_type=code&` +
        `state=${state}`;

    res.json({ authUrl, state });
});

// Callback эндпоинт для обработки ответа от Facebook
app.get('/api/auth/callback', async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
        return res.status(400).json({ error: `Facebook error: ${error}` });
    }

    if (!code || !state) {
        return res.status(400).json({ error: 'Отсутствует код авторизации или state' });
    }

    // Получаем данные сессии
    const session = oauthSessions.get(state);
    if (!session) {
        return res.status(400).json({ error: 'Недействительная сессия' });
    }

    try {
        // Настройки для axios с увеличенным timeout
        const axiosConfig = {
            timeout: 30000, // 30 секунд
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        };

        console.log('Шаг 1: Получаем краткосрочный токен...');
        // Шаг 1: Обмениваем код на краткосрочный токен
        const tokenResponse = await axios.get('https://graph.facebook.com/v23.0/oauth/access_token', {
            params: {
                client_id: session.appId,
                client_secret: session.appSecret,
                redirect_uri: session.redirectUri,
                code: code
            },
            ...axiosConfig
        });

        const shortLivedToken = tokenResponse.data.access_token;

        console.log('Шаг 2: Получаем долгосрочный токен...');
        // Шаг 2: Обмениваем краткосрочный токен на долгосрочный
        const longLivedResponse = await axios.get('https://graph.facebook.com/v23.0/oauth/access_token', {
            params: {
                grant_type: 'fb_exchange_token',
                client_id: session.appId,
                client_secret: session.appSecret,
                fb_exchange_token: shortLivedToken
            },
            ...axiosConfig
        });

        const longLivedToken = longLivedResponse.data.access_token;
        const expiresIn = longLivedResponse.data.expires_in;

        console.log('Шаг 3: Получаем информацию о пользователе...');
        // Шаг 3: Получаем информацию о пользователе и его страницах
        const userResponse = await axios.get('https://graph.facebook.com/v23.0/me', {
            params: {
                access_token: longLivedToken,
                fields: 'id,name,email'
            },
            ...axiosConfig
        });

        // Проверяем права доступа токена
        console.log('Проверяем права доступа токена...');
        const permissionsResponse = await axios.get('https://graph.facebook.com/v23.0/me/permissions', {
            params: {
                access_token: longLivedToken
            },
            ...axiosConfig
        });

        console.log('Права доступа:', JSON.stringify(permissionsResponse.data.data, null, 2));

        console.log('Шаг 4: Получаем страницы пользователя...');
        const pagesResponse = await axios.get('https://graph.facebook.com/v23.0/me/accounts', {
            params: {
                access_token: longLivedToken,
                fields: 'id,name,access_token,instagram_business_account{id,name,username,profile_picture_url}',
                limit: 100 // Увеличиваем лимит
            },
            ...axiosConfig
        });

        // Дополнительная проверка - попробуем другой эндпоинт
        console.log('Дополнительная проверка через /me/accounts без полей...');
        const simplePages = await axios.get('https://graph.facebook.com/v23.0/me/accounts', {
            params: {
                access_token: longLivedToken
            },
            ...axiosConfig
        });
        console.log('Простой запрос страниц:', JSON.stringify(simplePages.data, null, 2));

        // Способ 2: Попробуем получить Instagram аккаунты через другой эндпоинт
        console.log('Пробуем получить Instagram аккаунты через /me...');
        try {
            const instagramResponse = await axios.get('https://graph.facebook.com/v23.0/me', {
                params: {
                    access_token: longLivedToken,
                    fields: 'accounts{instagram_business_account{id,username,name}}'
                },
                ...axiosConfig
            });
            console.log('Instagram через /me:', JSON.stringify(instagramResponse.data, null, 2));
        } catch (error) {
            console.log('Ошибка при получении Instagram через /me:', error.response?.data || error.message);
        }

        // Способ 3: Если у нас есть user token, попробуем найти Instagram аккаунты
        console.log('Пробуем поиск Instagram Business аккаунтов...');
        try {
            // Этот запрос может показать связанные Instagram аккаунты
            const businessResponse = await axios.get('https://graph.facebook.com/v23.0/me/business_users', {
                params: {
                    access_token: longLivedToken
                },
                ...axiosConfig
            });
            console.log('Business users:', JSON.stringify(businessResponse.data, null, 2));
        } catch (error) {
            console.log('Ошибка при получении business users:', error.response?.data || error.message);
        }

        // Способ 4: Попробуем найти Instagram аккаунты через поиск
        console.log('Пробуем поиск через Instagram Graph API...');
        try {
            // Если у нас есть права instagram_basic, попробуем получить информацию о себе
            const instagramMeResponse = await axios.get('https://graph.facebook.com/v23.0/me', {
                params: {
                    access_token: longLivedToken,
                    fields: 'instagram_accounts{id,username,name}'
                },
                ...axiosConfig
            });
            console.log('Instagram accounts через me:', JSON.stringify(instagramMeResponse.data, null, 2));
        } catch (error) {
            console.log('Ошибка при получении instagram_accounts:', error.response?.data || error.message);
        }

        // Способ 5: Прямой запрос к Instagram Graph API
        console.log('Пробуем прямой запрос к Instagram Graph API...');
        try {
            // Попробуем получить информацию о текущем пользователе через Instagram API
            const instagramUserResponse = await axios.get('https://graph.instagram.com/me', {
                params: {
                    access_token: longLivedToken,
                    fields: 'id,username,account_type,media_count'
                },
                ...axiosConfig
            });
            console.log('Instagram User через graph.instagram.com:', JSON.stringify(instagramUserResponse.data, null, 2));
        } catch (error) {
            console.log('Ошибка при запросе к graph.instagram.com/me:', error.response?.data || error.message);
        }

        // Способ 6: Попробуем найти Instagram Business аккаунты через Facebook Business Manager
        console.log('Пробуем получить Instagram через Business Manager...');
        try {
            const businessManagerResponse = await axios.get('https://graph.facebook.com/v23.0/me/adaccounts', {
                params: {
                    access_token: longLivedToken,
                    fields: 'id,name,instagram_accounts'
                },
                ...axiosConfig
            });
            console.log('Business Manager Instagram:', JSON.stringify(businessManagerResponse.data, null, 2));
        } catch (error) {
            console.log('Ошибка при получении через Business Manager:', error.response?.data || error.message);
        }

        // Логируем для диагностики
        console.log('=== ДИАГНОСТИКА ===');
        console.log('Полный ответ от /me/accounts:', JSON.stringify(pagesResponse.data, null, 2));
        console.log('Всего страниц:', pagesResponse.data.data?.length || 0);

        if (pagesResponse.data.data && pagesResponse.data.data.length > 0) {
            console.log('Страницы:', JSON.stringify(pagesResponse.data.data, null, 2));
        } else {
            console.log('❌ Страницы не найдены! Возможные причины:');
            console.log('1. У пользователя нет Facebook страниц');
            console.log('2. Нет прав pages_show_list');
            console.log('3. Страницы не были выбраны при авторизации');
        }

        // Фильтруем только страницы с подключенным Instagram
        const pagesWithInstagram = pagesResponse.data.data.filter(page =>
            page.instagram_business_account
        );

        console.log('Страниц с Instagram:', pagesWithInstagram.length);

        // Обрабатываем Instagram аккаунты
        const instagramAccounts = pagesWithInstagram.map(page => ({
            // Данные для Instagram API
            instagramId: page.instagram_business_account.id,
            instagramUsername: page.instagram_business_account.username || page.instagram_business_account.name,
            pageAccessToken: page.access_token, // Этот токен используется для Instagram API

            // Дополнительная информация
            facebookPageId: page.id,
            facebookPageName: page.name,
            instagramName: page.instagram_business_account.name,
            profilePicture: page.instagram_business_account.profile_picture_url
        }));

        // Если Instagram ID введен вручную, добавляем его
        let finalInstagramAccounts = instagramAccounts;

        if (session.instagramId && instagramAccounts.length === 0) {
            console.log('Используем Instagram ID из формы:', session.instagramId);
            finalInstagramAccounts = [{
                instagramId: session.instagramId,
                instagramUsername: "manual_entry",
                pageAccessToken: longLivedToken, // Используем user token
                facebookPageId: "manual",
                facebookPageName: "Manual Entry",
                instagramName: "Manual Entry",
                profilePicture: null,
                source: "manual_input"
            }];
        }

        // Шаг 4: Отправляем данные на webhook
        const webhookData = {
            user: userResponse.data,
            userToken: {
                token: longLivedToken,
                expiresIn: expiresIn,
                expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString()
            },

            // Все страницы Facebook
            facebookPages: pagesResponse.data.data.map(page => ({
                id: page.id,
                name: page.name,
                accessToken: page.access_token,
                hasInstagram: !!page.instagram_business_account
            })),

            // Instagram аккаунты (готовые для API)
            instagramAccounts: finalInstagramAccounts,

            // Статистика
            stats: {
                totalFacebookPages: pagesResponse.data.data.length,
                instagramConnectedPages: pagesWithInstagram.length,
                hasInstagramAccounts: finalInstagramAccounts.length > 0,
                manualInstagramId: !!session.instagramId
            },

            // Инструкция по использованию
            usage: {
                instagram_posting: "Используй instagramAccounts[].pageAccessToken и instagramAccounts[].instagramId",
                facebook_posting: "Используй facebookPages[].accessToken и facebookPages[].id",
                note: session.instagramId ? "Instagram ID введен вручную" : "Instagram ID получен через API"
            },

            timestamp: new Date().toISOString()
        };

        await axios.post(session.webhookUrl, webhookData, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });

        // Очищаем сессию
        oauthSessions.delete(state);

        res.json({
            success: true,
            message: 'Токены успешно получены и отправлены на webhook',
            user: userResponse.data,
            pagesCount: pagesResponse.data.data.length
        });

    } catch (error) {
        console.error('=== ОШИБКА ===');
        console.error('Сообщение:', error.message);
        console.error('Код:', error.code);
        console.error('Статус:', error.response?.status);
        console.error('Данные ответа:', error.response?.data);
        console.error('URL запроса:', error.config?.url);

        // Очищаем сессию даже при ошибке
        oauthSessions.delete(state);

        res.status(500).json({
            error: 'Ошибка при получении токенов',
            details: error.response?.data || error.message,
            step: error.config?.url?.includes('oauth/access_token') ? 'token_exchange' : 'api_request'
        });
    }
});

// Очистка старых сессий (каждые 10 минут)
setInterval(() => {
    const now = Date.now();
    for (const [state, session] of oauthSessions.entries()) {
        if (now - session.timestamp > 10 * 60 * 1000) { // 10 минут
            oauthSessions.delete(state);
        }
    }
}, 10 * 60 * 1000);

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`Callback URL: http://localhost:${PORT}/api/auth/callback`);
});