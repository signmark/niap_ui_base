import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSimpleStoryStore } from '@/lib/simpleStoryStore';
import { useCampaignStore } from '@/lib/campaignStore';

// Простой Stories Editor БЕЗ сложной логики persist и флагов
export function SimpleStoryEditor({ storyId }: { storyId: string }) {
  const selectedCampaign = useCampaignStore(state => state.selectedCampaign);
  const campaignId = selectedCampaign?.id || "46868c44-c6a4-4bed-accf-9ad07bba790e";
  
  const {
    slides,
    currentSlideIndex,
    storyTitle,
    selectedElement,
    setSlides,
    setStoryTitle,
    addElement,
    updateElement,
    deleteElement,
    clearStore
  } = useSimpleStoryStore();

  // Простая загрузка через React Query - как обычный контент
  const { data: storyData, isLoading } = useQuery({
    queryKey: ['/api/stories', storyId],
    enabled: !!storyId && !!campaignId && storyId !== 'new',
    staleTime: 0, // Всегда свежие данные
    refetchOnMount: true // Перезагружать при монтировании
  });

  // Обработка данных после загрузки
  useEffect(() => {
    if (storyData && typeof storyData === 'object') {

      
      // Простая установка данных без сложной логики
      const story = storyData as any;
      
      // Проверяем разные варианты структуры данных
      if (story?.slides) {
        // Данные напрямую в slides
        setSlides(story.slides);
        setStoryTitle(story.title || '');

      } else if (story?.metadata?.slides) {
        // Данные в metadata.slides  
        setSlides(story.metadata.slides);
        setStoryTitle(story.title || '');

      } else {

      }
    }
  }, [storyData, setSlides, setStoryTitle]);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {

      clearStore();
    };
  }, [clearStore]);

  // Простой лоадинг
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p>Загрузка Stories...</p>
        </div>
      </div>
    );
  }

  // Создаем первый слайд если их нет
  const initializeSlides = () => {
    if (slides.length === 0) {
      const firstSlide = {
        id: `slide_${Date.now()}`,
        order: 0,
        duration: 5000,
        background: {
          type: 'color' as const,
          value: '#000000'
        },
        elements: []
      };
      setSlides([firstSlide]);

    }
  };

  // Простой рендер без сложной логики
  return (
    <div className="simple-story-editor p-6">
      <div className="mb-6 bg-white rounded-lg shadow-sm border p-4">
        <h2 className="text-2xl font-bold mb-2">Stories Editor</h2>
        <div className="text-sm text-gray-600 space-y-1">
          <p>Stories ID: <span className="font-mono">{storyId}</span></p>
          <p>Слайдов: <span className="font-semibold">{slides.length}</span></p>
          {slides.length > 0 && (
            <p>Текущий слайд: <span className="font-semibold">{currentSlideIndex + 1}</span></p>
          )}
        </div>
      </div>

      {slides.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <h3 className="text-lg font-medium mb-2">Создайте первый слайд</h3>
          <p className="text-gray-600 mb-4">Начните создание Stories с первого слайда</p>
          <button 
            onClick={initializeSlides}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
          >
            Создать слайд
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <h3 className="text-lg font-semibold mb-3">Слайд {currentSlideIndex + 1}</h3>
            <p className="text-gray-600 mb-4">Элементов: {slides[currentSlideIndex]?.elements?.length || 0}</p>
            
            <div className="flex gap-2 mb-4">
              <button 
                onClick={() => addElement('text')}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
              >
                Добавить текст
              </button>
              <button 
                onClick={() => addElement('image')}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
              >
                Добавить изображение
              </button>
            </div>

            {slides[currentSlideIndex]?.elements?.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Элементы слайда:</h4>
                {slides[currentSlideIndex].elements.map((element, index) => (
                  <div key={element.id} className="border rounded p-3 bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">Элемент {index + 1}: {element.type}</p>
                        <p className="text-sm text-gray-600">Контент: {element.content}</p>
                      </div>
                      <button 
                        onClick={() => deleteElement(element.id)}
                        className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-sm"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}