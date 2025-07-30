import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';

export default function VkCallback() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState('Обработка авторизации ВКонтакте...');

  useEffect(() => {
    const processVkCallback = async () => {
      try {
        console.log('VK Callback: Processing OAuth response');
        console.log('Current URL:', window.location.href);
        console.log('Hash:', window.location.hash);
        
        // VK возвращает токен в URL hash, а не в query параметрах
        const hash = window.location.hash.substring(1); // Убираем #
        console.log('Hash without #:', hash);
        
        if (!hash) {
          throw new Error('Отсутствует hash в URL');
        }
        
        // Парсим параметры из hash
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const userId = params.get('user_id');
        const expiresIn = params.get('expires_in');
        
        console.log('VK OAuth данные:', {
          accessToken: accessToken ? `${accessToken.substring(0, 20)}...` : null,
          userId,
          expiresIn
        });
        
        if (!accessToken) {
          throw new Error('Токен доступа не получен');
        }
        
        if (!userId) {
          throw new Error('ID пользователя не получен');
        }
        
        setStatus('Токен получен, перенаправляем обратно...');
        
        // Отправляем данные в родительское окно
        if (window.opener) {
          window.opener.postMessage({
            type: 'VK_OAUTH_SUCCESS',
            data: {
              accessToken,
              userId,
              expiresIn: expiresIn ? parseInt(expiresIn) : null
            }
          }, '*');
          
          console.log('VK OAuth: Данные отправлены в родительское окно');
          
          // Закрываем popup
          setTimeout(() => {
            window.close();
          }, 1000);
        } else {
          // Если не popup, перенаправляем на главную
          console.log('VK OAuth: Не popup, перенаправляем на главную');
          setLocation('/');
        }
        
      } catch (error: any) {
        console.error('VK OAuth error:', error);
        setStatus(`Ошибка: ${error.message}`);
        
        // Отправляем ошибку в родительское окно
        if (window.opener) {
          window.opener.postMessage({
            type: 'VK_OAUTH_ERROR',
            error: error.message
          }, '*');
          
          setTimeout(() => {
            window.close();
          }, 2000);
        }
      }
    };

    processVkCallback();
  }, [setLocation]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Авторизация ВКонтакте
        </h2>
        <p className="text-gray-600">
          {status}
        </p>
      </div>
    </div>
  );
}