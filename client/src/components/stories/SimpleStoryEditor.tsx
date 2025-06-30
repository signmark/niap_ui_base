import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSimpleStoryStore } from '@/lib/simpleStoryStore';
import { useCampaignStore } from '@/lib/campaignStore';

// Простой Stories Editor БЕЗ сложной логики persist и флагов
export function SimpleStoryEditor({ storyId }: { storyId: string }) {
  const campaignId = useCampaignStore(state => state.activeCampaign?.id);
  
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
    if (storyData) {
      console.log('📥 Загружены данные Stories:', storyData);
      
      // Простая установка данных без сложной логики
      if (storyData?.metadata?.slides) {
        setSlides(storyData.metadata.slides);
        setStoryTitle(storyData.title || '');
        console.log('✅ Stories данные установлены:', storyData.metadata.slides.length, 'слайдов');
      }
    }
  }, [storyData, setSlides, setStoryTitle]);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      console.log('🧹 Очистка SimpleStoryEditor');
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

  // Простой рендер без сложной логики
  return (
    <div className="simple-story-editor">
      <div className="mb-4">
        <h2 className="text-xl font-bold">Simple Stories Editor</h2>
        <p>Stories ID: {storyId}</p>
        <p>Слайдов: {slides.length}</p>
        <p>Текущий слайд: {currentSlideIndex + 1}</p>
      </div>

      {slides.length > 0 && (
        <div className="slide-content">
          <h3>Слайд {currentSlideIndex + 1}</h3>
          <p>Элементов: {slides[currentSlideIndex]?.elements?.length || 0}</p>
          
          <div className="mt-4">
            <button 
              onClick={() => addElement('text')}
              className="bg-blue-500 text-white px-4 py-2 rounded mr-2"
            >
              Добавить текст
            </button>
            <button 
              onClick={() => addElement('image')}
              className="bg-green-500 text-white px-4 py-2 rounded"
            >
              Добавить изображение
            </button>
          </div>

          <div className="mt-4">
            {slides[currentSlideIndex]?.elements?.map((element, index) => (
              <div key={element.id} className="border p-2 mb-2">
                <p>Элемент {index + 1}: {element.type}</p>
                <p>Контент: {element.content}</p>
                <button 
                  onClick={() => deleteElement(element.id)}
                  className="bg-red-500 text-white px-2 py-1 rounded text-sm"
                >
                  Удалить
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}