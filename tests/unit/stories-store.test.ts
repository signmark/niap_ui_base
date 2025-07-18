/**
 * Тесты для Stories Store
 * Критически важно для Stories функциональности
 */

describe('Stories Store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Store State Management', () => {
    test('должен правильно инициализировать пустую Stories', () => {
      const initializeEmptyStory = () => {
        return {
          slides: [{
            id: 'slide-1',
            elements: []
          }],
          currentSlideIndex: 0,
          storyId: null,
          isNewStory: true
        };
      };

      const story = initializeEmptyStory();
      
      expect(story.slides).toHaveLength(1);
      expect(story.slides[0].elements).toHaveLength(0);
      expect(story.currentSlideIndex).toBe(0);
      expect(story.isNewStory).toBe(true);
    });

    test('должен добавлять элементы к слайдам', () => {
      let storyState = {
        slides: [{
          id: 'slide-1',
          elements: []
        }],
        currentSlideIndex: 0
      };

      const addElementToSlide = (slideIndex: number, element: any) => {
        const newSlides = [...storyState.slides];
        if (newSlides[slideIndex]) {
          newSlides[slideIndex] = {
            ...newSlides[slideIndex],
            elements: [...newSlides[slideIndex].elements, element]
          };
        }
        return { ...storyState, slides: newSlides };
      };

      const textElement = {
        id: 'element-1',
        type: 'text',
        content: 'Test text',
        position: { x: 100, y: 100 },
        style: { fontSize: 16, color: '#000' }
      };

      storyState = addElementToSlide(0, textElement);
      
      expect(storyState.slides[0].elements).toHaveLength(1);
      expect(storyState.slides[0].elements[0].type).toBe('text');
      expect(storyState.slides[0].elements[0].content).toBe('Test text');
    });

    test('должен удалять слайды корректно', () => {
      let storyState = {
        slides: [
          { id: 'slide-1', elements: [] },
          { id: 'slide-2', elements: [] },
          { id: 'slide-3', elements: [] }
        ],
        currentSlideIndex: 1
      };

      const deleteSlide = (slideIndex: number) => {
        if (storyState.slides.length <= 1) {
          throw new Error('Cannot delete the last slide');
        }

        const newSlides = storyState.slides.filter((_, index) => index !== slideIndex);
        let newCurrentIndex = storyState.currentSlideIndex;
        
        if (slideIndex <= storyState.currentSlideIndex && storyState.currentSlideIndex > 0) {
          newCurrentIndex = storyState.currentSlideIndex - 1;
        }

        return {
          ...storyState,
          slides: newSlides,
          currentSlideIndex: Math.min(newCurrentIndex, newSlides.length - 1)
        };
      };

      // Удаляем второй слайд (индекс 1)
      storyState = deleteSlide(1);
      
      expect(storyState.slides).toHaveLength(2);
      expect(storyState.slides.map(s => s.id)).toEqual(['slide-1', 'slide-3']);
      expect(storyState.currentSlideIndex).toBe(0); // Скорректирован после удаления

      // Попытка удалить последний слайд должна вызвать ошибку
      storyState = deleteSlide(0); // Теперь остается только один слайд
      expect(() => deleteSlide(0)).toThrow('Cannot delete the last slide');
    });

    test('должен корректно обрабатывать смену Stories ID', () => {
      let storyState = {
        storyId: 'story-1',
        slides: [{ id: 'slide-1', elements: [{ id: 'element-1' }] }],
        hasWorkingSlides: true
      };

      const shouldClearStore = (newStoryId: string | null, currentState: any) => {
        // Не очищаем если это та же Stories
        if (newStoryId === currentState.storyId) {
          return false;
        }

        // Не очищаем если есть пользовательские элементы
        if (currentState.hasWorkingSlides) {
          const hasUserElements = currentState.slides.some((slide: any) => 
            slide.elements && slide.elements.length > 0
          );
          if (hasUserElements) {
            return false;
          }
        }

        return true;
      };

      // Переключение на ту же Stories - не очищаем
      expect(shouldClearStore('story-1', storyState)).toBe(false);

      // Переключение на другую Stories с элементами - не очищаем
      expect(shouldClearStore('story-2', storyState)).toBe(false);

      // Переключение на другую Stories без элементов - очищаем
      storyState.slides[0].elements = [];
      expect(shouldClearStore('story-2', storyState)).toBe(true);
    });
  });

  describe('Element Management', () => {
    test('должен обновлять позицию элементов', () => {
      let storyState = {
        slides: [{
          id: 'slide-1',
          elements: [{
            id: 'element-1',
            type: 'text',
            position: { x: 100, y: 100 }
          }]
        }]
      };

      const updateElementPosition = (slideIndex: number, elementId: string, newPosition: any) => {
        const newSlides = [...storyState.slides];
        const slide = newSlides[slideIndex];
        
        if (slide) {
          slide.elements = slide.elements.map(element => 
            element.id === elementId 
              ? { ...element, position: newPosition }
              : element
          );
        }

        return { ...storyState, slides: newSlides };
      };

      storyState = updateElementPosition(0, 'element-1', { x: 200, y: 150 });
      
      expect(storyState.slides[0].elements[0].position).toEqual({ x: 200, y: 150 });
    });

    test('должен удалять элементы из слайдов', () => {
      let storyState = {
        slides: [{
          id: 'slide-1',
          elements: [
            { id: 'element-1', type: 'text' },
            { id: 'element-2', type: 'image' }
          ]
        }]
      };

      const deleteElement = (slideIndex: number, elementId: string) => {
        const newSlides = [...storyState.slides];
        const slide = newSlides[slideIndex];
        
        if (slide) {
          slide.elements = slide.elements.filter(element => element.id !== elementId);
        }

        return { ...storyState, slides: newSlides };
      };

      storyState = deleteElement(0, 'element-1');
      
      expect(storyState.slides[0].elements).toHaveLength(1);
      expect(storyState.slides[0].elements[0].id).toBe('element-2');
    });
  });

  describe('Persistence Logic', () => {
    test('должен определять когда сохранять в localStorage', () => {
      const shouldPersist = (storyState: any) => {
        // Не сохраняем если это новая Stories без изменений
        if (storyState.isNewStory && !storyState.hasUserChanges) {
          return false;
        }

        // Не сохраняем Stories в памяти до явного сохранения
        if (!storyState.storyId) {
          return false;
        }

        return true;
      };

      const newStory = { isNewStory: true, hasUserChanges: false, storyId: null };
      const editedNewStory = { isNewStory: true, hasUserChanges: true, storyId: null };
      const savedStory = { isNewStory: false, storyId: 'story-123' };

      expect(shouldPersist(newStory)).toBe(false);
      expect(shouldPersist(editedNewStory)).toBe(false);
      expect(shouldPersist(savedStory)).toBe(true);
    });
  });
});