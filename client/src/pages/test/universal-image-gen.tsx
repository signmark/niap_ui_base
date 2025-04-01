import React from 'react';
import { ImageGenerationTester } from '@/components/ImageGenerationTester';

const UniversalImageGenTest: React.FC = () => {
  return (
    <>
      <h1 className="text-3xl font-bold mb-6">Тестирование универсального API генерации изображений</h1>
      <p className="text-gray-500 mb-4">
        Этот интерфейс позволяет тестировать новый универсальный API для работы со всеми моделями FAL.AI.
        Просто введите промпт, выберите нужные параметры и модель, а затем нажмите кнопку генерации.
      </p>
      <ImageGenerationTester />
    </>
  );
};

export default UniversalImageGenTest;