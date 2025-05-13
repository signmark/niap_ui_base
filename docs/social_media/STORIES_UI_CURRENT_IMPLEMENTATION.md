# Техническое задание: Реализация UI для Instagram Stories в текущей структуре SMM Manager

## 1. Анализ текущего состояния

### 1.1 Существующие типы контента
В системе уже определены следующие типы контента (`ContentType`):
- `'text'` - текстовый контент
- `'text-image'` - текст с изображением
- `'video'` - видеоконтент
- `'video-text'` - видеоконтент с текстом
- `'mixed'` - смешанный контент
- `'stories'` - тип для Stories (уже определен в системе)

### 1.2 Существующие компоненты публикации
Публикация контента происходит через:
- Компонент `SocialPublishingPanel` - панель выбора платформ публикации
- Компонент `ContentGenerationPanel` - панель генерации нового контента
- Формы планирования публикаций с выбором даты и платформы

### 1.3 Текущая логика обработки платформ
- Платформы для публикации: `instagram`, `telegram`, `vk`, `facebook`
- Каждая платформа имеет свой флаг выбора в интерфейсе
- Форматирование контента происходит с учетом особенностей каждой платформы
- Текущие компоненты календаря учитывают тип контента и присваивают цвета (`stories` уже имеет цвет `bg-purple-500`)

## 2. Модификации для поддержки Instagram Stories

### 2.1 Изменения интерфейса создания контента

#### 2.1.1 Форма создания контента
Модифицировать компонент формы создания/редактирования контента:

```tsx
// В компоненте формы создания контента
<FormField
  control={form.control}
  name="contentType"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Тип контента</FormLabel>
      <Select
        value={field.value}
        onValueChange={(value) => {
          field.onChange(value);
          // Если выбран тип stories, ограничиваем платформы только Instagram
          if (value === 'stories') {
            form.setValue('platforms', ['instagram']);
            setStoriesMode(true);
          } else {
            setStoriesMode(false);
          }
        }}
      >
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder="Выберите тип контента" />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          <SelectItem value="text">Текст</SelectItem>
          <SelectItem value="text-image">Текст с изображением</SelectItem>
          <SelectItem value="video">Видео</SelectItem>
          <SelectItem value="video-text">Видео с текстом</SelectItem>
          <SelectItem value="mixed">Смешанный контент</SelectItem>
          <SelectItem value="stories">
            <div className="flex items-center">
              <span className="text-purple-500 mr-1">
                <InstagramIcon className="h-4 w-4" />
              </span>
              Instagram Stories
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>
```

#### 2.1.2 Ограничения выбора платформ для Stories
Добавить компонент-обертку для выбора платформ:

```tsx
{/* Компонент выбора платформ */}
<FormField
  control={form.control}
  name="platforms"
  render={() => (
    <FormItem>
      <FormLabel>Платформы для публикации</FormLabel>
      {storiesMode ? (
        <div className="border rounded-md p-3 bg-gray-50">
          <div className="flex items-center">
            <Checkbox
              checked={true}
              disabled={true}
              id="instagram-stories"
            />
            <Label htmlFor="instagram-stories" className="ml-2 flex items-center">
              <SiInstagram className="h-4 w-4 text-pink-600 mr-1" />
              Instagram
              <Badge variant="outline" className="ml-2 bg-purple-100">Stories</Badge>
            </Label>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Stories могут быть опубликованы только в Instagram
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Стандартный список платформ */}
          {platformOptions.map((platform) => (
            <FormField
              key={platform.id}
              control={form.control}
              name="platforms"
              render={({ field }) => {
                return (
                  <FormItem key={platform.id} className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value?.includes(platform.id)}
                        onCheckedChange={(checked) => {
                          const current = field.value || [];
                          const updated = checked
                            ? [...current, platform.id]
                            : current.filter(value => value !== platform.id);
                          field.onChange(updated);
                        }}
                      />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer">
                      {platform.label}
                    </FormLabel>
                  </FormItem>
                );
              }}
            />
          ))}
        </div>
      )}
      <FormMessage />
    </FormItem>
  )}
/>
```

#### 2.1.3 Расширенные опции загрузки медиа для Stories
Добавить компонент для загрузки медиа с учетом вертикального формата Stories:

```tsx
{/* Загрузка медиа контента */}
<FormField
  control={form.control}
  name="additionalMedia"
  render={({ field }) => (
    <FormItem>
      <FormLabel>{storiesMode ? 'Загрузить Stories' : 'Медиа контент'}</FormLabel>
      <FormControl>
        <MediaUploader
          value={field.value || []}
          onChange={field.onChange}
          aspectRatio={storiesMode ? "9/16" : "16/9"}
          maxFiles={storiesMode ? 1 : 10}
          allowedTypes={storiesMode ? ['image', 'video'] : ['image', 'video']}
          maxVideoLength={storiesMode ? 15 : 60} // 15 секунд для Stories
          helpText={storiesMode ? 
            "Загрузите изображение или видео (до 15 секунд) для Stories. Рекомендуемый формат 9:16." : 
            "Загрузите изображения и/или видео для публикации"
          }
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

### 2.2 Модификации интерфейса публикации

#### 2.2.1 Панель публикации контента (SocialPublishingPanel)
Добавить обнаружение и блокировку выбора платформ для Stories:

```tsx
// В начале компонента
const isStoriesContent = content?.contentType === 'stories' || 
  content?.content_type === 'stories' || 
  content?.title?.includes('[STORIES]') || 
  content?.title?.includes('#stories');

// В разделе чекбоксов платформ
<div className="flex items-center space-x-2">
  <Checkbox 
    id="instagram" 
    checked={isStoriesContent || selectedPlatforms.includes('instagram')}
    disabled={isStoriesContent} // Блокируем изменение для Stories
    onCheckedChange={() => handlePlatformChange('instagram')}
  />
  <Label htmlFor="instagram" className="flex items-center">
    Instagram
    {isStoriesContent && (
      <Badge variant="outline" className="ml-2 bg-purple-100">Stories</Badge>
    )}
  </Label>
</div>

{/* Остальные платформы */}
{!isStoriesContent && (
  <>
    <div className="flex items-center space-x-2">
      <Checkbox 
        id="telegram" 
        checked={selectedPlatforms.includes('telegram')}
        onCheckedChange={() => handlePlatformChange('telegram')}
      />
      <Label htmlFor="telegram">Telegram</Label>
    </div>
    {/* Аналогично для vk и facebook */}
  </>
)}

{/* Информационное сообщение при Stories */}
{isStoriesContent && (
  <Alert variant="info" className="mt-4">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>Instagram Stories</AlertTitle>
    <AlertDescription>
      Контент типа Stories может быть опубликован только в Instagram. Другие платформы недоступны.
    </AlertDescription>
  </Alert>
)}
```

#### 2.2.2 Планировщик публикаций
Модифицировать компонент планирования публикаций для учета ограничений Stories:

```tsx
// В компоненте планирования
// Проверка на тип Stories
const isStoriesContent = content?.contentType === 'stories' || 
  content?.content_type === 'stories' || 
  content?.title?.includes('[STORIES]') || 
  content?.title?.includes('#stories');

// При инициализации платформ для контента типа Stories
useEffect(() => {
  if (isStoriesContent) {
    // Устанавливаем только Instagram для Stories
    setSelectedPlatforms({ instagram: true, telegram: false, vk: false, facebook: false });
  }
}, [isStoriesContent]);

// В разделе выбора платформ
<div className="mt-4">
  <h3 className="text-sm font-medium mb-2">Платформы для публикации</h3>
  <div className="space-y-2">
    <div className="flex items-center">
      <Checkbox
        id="schedule-instagram"
        checked={selectedPlatforms.instagram}
        disabled={isStoriesContent} // Блокируем изменение для Stories
        onCheckedChange={(checked) => 
          setSelectedPlatforms({...selectedPlatforms, instagram: !!checked})
        }
      />
      <Label htmlFor="schedule-instagram" className="ml-2 flex items-center">
        Instagram
        {isStoriesContent && (
          <Badge variant="outline" className="ml-2 bg-purple-100">Stories</Badge>
        )}
      </Label>
    </div>
    
    {!isStoriesContent && (
      <>
        {/* Остальные платформы */}
        <div className="flex items-center">
          <Checkbox
            id="schedule-telegram"
            checked={selectedPlatforms.telegram}
            onCheckedChange={(checked) => 
              setSelectedPlatforms({...selectedPlatforms, telegram: !!checked})
            }
          />
          <Label htmlFor="schedule-telegram" className="ml-2">Telegram</Label>
        </div>
        {/* Аналогично для vk и facebook */}
      </>
    )}
  </div>
  
  {isStoriesContent && (
    <p className="text-xs text-muted-foreground mt-2">
      Stories автоматически публикуются только в Instagram, независимо от выбора других платформ.
    </p>
  )}
</div>
```

### 2.3 Компоненты предпросмотра для Stories

#### 2.3.1 Предпросмотр Stories
Создать новый компонент предпросмотра для Stories:

```tsx
// StoriesPreview.tsx
export function StoriesPreview({ content, media }) {
  return (
    <div className="relative w-full max-w-[320px] mx-auto">
      <div 
        className="relative bg-gray-100 rounded-xl overflow-hidden aspect-[9/16] shadow-lg"
        style={{ maxHeight: '70vh' }}
      >
        {/* Instagram-подобный фон и интерфейс */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-transparent h-12 z-10"></div>
        
        {/* Медиа контент */}
        {media && media.length > 0 && media[0].type === 'image' ? (
          <img 
            src={media[0].url} 
            alt="Instagram Story"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : media && media.length > 0 && media[0].type === 'video' ? (
          <video
            src={media[0].url}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay
            loop
            muted
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-purple-500 to-pink-500"></div>
        )}
        
        {/* Заголовок Stories */}
        <div className="absolute inset-x-0 top-14 px-4 z-20">
          <h3 className="text-white text-xl font-bold drop-shadow-md">
            {content.title?.replace('[STORIES]', '').replace('#stories', '')}
          </h3>
        </div>
        
        {/* Текст контента */}
        <div className="absolute inset-x-0 bottom-12 px-4 z-20">
          <div 
            className="text-white text-sm bg-black/30 p-3 rounded-lg backdrop-blur-sm"
            dangerouslySetInnerHTML={{
              __html: content.content
            }}
          />
        </div>
        
        {/* Индикатор Stories */}
        <div className="absolute top-2 inset-x-0 flex space-x-1 px-2 z-30">
          <div className="flex-1 h-1 bg-white rounded-full opacity-80"></div>
        </div>
      </div>
      
      <div className="mt-3 text-center text-xs text-muted-foreground">
        Предпросмотр Instagram Stories
      </div>
    </div>
  );
}
```

#### 2.3.2 Интеграция предпросмотра в форму редактирования
Добавить условный рендеринг для предпросмотра Stories:

```tsx
// В форме редактирования/создания контента
<Tabs defaultValue="content" className="mt-6">
  <TabsList>
    <TabsTrigger value="content">Контент</TabsTrigger>
    <TabsTrigger value="preview">Предпросмотр</TabsTrigger>
    {form.watch('contentType') === 'stories' && (
      <TabsTrigger value="stories-preview" className="text-purple-500">
        Stories
      </TabsTrigger>
    )}
  </TabsList>
  
  <TabsContent value="content">
    {/* Существующая форма редактирования */}
  </TabsContent>
  
  <TabsContent value="preview">
    {/* Стандартный предпросмотр */}
  </TabsContent>
  
  {form.watch('contentType') === 'stories' && (
    <TabsContent value="stories-preview" className="flex justify-center">
      <StoriesPreview 
        content={{
          title: form.watch('title'),
          content: form.watch('content')
        }}
        media={form.watch('additionalMedia')}
      />
    </TabsContent>
  )}
</Tabs>
```

### 2.4 Календарь и список запланированных публикаций

#### 2.4.1 Модификация отображения Stories в календаре
Расширить компонент отображения публикаций в календаре:

```tsx
// В компоненте PublicationCalendar.tsx
// Обновить функцию getColorForType
const getColorForType = (type: string): string => {
  switch (type) {
    case 'text': return 'bg-blue-500';
    case 'text-image': return 'bg-yellow-500';
    case 'video': 
    case 'video-text': return 'bg-red-500';
    case 'stories': return 'bg-gradient-to-r from-purple-500 to-pink-500'; // Градиент для Stories
    default: return 'bg-gray-500';
  }
};

// В компоненте отображения содержимого дня
{isStories && (
  <div className="absolute -top-1 -right-1 text-xs">
    <InstagramIcon className="h-3 w-3 text-pink-600" />
  </div>
)}
```

#### 2.4.2 Отображение информации о Stories в списке публикаций
Модифицировать компонент `ScheduledPostInfo.tsx`:

```tsx
// В компоненте отображения информации о публикации
// Добавить определение для Stories
const isStories = post.contentType === 'stories' || 
  post.title?.includes('[STORIES]') || 
  post.title?.includes('#stories');

// В разделе отображения платформ
{Object.entries(platformStatuses).map(([platform, status]) => {
  // Не показываем неактивные платформы для Stories
  if (isStories && platform !== 'instagram') return null;
  
  return (
    <TooltipProvider key={platform}>
      <Tooltip>
        <TooltipTrigger>
          <div className={`relative rounded-full p-1 ${getStatusColor(status.status)}`}>
            {getPlatformIcon(platform)}
            {isStories && platform === 'instagram' && (
              <div className="absolute -top-1 -right-1 text-xs bg-purple-500 rounded-full w-2 h-2"></div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">
            {getPlatformName(platform)}
            {isStories && platform === 'instagram' && (
              <span className="ml-1 text-xs text-purple-500 font-normal">Stories</span>
            )}
          </p>
          {/* Остальное содержимое тултипа */}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
})}
```

## 3. Необходимые изменения в существующих компонентах

### 3.1 Функции определения типа Stories
Создать вспомогательную функцию для определения контента типа Stories:

```tsx
// В utils.ts или отдельном файле
export function isStoriesContent(content: any): boolean {
  return content?.contentType === 'stories' ||
    content?.content_type === 'stories' ||
    content?.type === 'stories' ||
    content?.isStories === true ||
    content?.hasStories === true ||
    (typeof content?.title === 'string' && (
      content.title.includes('[STORIES]') || 
      content.title.includes('#stories')
    ));
}
```

### 3.2 Обновление типов в shared/types.ts
Обеспечить корректное определение типа Stories в системе типов:

```tsx
// В types.ts (уже существует)
export type ContentType = 'text' | 'text-image' | 'video' | 'video-text' | 'mixed' | 'stories';

// При необходимости добавить метаданные Stories
export interface StoriesMetadata {
  expiresAt?: string; // Время истечения 24-часового периода
  views?: number;    // Количество просмотров
  replies?: number;  // Количество ответов
}

// Расширить интерфейс CampaignContent
export interface CampaignContent {
  // Существующие поля
  // ...
  
  // Поля для Stories
  storiesMetadata?: StoriesMetadata;
}
```

### 3.3 Ограничения для валидации
Добавить валидацию специфичную для Stories:

```tsx
// В схемах валидации для Stories
const storiesValidationSchema = z.object({
  title: z.string().min(1, "Заголовок обязателен"),
  content: z.string().max(2200, "Максимальная длина текста для Instagram Stories - 2200 символов"),
  contentType: z.literal('stories'),
  platforms: z.array(z.string()).refine(
    (val) => val.includes('instagram') && val.length === 1,
    "Stories могут быть опубликованы только в Instagram"
  ),
  additionalMedia: z.array(
    z.object({
      url: z.string(),
      type: z.enum(['image', 'video']),
      // Дополнительные ограничения для Stories
    })
  ).min(1, "Для Stories необходимо загрузить хотя бы одно медиа").max(1, "Stories поддерживают только один медиафайл"),
});
```

## 4. Приоритизация и этапы внедрения

### 4.1 Первый этап (MVP)
- Добавление типа контента Stories в формы создания и редактирования
- Базовая логика ограничения выбора платформ для Stories
- Стилизация и отметки для Stories в календаре и списках

### 4.2 Второй этап
- Создание специализированного предпросмотра Stories
- Адаптация загрузчика медиа для вертикального формата
- Расширение аналитики для Stories

### 4.3 Третий этап
- Добавление информации о сроке действия Stories (24 часа)
- Интеграция с существующими инструментами аналитики
- Оптимизация мобильного опыта

## 5. Интеграция с бэкендом

### 5.1 Использование существующих API
- API создания и редактирования контента остаются без изменений, только тип `contentType: 'stories'`
- API публикации контента должен учитывать тип Stories и ограничивать платформы только Instagram

### 5.2 Специфичная для Stories логика на бэкенде
- Бэкенд должен игнорировать попытки публикации Stories не в Instagram 
- Установка статуса 'не поддерживается' для других платформ при типе Stories

## 6. Критерии приемки

- Пользователь может создать, отредактировать и опубликовать Stories через UI
- Выбор платформ автоматически ограничивается до Instagram для контента типа Stories
- Календарь и списки публикаций корректно отображают Stories с соответствующим стилем
- Предпросмотр Stories отображает контент в вертикальном формате 9:16
- Интерфейс предотвращает попытки публикации Stories не в Instagram