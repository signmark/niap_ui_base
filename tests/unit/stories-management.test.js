/**
 * Тесты управления Stories - критично для функциональности редактора
 */

describe('Stories Management Tests', () => {
  test('должен правильно управлять слайдами Stories', () => {
    // Инициализация пустой Stories
    function initializeEmptyStory() {
      return {
        slides: [{
          id: 'slide-1',
          elements: []
        }],
        currentSlideIndex: 0,
        storyId: null,
        isNewStory: true
      };
    }

    // Добавление нового слайда
    function addSlide(storyState) {
      const newSlideId = `slide-${storyState.slides.length + 1}`;
      const newSlide = {
        id: newSlideId,
        elements: []
      };

      return {
        ...storyState,
        slides: [...storyState.slides, newSlide],
        currentSlideIndex: storyState.slides.length
      };
    }

    // Удаление слайда
    function deleteSlide(storyState, slideIndex) {
      if (storyState.slides.length <= 1) {
        throw new Error('Нельзя удалить последний слайд');
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
    }

    let story = initializeEmptyStory();
    
    // Тест инициализации
    expect(story.slides).toHaveLength(1);
    expect(story.currentSlideIndex).toBe(0);
    expect(story.isNewStory).toBe(true);

    // Тест добавления слайдов
    story = addSlide(story);
    expect(story.slides).toHaveLength(2);
    expect(story.currentSlideIndex).toBe(1);
    expect(story.slides[1].id).toBe('slide-2');

    story = addSlide(story);
    expect(story.slides).toHaveLength(3);
    expect(story.currentSlideIndex).toBe(2);

    // Тест удаления слайдов
    story = deleteSlide(story, 1); // Удаляем средний слайд
    expect(story.slides).toHaveLength(2);
    expect(story.currentSlideIndex).toBe(1); // Скорректирован

    // Попытка удалить последние слайды
    story = deleteSlide(story, 0);
    expect(story.slides).toHaveLength(1);
    expect(story.currentSlideIndex).toBe(0);

    // Нельзя удалить последний слайд
    expect(() => deleteSlide(story, 0)).toThrow('Нельзя удалить последний слайд');
  });

  test('должен правильно управлять элементами на слайдах', () => {
    // Добавление элемента
    function addElement(storyState, slideIndex, element) {
      const newSlides = [...storyState.slides];
      if (newSlides[slideIndex]) {
        newSlides[slideIndex] = {
          ...newSlides[slideIndex],
          elements: [...newSlides[slideIndex].elements, element]
        };
      }
      return { ...storyState, slides: newSlides };
    }

    // Удаление элемента
    function deleteElement(storyState, slideIndex, elementId) {
      const newSlides = [...storyState.slides];
      if (newSlides[slideIndex]) {
        newSlides[slideIndex] = {
          ...newSlides[slideIndex],
          elements: newSlides[slideIndex].elements.filter(el => el.id !== elementId)
        };
      }
      return { ...storyState, slides: newSlides };
    }

    // Обновление элемента
    function updateElement(storyState, slideIndex, elementId, updates) {
      const newSlides = [...storyState.slides];
      if (newSlides[slideIndex]) {
        newSlides[slideIndex] = {
          ...newSlides[slideIndex],
          elements: newSlides[slideIndex].elements.map(el => 
            el.id === elementId ? { ...el, ...updates } : el
          )
        };
      }
      return { ...storyState, slides: newSlides };
    }

    let story = {
      slides: [{ id: 'slide-1', elements: [] }],
      currentSlideIndex: 0
    };

    const textElement = {
      id: 'element-1',
      type: 'text',
      content: 'Тестовый текст',
      position: { x: 100, y: 100 },
      style: { fontSize: 16, color: '#000' }
    };

    const imageElement = {
      id: 'element-2',
      type: 'image',
      src: 'https://example.com/image.jpg',
      position: { x: 200, y: 200 },
      size: { width: 100, height: 100 }
    };

    // Добавление элементов
    story = addElement(story, 0, textElement);
    expect(story.slides[0].elements).toHaveLength(1);
    expect(story.slides[0].elements[0].type).toBe('text');

    story = addElement(story, 0, imageElement);
    expect(story.slides[0].elements).toHaveLength(2);

    // Обновление элемента
    story = updateElement(story, 0, 'element-1', { 
      content: 'Обновленный текст',
      position: { x: 150, y: 150 }
    });
    
    const updatedElement = story.slides[0].elements.find(el => el.id === 'element-1');
    expect(updatedElement.content).toBe('Обновленный текст');
    expect(updatedElement.position).toEqual({ x: 150, y: 150 });

    // Удаление элемента
    story = deleteElement(story, 0, 'element-1');
    expect(story.slides[0].elements).toHaveLength(1);
    expect(story.slides[0].elements[0].id).toBe('element-2');
  });

  test('должен определять когда нужно очищать Store', () => {
    // Логика определения необходимости очистки Store
    function shouldClearStore(newStoryId, currentState) {
      // Не очищаем если это та же Stories
      if (newStoryId === currentState.storyId) {
        return false;
      }

      // Не очищаем если есть пользовательские элементы
      if (currentState.slides) {
        const hasUserElements = currentState.slides.some(slide => 
          slide.elements && slide.elements.length > 0
        );
        if (hasUserElements) {
          return false;
        }
      }

      return true;
    }

    const stateWithElements = {
      storyId: 'story-1',
      slides: [{ id: 'slide-1', elements: [{ id: 'element-1', type: 'text' }] }]
    };

    const stateWithoutElements = {
      storyId: 'story-1', 
      slides: [{ id: 'slide-1', elements: [] }]
    };

    // Переключение на ту же Stories - не очищаем
    expect(shouldClearStore('story-1', stateWithElements)).toBe(false);

    // Переключение на другую Stories с элементами - не очищаем
    expect(shouldClearStore('story-2', stateWithElements)).toBe(false);

    // Переключение на другую Stories без элементов - очищаем
    expect(shouldClearStore('story-2', stateWithoutElements)).toBe(true);

    // Первоначальная загрузка (null -> ID) - очищаем
    expect(shouldClearStore('story-1', { storyId: null, slides: [] })).toBe(true);
  });

  test('должен правильно сохранять и загружать данные Stories', () => {
    // Подготовка данных для сохранения
    function prepareStoriesForSave(storyState, campaignId) {
      if (!campaignId) {
        throw new Error('Campaign ID обязателен для сохранения Stories');
      }

      const metadata = {
        slides: storyState.slides,
        storySettings: {
          backgroundMusic: storyState.backgroundMusic || null,
          duration: storyState.duration || 'auto',
          transitions: storyState.transitions || 'fade'
        }
      };

      return {
        campaign_id: campaignId,
        content_type: 'stories',
        metadata: JSON.stringify(metadata),
        status: 'draft'
      };
    }

    // Загрузка данных Stories
    function loadStoriesFromSave(savedData) {
      if (!savedData.metadata) {
        throw new Error('Метаданные Stories не найдены');
      }

      let metadata;
      try {
        metadata = typeof savedData.metadata === 'string' 
          ? JSON.parse(savedData.metadata) 
          : savedData.metadata;
      } catch (e) {
        throw new Error('Некорректные метаданные Stories');
      }

      return {
        storyId: savedData.id,
        slides: metadata.slides || [],
        backgroundMusic: metadata.storySettings?.backgroundMusic,
        duration: metadata.storySettings?.duration || 'auto',
        transitions: metadata.storySettings?.transitions || 'fade',
        isNewStory: false
      };
    }

    const storyState = {
      slides: [
        {
          id: 'slide-1',
          elements: [
            { id: 'element-1', type: 'text', content: 'Привет!' }
          ]
        }
      ],
      backgroundMusic: 'track-1.mp3',
      duration: 5000,
      transitions: 'slide'
    };

    // Тест сохранения
    const saveData = prepareStoriesForSave(storyState, 'campaign-123');
    expect(saveData.campaign_id).toBe('campaign-123');
    expect(saveData.content_type).toBe('stories');
    expect(saveData.status).toBe('draft');

    const metadata = JSON.parse(saveData.metadata);
    expect(metadata.slides).toHaveLength(1);
    expect(metadata.storySettings.backgroundMusic).toBe('track-1.mp3');

    // Тест загрузки
    const loadedStory = loadStoriesFromSave({
      id: 'story-456',
      metadata: saveData.metadata
    });

    expect(loadedStory.storyId).toBe('story-456');
    expect(loadedStory.slides).toHaveLength(1);
    expect(loadedStory.backgroundMusic).toBe('track-1.mp3');
    expect(loadedStory.isNewStory).toBe(false);

    // Тест ошибок
    expect(() => prepareStoriesForSave(storyState, null)).toThrow('Campaign ID обязателен');
    expect(() => loadStoriesFromSave({})).toThrow('Метаданные Stories не найдены');
    expect(() => loadStoriesFromSave({ metadata: 'invalid json' })).toThrow('Некорректные метаданные Stories');
  });
});