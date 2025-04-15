# Руководство по установке и настройке Beget S3

## Общая информация

[Beget S3](https://beget.com/ru/s3-storage) - это облачное хранилище, совместимое с API Amazon S3, предоставляемое хостинг-провайдером Beget. Оно используется в проекте для хранения изображений, видео и других файлов.

## Получение доступа к Beget S3

1. Зарегистрируйтесь или войдите в панель управления [Beget](https://beget.com/ru)
2. Перейдите в раздел "S3 хранилище" в панели управления
3. Создайте новое хранилище, если оно еще не создано
4. Получите ключи доступа (Access Key и Secret Key)

## Настройка проекта для работы с Beget S3

### Переменные окружения

Убедитесь, что в файле `.env` настроены следующие переменные:

```
BEGET_S3_ACCESS_KEY=9GKH5CY@27DGMDRR7682
BEGET_S3_SECRET_KEY=wNgp3IoHQDDr3gWAqUe@r0Ckt5oy5dWhPRULHRS9
BEGET_S3_BUCKET=ваш-бакет
BEGET_S3_ENDPOINT=https://s3.ru1.storage.beget.cloud
BEGET_S3_REGION=ru-1
```

### Необходимые пакеты

Для работы с Beget S3 в проекте используются следующие пакеты AWS SDK:

```
@aws-sdk/client-s3
@aws-sdk/s3-request-presigner
@aws-sdk/lib-storage
```

### Проверка установки

После настройки переменных окружения и установки необходимых пакетов, проверьте работу с хранилищем:

1. Запустите приложение
2. Авторизуйтесь в системе
3. Попробуйте загрузить тестовый файл через один из интерфейсов загрузки

## Особенности работы с Beget S3

### Формат URL

URL для доступа к файлам в хранилище имеет формат:
```
https://<имя-бакета>.s3.<регион>.storage.beget.cloud/<путь-к-файлу>
```

Пример:
```
https://my-bucket.s3.ru1.storage.beget.cloud/images/photo.jpg
```

### Права доступа к файлам

Для обеспечения публичного доступа к файлам при загрузке необходимо указывать параметр `ACL: 'public-read'`. Это позволит получать доступ к файлам без аутентификации.

### Поддерживаемые операции

Beget S3 поддерживает основные операции S3 API:
- Загрузка файлов (`PutObject`)
- Скачивание файлов (`GetObject`)
- Удаление файлов (`DeleteObject`)
- Получение списка файлов (`ListObjects`)
- Генерация временных URL (`GetSignedUrl`)

## Типичные ошибки и их решения

### Error: Cannot find module '@aws-sdk/client-s3'

**Причина**: Отсутствуют необходимые пакеты AWS SDK.

**Решение**: Установите пакеты через npm:
```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner @aws-sdk/lib-storage --save
```

### AccessDenied при доступе к файлам

**Причина**: Недостаточные права доступа либо неверные ключи.

**Решение**:
1. Проверьте правильность ключей доступа
2. Убедитесь, что при загрузке файла указан параметр `ACL: 'public-read'`
3. Проверьте настройки прав доступа в панели управления Beget S3

### CredentialsProviderError

**Причина**: Неверные учетные данные или их формат.

**Решение**: Проверьте формат и значения переменных `BEGET_S3_ACCESS_KEY` и `BEGET_S3_SECRET_KEY` в файле `.env`.

## Дополнительная информация

- [Официальная документация Beget S3](https://beget.com/ru/kb/s3-storage)
- [AWS SDK для JavaScript/TypeScript](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [Примеры использования AWS S3 SDK](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/s3-examples.html)