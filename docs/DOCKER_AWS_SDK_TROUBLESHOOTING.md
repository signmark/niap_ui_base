# Решение проблем с AWS SDK в Docker-контейнере

Данное руководство описывает процесс исправления проблемы с недоступностью AWS SDK в контейнере Docker.

## Проблема

При запуске приложения в Docker-контейнере может возникнуть ошибка:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@aws-sdk/client-s3' imported from /app/server/services/beget-s3-storage-aws.ts
```

Даже если AWS SDK указан в Dockerfile и установлен во время сборки образа:

```dockerfile
RUN npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner @aws-sdk/lib-storage --save --no-audit
```

## Причина проблемы

Проблема возникает из-за конфликта томов (volumes) в docker-compose.yml:

```yaml
volumes:
  - ./smm:/app
  - /app/node_modules
```

Монтирование локальной директории `./smm` в `/app` приводит к тому, что пакеты, установленные в контейнере, становятся недоступными, так как локальные файлы "перекрывают" файлы контейнера в целевой директории.

## Решение

### 1. Модификация docker-compose.yml

Закомментируйте или удалите строку монтирования node_modules в docker-compose.yml:

```yaml
volumes:
  - ./smm:/app
  #- /app/node_modules  # Закомментировать эту строку
```

### 2. Улучшение Dockerfile

Обновите команду установки AWS SDK в Dockerfile для более надежной установки:

```dockerfile
# Устанавливаем AWS SDK для работы с Beget S3 (приоритетно)
RUN npm install --save --no-audit \
    @aws-sdk/client-s3@3.523.0 \
    @aws-sdk/s3-request-presigner@3.523.0 \
    @aws-sdk/lib-storage@3.523.0 \
    && npm ls @aws-sdk/client-s3 \
    && echo "AWS SDK установлен успешно"
```

Добавьте проверку доступности AWS SDK в Dockerfile:

```dockerfile
# Проверяем доступность AWS SDK
RUN node -e "try { require('@aws-sdk/client-s3'); console.log('AWS SDK client-s3 доступен'); } catch (e) { console.error('Ошибка импорта AWS SDK:', e); process.exit(1); }"
```

### 3. Пересборка образа

После внесения изменений, пересоберите образ без использования кэша:

```bash
docker-compose down
docker-compose build --no-cache smm
docker-compose up -d
```

## Дополнительная информация

### Монтирование томов в Docker

При использовании монтирования томов в Docker важно понимать:

1. При монтировании хост-директории в контейнер (`./smm:/app`), все файлы в целевой директории контейнера перезаписываются файлами с хоста
2. Монтирование `/app/node_modules` (без источника) используется для сохранения node_modules контейнера и предотвращения их перезаписи
3. Если у вас на хосте нет node_modules или они не синхронизированы с контейнером, лучше полностью отключить монтирование node_modules

### Верификация установки пакетов

Для проверки, что AWS SDK корректно установлен и доступен в контейнере:

```bash
docker exec -it root-smm-1 bash -c "npm ls @aws-sdk/client-s3"
```

При успешной установке должен быть выведен путь к установленному пакету.

## Заключение

Правильная настройка монтирования томов в Docker и корректная установка зависимостей в Dockerfile критически важны для работы приложений, использующих внешние библиотеки, такие как AWS SDK.

При возникновении подобных проблем в будущем, проверяйте:
1. Корректность монтирования томов в docker-compose.yml
2. Правильность установки пакетов в Dockerfile
3. Доступность пакетов внутри контейнера через `npm ls` команды