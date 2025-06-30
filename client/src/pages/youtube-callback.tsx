/**
 * YouTube OAuth Callback Page
 * Handles the OAuth callback from Google and posts message to parent window
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function YouTubeCallback() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');

        if (error) {
          setStatus('error');
          setMessage(`Авторизация отклонена: ${error}`);
          
          // Отправляем сообщение об ошибке родительскому окну
          if (window.opener) {
            window.opener.postMessage({
              type: 'YOUTUBE_AUTH_ERROR',
              error: `Авторизация отклонена: ${error}`
            }, window.location.origin);
          }
          return;
        }

        if (!code || !state) {
          setStatus('error');
          setMessage('Отсутствуют необходимые параметры авторизации');
          
          if (window.opener) {
            window.opener.postMessage({
              type: 'YOUTUBE_AUTH_ERROR',
              error: 'Отсутствуют необходимые параметры авторизации'
            }, window.location.origin);
          }
          return;
        }

        // Отправляем код на сервер для обмена на токены
        const response = await fetch('/api/auth/youtube/auth/callback?' + urlParams.toString());
        const data = await response.json();

        if (data.success) {
          setStatus('success');
          setMessage('YouTube успешно подключен!');
          
          // Отправляем токены родительскому окну
          if (window.opener) {
            window.opener.postMessage({
              type: 'YOUTUBE_AUTH_SUCCESS',
              tokens: data.tokens
            }, window.location.origin);
          }
          
          // Закрываем окно через 2 секунды
          setTimeout(() => {
            window.close();
          }, 2000);
        } else {
          setStatus('error');
          setMessage(data.error || 'Ошибка при обработке авторизации');
          
          if (window.opener) {
            window.opener.postMessage({
              type: 'YOUTUBE_AUTH_ERROR',
              error: data.error || 'Ошибка при обработке авторизации'
            }, window.location.origin);
          }
        }
      } catch (error) {
        console.error('Ошибка при обработке callback:', error);
        setStatus('error');
        setMessage('Произошла ошибка при обработке авторизации');
        
        if (window.opener) {
          window.opener.postMessage({
            type: 'YOUTUBE_AUTH_ERROR',
            error: 'Произошла ошибка при обработке авторизации'
          }, window.location.origin);
        }
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            {status === 'loading' && <Loader2 className="h-5 w-5 animate-spin" />}
            {status === 'success' && <CheckCircle className="h-5 w-5 text-green-600" />}
            {status === 'error' && <AlertCircle className="h-5 w-5 text-red-600" />}
            
            {status === 'loading' && 'Обработка авторизации...'}
            {status === 'success' && 'Успешно!'}
            {status === 'error' && 'Ошибка'}
          </CardTitle>
          <CardDescription>
            {message || 'Подождите, обрабатываем данные авторизации YouTube...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'success' && (
            <div className="text-center text-sm text-muted-foreground">
              Это окно закроется автоматически через несколько секунд
            </div>
          )}
          {status === 'error' && (
            <div className="text-center">
              <button 
                onClick={() => window.close()}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Закрыть окно
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}