import React from 'react';

const InstagramSimplePage: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Подключение Instagram Business
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mt-2">
          Настройка публикации контента в Instagram через Facebook Business API
        </p>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
        <h2 className="text-xl font-semibold mb-4">Instagram Setup Wizard</h2>
        <p className="text-gray-600 dark:text-gray-300">
          Визард для настройки Instagram API подключения будет здесь.
        </p>
        
        <div className="mt-6 space-y-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h3 className="font-medium text-blue-900 dark:text-blue-100">Шаг 1: Создание Facebook Business страницы</h3>
            <p className="text-sm text-blue-700 dark:text-blue-200 mt-1">
              Создайте Facebook Business страницу и подключите к ней Instagram Business аккаунт
            </p>
          </div>
          
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <h3 className="font-medium text-green-900 dark:text-green-100">Шаг 2: Создание Facebook приложения</h3>
            <p className="text-sm text-green-700 dark:text-green-200 mt-1">
              Создайте Facebook App для получения App ID и App Secret
            </p>
          </div>
          
          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <h3 className="font-medium text-purple-900 dark:text-purple-100">Шаг 3: Получение токенов</h3>
            <p className="text-sm text-purple-700 dark:text-purple-200 mt-1">
              Авторизация и получение долгосрочных токенов для Instagram API
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstagramSimplePage;