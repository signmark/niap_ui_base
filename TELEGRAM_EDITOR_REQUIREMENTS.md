# Требования к адаптации редактора для Telegram

## Ограничения Telegram по HTML-форматированию

Telegram API поддерживает очень ограниченный набор HTML-тегов:
- `<b>`, `<strong>` — жирный текст
- `<i>`, `<em>` — курсивный текст
- `<u>` — подчеркнутый текст
- `<s>`, `<strike>`, `<del>` — зачеркнутый текст
- `<a href="...">` — ссылка, обязательно с атрибутом href
- `<code>` — моноширинный текст
- `<pre>` — блок предварительно отформатированного текста

Все остальные HTML-теги и атрибуты **не поддерживаются** и должны быть заменены или удалены.

## Предлагаемые изменения в редакторе

### 1. Создание "Telegram-совместимого" режима редактора

Добавить специальный режим или настройку, которая ограничит возможности форматирования только поддерживаемыми Telegram тегами:

```javascript
// Пример конфигурации для TipTap или подобного редактора
const telegramCompatibleEditorConfig = {
  extensions: [
    StarterKit.configure({
      // Отключаем не поддерживаемые элементы
      heading: false,
      horizontalRule: false,
      blockquote: false,
      codeBlock: false,
      // Включаем только базовые форматы
      bold: true,
      italic: true,
      strike: true,
      code: true,
    }),
    // Добавляем поддерживаемые Telegram элементы
    Underline.configure(),
    Link.configure({
      // Принудительно добавляем проверку наличия href
      validate: (url) => !!url,
    }),
    // Добавляем пользовательский расширение для простых списков
    SimpleList.configure({
      // Использовать символы вместо HTML-списков
      useMarkers: true,
      markers: ['•', '◦', '▪']
    }),
  ],
}
```

### 2. Кастомный расширение для обработки списков в Telegram-формате

Создать специальное расширение, которое будет заменять HTML-списки на текстовые списки с маркерами:

```javascript
// Пример расширения для TipTap
export const SimpleList = Extension.create({
  name: 'simpleList',
  
  addCommands() {
    return {
      toggleBulletList: () => ({ commands }) => {
        return commands.toggleList('bulletList', 'listItem')
      },
    }
  },
  
  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement('ul')
      
      const items = node.content.content.map(item => {
        const li = document.createElement('li')
        // Добавляем маркер вместо HTML-тега
        li.textContent = '• ' + item.textContent
        return li
      })
      
      items.forEach(item => dom.appendChild(item))
      
      return {
        dom,
        update: (node) => {
          // Обновление при изменении содержимого
        },
      }
    }
  },
})
```

### 3. Кнопки форматирования для Telegram-совместимых элементов

Обновить панель инструментов редактора, чтобы показывались только действительно поддерживаемые Telegram форматы:

```jsx
// Пример React-компонента для панели инструментов
const TelegramToolbar = ({ editor }) => {
  if (!editor) return null
  
  return (
    <div className="telegram-editor-toolbar">
      <button 
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={editor.isActive('bold') ? 'is-active' : ''}
      >
        <BoldIcon />
      </button>
      
      <button 
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={editor.isActive('italic') ? 'is-active' : ''}
      >
        <ItalicIcon />
      </button>
      
      <button 
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={editor.isActive('underline') ? 'is-active' : ''}
      >
        <UnderlineIcon />
      </button>
      
      <button 
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={editor.isActive('strike') ? 'is-active' : ''}
      >
        <StrikeIcon />
      </button>
      
      <button 
        onClick={() => editor.chain().focus().toggleCode().run()}
        className={editor.isActive('code') ? 'is-active' : ''}
      >
        <CodeIcon />
      </button>
      
      {/* Пользовательские кнопки для создания маркированных списков */}
      <button 
        onClick={() => editor.chain().focus().toggleSimpleList().run()}
        className={editor.isActive('simpleList') ? 'is-active' : ''}
      >
        <ListBulletIcon />
      </button>
      
      <button onClick={() => {
        const url = window.prompt('URL:')
        if (url) {
          editor.chain().focus().toggleLink({ href: url }).run()
        }
      }}>
        <LinkIcon />
      </button>
    </div>
  )
}
```

### 4. Валидация и предпросмотр Telegram-форматирования

Добавить функциональность для валидации и предпросмотра контента в формате Telegram:

```javascript
/**
 * Проверяет, соответствует ли HTML Telegram-формату
 * @param {string} html HTML-контент для проверки
 * @returns {boolean} true если контент валидный
 */
function validateTelegramHtml(html) {
  // Регулярное выражение для проверки на наличие неподдерживаемых тегов
  const unsupportedTagsRegex = /<(?!b|\/b|strong|\/strong|i|\/i|em|\/em|u|\/u|s|\/s|strike|\/strike|del|\/del|a|\/a|code|\/code|pre|\/pre)[a-z][^>]*>/i
  
  return !unsupportedTagsRegex.test(html)
}

/**
 * Функция предпросмотра Telegram-форматирования
 * @param {string} html HTML-контент для предпросмотра
 * @returns {React.Component} Компонент с предпросмотром
 */
function TelegramPreview({ html }) {
  // Преобразуем HTML в телеграм-совместимый формат
  const telegramHtml = convertToTelegramHtml(html)
  
  return (
    <div className="telegram-preview">
      <div className="telegram-preview-header">
        <h3>Предпросмотр в Telegram</h3>
      </div>
      <div className="telegram-message-container">
        <div className="telegram-message">
          <div 
            className="telegram-message-content"
            dangerouslySetInnerHTML={{ __html: telegramHtml }}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * Преобразует произвольный HTML в телеграм-совместимый
 * @param {string} html HTML-контент для преобразования
 * @returns {string} Телеграм-совместимый HTML
 */
function convertToTelegramHtml(html) {
  // Заменяем эквивалентные теги
  let result = html
    .replace(/<strong>(.*?)<\/strong>/g, '<b>$1</b>')
    .replace(/<em>(.*?)<\/em>/g, '<i>$1</i>')
    .replace(/<strike>(.*?)<\/strike>/g, '<s>$1</s>')
    .replace(/<del>(.*?)<\/del>/g, '<s>$1</s>')
  
  // Заменяем неподдерживаемые теги и атрибуты
  result = result.replace(/<([a-z][a-z0-9]*)(?: .*?)?>/gi, (match, tagName) => {
    const lowerTag = tagName.toLowerCase()
    if (['b', 'i', 'u', 's', 'code', 'pre'].includes(lowerTag)) {
      return `<${lowerTag}>`
    } else if (lowerTag === 'a') {
      // Обрабатываем ссылки отдельно, сохраняя href
      const hrefMatch = match.match(/href\s*=\s*["']([^"']*)["']/i)
      if (hrefMatch) {
        return `<a href="${hrefMatch[1]}">`
      }
      return ''
    } else if (['p', 'div', 'br'].includes(lowerTag)) {
      // Заменяем блочные элементы на переносы строк
      return lowerTag === 'br' ? '\n' : '\n\n'
    }
    return ''
  })
  
  // Заменяем закрывающие теги
  result = result.replace(/<\/([a-z][a-z0-9]*)>/gi, (match, tagName) => {
    const lowerTag = tagName.toLowerCase()
    if (['b', 'i', 'u', 's', 'a', 'code', 'pre'].includes(lowerTag)) {
      return `</${lowerTag}>`
    }
    return ''
  })
  
  // Заменяем маркированные списки на текстовый формат
  result = result.replace(/<ul>(.*?)<\/ul>/gs, (match, content) => {
    return content.replace(/<li>(.*?)<\/li>/gs, '• $1\n')
  })
  
  // Заменяем нумерованные списки
  result = result.replace(/<ol>(.*?)<\/ol>/gs, (match, content) => {
    let index = 1
    return content.replace(/<li>(.*?)<\/li>/gs, () => `${index++}. $1\n`)
  })
  
  // Удаляем лишние переносы строк
  result = result.replace(/\n{3,}/g, '\n\n')
  
  return result
}
```

### 5. Интеграция с выбором соцсетей при публикации

Добавить возможность выбора целевых социальных сетей при создании контента, чтобы редактор автоматически адаптировал форматирование под выбранные платформы:

```jsx
// Пример компонента для выбора платформ
function PlatformSelector({ onChange, value }) {
  const platforms = [
    { id: 'telegram', name: 'Telegram', icon: <TelegramIcon /> },
    { id: 'vk', name: 'ВКонтакте', icon: <VkIcon /> },
    { id: 'instagram', name: 'Instagram', icon: <InstagramIcon /> },
    // Другие платформы
  ]
  
  return (
    <div className="platform-selector">
      <h3>Выберите платформы для публикации</h3>
      <div className="platform-options">
        {platforms.map(platform => (
          <label key={platform.id} className="platform-option">
            <input
              type="checkbox"
              checked={value.includes(platform.id)}
              onChange={() => {
                const newValue = value.includes(platform.id)
                  ? value.filter(p => p !== platform.id)
                  : [...value, platform.id]
                onChange(newValue)
              }}
            />
            <span className="platform-icon">{platform.icon}</span>
            <span className="platform-name">{platform.name}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

// Использование в форме создания контента
function ContentForm() {
  const [selectedPlatforms, setSelectedPlatforms] = useState(['telegram'])
  const [content, setContent] = useState('')
  
  // Определяем конфигурацию редактора в зависимости от выбранных платформ
  const editorConfig = useMemo(() => {
    if (selectedPlatforms.includes('telegram')) {
      return telegramCompatibleEditorConfig
    }
    // Конфигурации для других платформ
    return defaultEditorConfig
  }, [selectedPlatforms])
  
  return (
    <div className="content-form">
      <PlatformSelector
        value={selectedPlatforms}
        onChange={setSelectedPlatforms}
      />
      
      <Editor
        config={editorConfig}
        value={content}
        onChange={setContent}
      />
      
      {/* Показываем предпросмотр для Telegram если он выбран */}
      {selectedPlatforms.includes('telegram') && (
        <TelegramPreview html={content} />
      )}
      
      <button type="submit">Опубликовать</button>
    </div>
  )
}
```

## План внедрения

1. **Анализ текущего редактора**
   - Определить используемую библиотеку редактора (TipTap, Draft.js, Quill и т.д.)
   - Выявить текущую структуру конфигурации и расширений

2. **Создание Telegram-совместимой конфигурации**
   - Реализовать ограниченный набор форматирования
   - Разработать механизм конвертации для списков

3. **Реализация валидации и предпросмотра**
   - Создать функциональность для проверки совместимости с Telegram
   - Разработать компонент предпросмотра в стиле Telegram

4. **Интеграция с выбором платформ**
   - Добавить селектор целевых платформ
   - Реализовать динамическое переключение конфигурации редактора

5. **Тестирование**
   - Проверить корректность форматирования в редакторе
   - Протестировать отправку в Telegram с разными комбинациями форматирования

## Совместимость с другими платформами

Данное решение можно расширить для поддержки других социальных сетей, создав отдельные конфигурации для каждой платформы:

- **ВКонтакте**: поддерживает более широкий набор форматирования, включая заголовки
- **Instagram**: без поддержки форматирования для подписей к изображениям
- **Facebook**: ограниченная поддержка HTML в публикациях

Для каждой платформы можно создать собственный набор инструментов форматирования и предпросмотр в соответствующем стиле.