# Файлы для добавления в Git

## Для полного понимания проекта новым агентом добавьте эти файлы:

### 🔧 Конфигурационные файлы
- [ ] `package.json` - зависимости проекта
- [ ] `tsconfig.json` - настройки TypeScript  
- [ ] `vite.config.ts` - конфигурация сборщика
- [ ] `.env.template` - шаблон переменных окружения

### 🐳 Docker и развертывание
- [ ] `Dockerfile` - основной образ приложения
- [ ] `deploy/Dockerfile` - продакшн образ

### 📚 Документация
- [ ] `replit.md` - архитектура проекта ✅
- [ ] `README.md` - основное описание
- [ ] `ARCHITECTURE_SIMPLIFICATION_PLAN.md` - план архитектуры
- [ ] `DEPLOYMENT_GUIDE.md` - руководство по развертыванию

### 🖥️ Серверная часть
- [ ] `server/index.ts` - точка входа сервера
- [ ] `server/api/` - папка с API роутами (вся папка)
- [ ] `server/middleware/` - middleware (вся папка)
- [ ] `server/routes/` - дополнительные роуты (вся папка)
- [ ] `server/directus.ts` - интеграция с Directus

### 🎨 Клиентская часть
- [ ] `client/src/App.tsx` - главный компонент
- [ ] `client/src/main.tsx` - точка входа
- [ ] `client/src/index.css` - глобальные стили
- [ ] `client/src/types.ts` - типы TypeScript
- [ ] `client/src/components/stories/` - Stories редактор (вся папка)
- [ ] `client/src/utils/` - утилиты (вся папка)
- [ ] `client/src/lib/` - библиотеки (вся папка)
- [ ] `client/src/hooks/` - хуки React (вся папка)
- [ ] `client/src/pages/` - страницы (вся папка)

### 📝 Скрипты
- [ ] `git-add-all-files.sh` - скрипт для добавления файлов

## Как добавить:

### Через интерфейс Replit:
1. Откройте панель Version Control (иконка с ветками)
2. Выберите файлы из списка выше
3. Добавьте commit message: "Add core project files for new agent onboarding"
4. Нажмите Commit

### Через терминал (если возможно):
```bash
./git-add-all-files.sh
```

**Результат**: Новый агент сможет полностью понять архитектуру проекта, настройки, зависимости и ключевые компоненты.