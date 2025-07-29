import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';

export default function InstagramCallback() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Обработка ответа от Facebook...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Получаем параметры из URL
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');

        console.log('🔥 CALLBACK RECEIVED:', { code, state, error });

        if (error) {
          throw new Error(`Facebook OAuth error: ${error}`);
        }

        if (!code || !state) {
          throw new Error('Missing authorization code or state parameter');
        }

        // Отправляем данные в N8N webhook для обработки
        const response = await fetch('https://n8n.roboflow.space/webhook/authorize-ig', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code,
            state,
            callback_type: 'facebook_oauth'
          })
        });

        if (!response.ok) {
          throw new Error(`N8N processing failed: ${response.status}`);
        }

        setStatus('success');
        setMessage('Авторизация Instagram успешно завершена!');
        
        // Перенаправляем обратно в настройки через 3 секунды
        setTimeout(() => {
          window.close(); // Закрываем popup окно
        }, 3000);

      } catch (error) {
        console.error('Callback processing error:', error);
        setStatus('error');
        setMessage((error as Error).message || 'Произошла ошибка при обработке авторизации');
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900">
            Instagram OAuth Callback
          </h2>
          
          <div className="mt-6">
            {status === 'processing' && (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="text-gray-600">{message}</span>
              </div>
            )}
            
            {status === 'success' && (
              <div className="text-green-600">
                <div className="text-5xl mb-4">✅</div>
                <p className="text-lg font-medium">{message}</p>
                <p className="text-sm text-gray-500 mt-2">
                  Окно закроется автоматически через несколько секунд
                </p>
              </div>
            )}
            
            {status === 'error' && (
              <div className="text-red-600">
                <div className="text-5xl mb-4">❌</div>
                <p className="text-lg font-medium">Ошибка авторизации</p>
                <p className="text-sm text-gray-700 mt-2">{message}</p>
                <button 
                  onClick={() => window.close()}
                  className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Закрыть окно
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}