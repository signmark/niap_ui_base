# План интеграции Instagram Stories в существующий интерфейс

## Обзор интеграции

Интегрируем редактор Instagram Stories как новый тип контента в существующий редактор контента, максимально переиспользуя текущую архитектуру и компоненты.

## 1. Изменения в схеме данных

### 1.1 Расширение типа контента в shared/schema.ts
```typescript
// Добавляем новый тип контента
export type ContentType = 'text' | 'text-image' | 'video' | 'video-text' | 'mixed' | 'story';

// Новая структура для Stories
export interface StorySlide {
  id: string;
  order: number;
  background: {
    type: 'color' | 'gradient' | 'image' | 'video';
    value: string; // цвет/градиент/URL
  };
  elements: StoryElement[];
  duration: number; // 1-15 секунд
}

export interface StoryElement {
  id: string;
  type: 'text' | 'image' | 'sticker' | 'poll' | 'question' | 'countdown';
  position: { x: number; y: number };
  size: { width: number; height: number };
  rotation: number;
  content: string | StoryElementData;
  style?: {
    fontSize?: number;
    fontFamily?: string;
    color?: string;
    backgroundColor?: string;
    borderRadius?: number;
  };
}

// Расширяем CampaignContent для поддержки Stories
export interface StoryContent {
  slides: StorySlide[];
  aspectRatio: '9:16'; // Фиксированное соотношение для Stories
  totalDuration: number;
  preview?: string; // URL превью первого слайда
}
```

### 1.2 Обновление campaign_content таблицы
```sql
-- Добавляем новые поля для Stories
ALTER TABLE campaign_content 
ADD COLUMN story_data JSONB,
ADD COLUMN story_preview TEXT;

-- Обновляем ограничение на тип контента
ALTER TABLE campaign_content 
DROP CONSTRAINT IF EXISTS content_type_check;

ALTER TABLE campaign_content 
ADD CONSTRAINT content_type_check 
CHECK (content_type IN ('text', 'text-image', 'video', 'video-text', 'mixed', 'story'));
```

## 2. Интеграция в UI

### 2.1 Добавление Stories в селектор типа контента

**Файл: client/src/pages/content/index.tsx**

Добавляем Stories в существующий интерфейс создания контента:

```typescript
// В диалоге создания контента добавляем новую опцию
const contentTypes = [
  { value: 'text', label: 'Текстовый пост', icon: Type },
  { value: 'text-image', label: 'Пост с изображением', icon: Image },
  { value: 'video', label: 'Видео пост', icon: Video },
  { value: 'story', label: 'Instagram Stories', icon: Smartphone }, // Новый тип
];
```

### 2.2 Условный рендеринг редактора Stories

В зависимости от выбранного типа контента показываем соответствующий редактор:

```typescript
{currentContent?.contentType === 'story' ? (
  <StoriesEditor
    content={currentContent}
    campaignId={selectedCampaignId}
    onChange={handleContentChange}
    onSave={handleSaveContent}
  />
) : (
  // Существующий редактор для других типов контента
  <RichTextEditor ... />
)}
```

## 3. Новые компоненты

### 3.1 StoriesEditor (основной компонент)

**Файл: client/src/components/stories/StoriesEditor.tsx**

```typescript
interface StoriesEditorProps {
  content: CampaignContent;
  campaignId: string;
  onChange: (content: CampaignContent) => void;
  onSave: () => void;
}

export function StoriesEditor({ content, campaignId, onChange, onSave }: StoriesEditorProps) {
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  
  return (
    <div className="stories-editor h-full flex">
      {/* Левая панель - слайды */}
      <StoriesSidebar 
        slides={content.storyData?.slides || []}
        selectedIndex={selectedSlideIndex}
        onSlideSelect={setSelectedSlideIndex}
        onAddSlide={handleAddSlide}
        onDeleteSlide={handleDeleteSlide}
      />
      
      {/* Центральная область - canvas */}
      <StoriesCanvas
        slide={currentSlide}
        selectedElement={selectedElement}
        onElementSelect={setSelectedElement}
        onElementUpdate={handleElementUpdate}
        onElementAdd={handleElementAdd}
      />
      
      {/* Правая панель - инструменты */}
      <StoriesToolbar
        selectedElement={selectedElement}
        onElementStyleChange={handleStyleChange}
        onBackgroundChange={handleBackgroundChange}
      />
    </div>
  );
}
```

### 3.2 StoriesCanvas (холст редактирования)

**Файл: client/src/components/stories/StoriesCanvas.tsx**

```typescript
export function StoriesCanvas({ slide, selectedElement, onElementSelect, onElementUpdate }: StoriesCanvasProps) {
  return (
    <div className="stories-canvas flex-1 flex items-center justify-center bg-gray-100 p-4">
      <div 
        className="stories-frame relative bg-white shadow-lg"
        style={{ 
          width: '270px', 
          height: '480px', // 9:16 соотношение
          borderRadius: '24px',
          overflow: 'hidden'
        }}
      >
        {/* Фон слайда */}
        <StoriesBackground background={slide.background} />
        
        {/* Элементы слайда */}
        {slide.elements.map(element => (
          <StoriesElement
            key={element.id}
            element={element}
            isSelected={selectedElement === element.id}
            onClick={() => onElementSelect(element.id)}
            onUpdate={onElementUpdate}
          />
        ))}
        
        {/* Кнопки добавления элементов */}
        <StoriesElementControls onAddElement={onElementAdd} />
      </div>
    </div>
  );
}
```

### 3.3 Интеграция с существующими компонентами

#### Переиспользуем RichTextEditor для текстовых элементов Stories:

```typescript
// В StoriesElement для type='text'
{element.type === 'text' && (
  <RichTextEditor
    content={element.content}
    onChange={(html) => onUpdate(element.id, { content: html })}
    minHeight={50}
    className="stories-text-element"
  />
)}
```

#### Переиспользуем ImageUploader для фонов и изображений:

```typescript
// В StoriesToolbar для загрузки фонов
<ImageUploader
  onImageUploaded={(url) => onBackgroundChange({ type: 'image', value: url })}
  accept="image/*"
  buttonText="Загрузить фон"
/>
```

## 4. Интеграция с AI генерацией

### 4.1 Расширение ContentGenerationDialog

**Файл: client/src/components/ContentGenerationDialog.tsx**

Добавляем опцию генерации Stories:

```typescript
// Добавляем новый тип генерации
const generationTypes = [
  { value: 'post', label: 'Обычный пост' },
  { value: 'story', label: 'Instagram Stories', description: 'Многослайдовые истории' }
];

// Новая логика генерации для Stories
const generateStoriesContent = async () => {
  const response = await fetch('/api/generate-stories-content', {
    method: 'POST',
    body: JSON.stringify({
      prompt,
      keywords: selectedKeywords,
      campaignId,
      slideCount: 3, // Количество слайдов
      useCampaignData
    })
  });
  
  const data = await response.json();
  return {
    contentType: 'story',
    storyData: data.slides,
    content: data.slides.map(s => s.textContent).join('\n---\n')
  };
};
```

### 4.2 Новый API endpoint для генерации Stories

**Файл: server/routes.ts**

```typescript
// Новый маршрут для генерации Stories контента
app.post('/api/generate-stories-content', authenticateToken, async (req, res) => {
  try {
    const { prompt, keywords, campaignId, slideCount = 3, useCampaignData } = req.body;
    
    // Получаем данные кампании если нужно
    let campaignContext = '';
    if (useCampaignData && campaignId) {
      campaignContext = await getCampaignContext(campaignId);
    }
    
    // Генерируем контент через AI
    const aiPrompt = `
      Создай ${slideCount} слайда для Instagram Stories на тему: ${prompt}
      Ключевые слова: ${keywords.join(', ')}
      ${campaignContext}
      
      Для каждого слайда укажи:
      - Текст (краткий, до 50 символов)
      - Описание визуального оформления
      - Предложения по интерактивным элементам
      
      Формат ответа: JSON массив объектов слайдов
    `;
    
    const generatedContent = await generateWithAI(aiPrompt);
    const slides = parseStoriesFromAI(generatedContent);
    
    res.json({ success: true, slides });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## 5. Интеграция с публикацией

### 5.1 Расширение SocialContentAdaptationDialog

**Файл: client/src/components/SocialContentAdaptationDialog.tsx**

```typescript
// Добавляем специальную логику для Stories
const adaptStoriesForPlatform = (platform: SocialPlatform, storyData: StoryContent) => {
  switch (platform) {
    case 'instagram':
      // Stories изначально для Instagram - без изменений
      return storyData;
    case 'telegram':
      // Конвертируем в карусель сообщений
      return convertStoriesToTelegramCarousel(storyData);
    case 'vk':
      // Конвертируем в альбом с подписями
      return convertStoriesToVKAlbum(storyData);
    case 'facebook':
      // Конвертируем в карусель постов
      return convertStoriesToFacebookCarousel(storyData);
  }
};
```

### 5.2 Обновление логики публикации

**Файл: server/services/social-media-publisher.ts**

```typescript
// Добавляем новый метод для публикации Stories
export async function publishStories(content: CampaignContent, platforms: SocialPlatform[]) {
  const results = {};
  
  for (const platform of platforms) {
    try {
      switch (platform) {
        case 'instagram':
          results[platform] = await publishInstagramStories(content.storyData);
          break;
        case 'telegram':
          results[platform] = await publishTelegramCarousel(content.storyData);
          break;
        // ... другие платформы
      }
    } catch (error) {
      results[platform] = { error: error.message };
    }
  }
  
  return results;
}
```

## 6. Обновления в существующих компонентах

### 6.1 Отображение Stories в списке контента

**Файл: client/src/pages/content/index.tsx**

```typescript
// Добавляем специальную карточку для Stories
{content.contentType === 'story' && (
  <div className="story-preview">
    <div className="story-thumbnail">
      {/* Превью первого слайда */}
      <img src={content.storyPreview} alt="Story preview" />
      <div className="story-slides-count">
        {content.storyData?.slides?.length || 0} слайдов
      </div>
    </div>
  </div>
)}
```

### 6.2 Обновление PublishingStatus

**Файл: client/src/components/PublishingStatus.tsx**

```typescript
// Добавляем специальные иконки для Stories
const getContentTypeIcon = (contentType: ContentType) => {
  switch (contentType) {
    case 'story':
      return <Smartphone className="h-4 w-4" />;
    // ... существующие типы
  }
};
```

## 7. Поэтапный план реализации

### Этап 1: Базовая интеграция (1-2 дня)
1. ✅ Обновление схемы данных
2. ✅ Добавление типа "story" в селектор
3. ✅ Создание базового StoriesEditor компонента
4. ✅ Интеграция с существующим ContentGenerationDialog

### Этап 2: Редактор Stories (2-3 дня)
1. ✅ Реализация StoriesCanvas с drag-and-drop
2. ✅ Создание StoriesToolbar с инструментами
3. ✅ Интеграция существующих компонентов (RichTextEditor, ImageUploader)
4. ✅ Система слайдов и навигация

### Этап 3: AI генерация и публикация (1-2 дня)
1. ✅ API для генерации Stories контента
2. ✅ Адаптация для разных платформ
3. ✅ Интеграция с системой публикации
4. ✅ Обновление отображения в списке контента

### Этап 4: Полировка и тестирование (1 день)
1. ✅ Тестирование интеграции
2. ✅ Исправление багов
3. ✅ Оптимизация производительности
4. ✅ Документация

## 8. Преимущества интеграции

- **Единообразие UX**: Пользователь работает в знакомом интерфейсе
- **Переиспользование кода**: Максимально используем существующие компоненты
- **Общие данные**: Stories используют те же кампании, ключевые слова, AI сервисы
- **Единая система публикации**: Stories попадают в общий планировщик
- **Консистентная аналитика**: Stories отслеживаются той же системой метрик

## 9. Технические детали

### Структура файлов:
```
client/src/components/stories/
├── StoriesEditor.tsx         # Основной редактор
├── StoriesCanvas.tsx         # Холст редактирования
├── StoriesSidebar.tsx        # Панель слайдов
├── StoriesToolbar.tsx        # Панель инструментов
├── StoriesElement.tsx        # Элемент слайда
├── StoriesBackground.tsx     # Фон слайда
└── StoriesPreview.tsx        # Превью для списка контента
```

### Зависимости:
- Переиспользуем все существующие UI компоненты
- Добавляем react-draggable для drag-and-drop
- Используем существующие AI сервисы
- Интегрируемся с текущей системой авторизации и публикации

Готов начинать реализацию. Начать с какого этапа?