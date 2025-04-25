/**
 * Модуль с тестовыми данными для аналитики
 * Используется в случае, когда невозможно получить реальные данные из Directus API
 */

import { log } from '../../utils/logger';

/**
 * Получает тестовые данные статистики по платформам
 * @returns Объект со статистикой платформ
 */
export function getFallbackPlatformsStats() {
  log.info('[fallback-data] Возвращаем fallback-данные для статистики платформ');
  
  return {
    platforms: {
      telegram: {
        posts: 14,
        views: 3218,
        likes: 142,
        comments: 34,
        shares: 18,
        engagement: 194,
        engagementRate: 6.03
      },
      vk: {
        posts: 12,
        views: 2856,
        likes: 121,
        comments: 23,
        shares: 15,
        engagement: 159,
        engagementRate: 5.57
      },
      instagram: {
        posts: 8,
        views: 1750,
        likes: 187,
        comments: 41,
        shares: 12,
        engagement: 240,
        engagementRate: 13.71
      },
      facebook: {
        posts: 10,
        views: 1456,
        likes: 78,
        comments: 19,
        shares: 25,
        engagement: 122,
        engagementRate: 8.38
      }
    },
    aggregated: {
      totalPosts: 44,
      totalViews: 9280,
      totalLikes: 528,
      totalComments: 117,
      totalShares: 70,
      totalEngagement: 715,
      averageEngagementRate: 7.71,
      platformDistribution: {
        telegram: {
          posts: 14,
          views: 3218,
          likes: 142,
          comments: 34,
          shares: 18,
          engagement: 194,
          engagementRate: 6.03
        },
        vk: {
          posts: 12,
          views: 2856,
          likes: 121,
          comments: 23,
          shares: 15,
          engagement: L159,
          engagementRate: 5.57
        },
        instagram: {
          posts: 8,
          views: 1750,
          likes: 187,
          comments: 41,
          shares: 12,
          engagement: 240,
          engagementRate: 13.71
        },
        facebook: {
          posts: 10,
          views: 1456,
          likes: 78,
          comments: 19,
          shares: 25,
          engagement: 122,
          engagementRate: 8.38
        }
      }
    }
  };
}

/**
 * Получает тестовые данные топовых публикаций
 * @returns Объект с топовыми публикациями
 */
export function getFallbackTopPosts() {
  log.info('[fallback-data] Возвращаем fallback-данные для топовых публикаций');
  
  return {
    topByViews: [
      {
        id: '1',
        title: 'Инновационные технологии в медицине',
        content: 'Новые разработки в области медицины позволяют...',
        imageUrl: 'https://source.unsplash.com/random/800x600/?medical',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        campaignId: '46868c44-c6a4-4bed-accf-9ad07bba790e',
        totalViews: 1250,
        totalEngagement: 145,
        engagementRate: 11.6,
        platforms: {
          telegram: {
            status: 'published',
            postUrl: 'https://t.me/channel/123',
            publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            analytics: {
              views: 450,
              likes: 35,
              comments: 12,
              shares: 8
            }
          },
          instagram: {
            status: 'published',
            postUrl: 'https://instagram.com/p/abc123',
            publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            analytics: {
              views: 800,
              likes: 67,
              comments: 15,
              shares: 8
            }
          }
        }
      },
      {
        id: '2',
        title: 'Топ-10 курортов для семейного отдыха',
        content: 'Представляем вашему вниманию лучшие курорты...',
        imageUrl: 'https://source.unsplash.com/random/800x600/?resort',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        campaignId: '46868c44-c6a4-4bed-accf-9ad07bba790e',
        totalViews: 980,
        totalEngagement: 103,
        engagementRate: 10.5,
        platforms: {
          vk: {
            status: 'published',
            postUrl: 'https://vk.com/wall-123456_789',
            publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            analytics: {
              views: 550,
              likes: 42,
              comments: 15,
              shares: 7
            }
          },
          facebook: {
            status: 'published',
            postUrl: 'https://facebook.com/posts/123456',
            publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            analytics: {
              views: 430,
              likes: 28,
              comments: 6,
              shares: 5
            }
          }
        }
      },
      {
        id: '3',
        title: 'Новое поколение смартфонов: обзор',
        content: 'Что нового принесли флагманские модели 2024 года...',
        imageUrl: 'https://source.unsplash.com/random/800x600/?smartphone',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        campaignId: '46868c44-c6a4-4bed-accf-9ad07bba790e',
        totalViews: 870,
        totalEngagement: 95,
        engagementRate: 10.9,
        platforms: {
          telegram: {
            status: 'published',
            postUrl: 'https://t.me/channel/456',
            publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            analytics: {
              views: 520,
              likes: 45,
              comments: 18,
              shares: 12
            }
          },
          vk: {
            status: 'published',
            postUrl: 'https://vk.com/wall-123456_567',
            publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            analytics: {
              views: 350,
              likes: 12,
              comments: 5,
              shares: 3
            }
          }
        }
      },
      {
        id: '4',
        title: 'Экологические инициативы для бизнеса',
        content: 'Как компании могут снизить влияние на окружающую среду...',
        imageUrl: 'https://source.unsplash.com/random/800x600/?ecology',
        createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
        campaignId: '46868c44-c6a4-4bed-accf-9ad07bba790e',
        totalViews: 730,
        totalEngagement: 78,
        engagementRate: 10.7,
        platforms: {
          facebook: {
            status: 'published',
            postUrl: 'https://facebook.com/posts/234567',
            publishedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
            analytics: {
              views: 330,
              likes: 25,
              comments: 12,
              shares: 17
            }
          },
          instagram: {
            status: 'published',
            postUrl: 'https://instagram.com/p/def456',
            publishedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
            analytics: {
              views: 400,
              likes: 18,
              comments: 5,
              shares: 1
            }
          }
        }
      }
    ],
    topByEngagement: [
      {
        id: '5',
        title: 'Секреты успешных стартапов',
        content: 'Что отличает успешные стартапы от неудачных проектов...',
        imageUrl: 'https://source.unsplash.com/random/800x600/?startup',
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        campaignId: '46868c44-c6a4-4bed-accf-9ad07bba790e',
        totalViews: 680,
        totalEngagement: 112,
        engagementRate: 16.5,
        platforms: {
          telegram: {
            status: 'published',
            postUrl: 'https://t.me/channel/789',
            publishedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
            analytics: {
              views: 380,
              likes: 42,
              comments: 21,
              shares: 15
            }
          },
          vk: {
            status: 'published',
            postUrl: 'https://vk.com/wall-123456_890',
            publishedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
            analytics: {
              views: 300,
              likes: 25,
              comments: 7,
              shares: 2
            }
          }
        }
      },
      {
        id: '6',
        title: 'Необычные рецепты из обычных продуктов',
        content: 'Как преобразить повседневные блюда в кулинарные шедевры...',
        imageUrl: 'https://source.unsplash.com/random/800x600/?food',
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        campaignId: '46868c44-c6a4-4bed-accf-9ad07bba790e',
        totalViews: 550,
        totalEngagement: 82,
        engagementRate: 14.9,
        platforms: {
          instagram: {
            status: 'published',
            postUrl: 'https://instagram.com/p/ghi789',
            publishedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            analytics: {
              views: 550,
              likes: 62,
              comments: 14,
              shares: 6
            }
          }
        }
      },
      {
        id: '7',
        title: 'Психология цвета в маркетинге',
        content: 'Как цвета влияют на восприятие бренда и поведение потребителей...',
        imageUrl: 'https://source.unsplash.com/random/800x600/?colors',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        campaignId: '46868c44-c6a4-4bed-accf-9ad07bba790e',
        totalViews: 630,
        totalEngagement: 86,
        engagementRate: 13.7,
        platforms: {
          facebook: {
            status: 'published',
            postUrl: 'https://facebook.com/posts/345678',
            publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            analytics: {
              views: 310,
              likes: 42,
              comments: 18,
              shares: 14
            }
          },
          telegram: {
            status: 'published',
            postUrl: 'https://t.me/channel/101',
            publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            analytics: {
              views: 320,
              likes: 5,
              comments: 4,
              shares: 3
            }
          }
        }
      },
      {
        id: '8',
        title: 'Тренды веб-разработки 2024',
        content: 'Какие технологии будут определять развитие веб-разработки в новом году...',
        imageUrl: 'https://source.unsplash.com/random/800x600/?webdevelopment',
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        campaignId: '46868c44-c6a4-4bed-accf-9ad07bba790e',
        totalViews: 480,
        totalEngagement: 64,
        engagementRate: 13.3,
        platforms: {
          vk: {
            status: 'published',
            postUrl: 'https://vk.com/wall-123456_321',
            publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            analytics: {
              views: 280,
              likes: 34,
              comments: 9,
              shares: 5
            }
          },
          facebook: {
            status: 'published',
            postUrl: 'https://facebook.com/posts/456789',
            publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            analytics: {
              views: 200,
              likes: 12,
              comments: 3,
              shares: 1
            }
          }
        }
      }
    ]
  };
}

/**
 * Получает тестовый статус сбора аналитики
 * @returns Объект со статусом сбора аналитики
 */
export function getFallbackAnalyticsStatus() {
  log.info('[fallback-data] Возвращаем fallback-данные для статуса аналитики');
  
  // Генерация даты последнего сбора аналитики (в пределах последнего дня)
  const lastCollectionTime = new Date();
  lastCollectionTime.setHours(lastCollectionTime.getHours() - Math.floor(Math.random() * 24));
  
  return {
    isCollecting: false,
    lastCollectionTime: lastCollectionTime.toISOString(),
    progress: 100,
    error: null
  };
}