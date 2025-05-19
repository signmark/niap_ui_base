# Используем актуальную версию Node.js
FROM node:18

# Устанавливаем рабочий каталог
WORKDIR /app

# Устанавливаем системные зависимости через apt
RUN apt-get update && \
    apt-get install -y python3 make g++ ffmpeg curl wget && \
    rm -rf /var/lib/apt/lists/*

# Копируем package.json и package-lock.json
COPY package*.json ./

# Очищаем существующие node_modules и lock-файлы для чистой установки
RUN rm -rf node_modules package-lock.json

# Устанавливаем зависимости
RUN npm install --no-audit --verbose

# Явно устанавливаем react-draggable
RUN npm install react-draggable@4.4.6 --save --no-audit

# Явно устанавливаем multer
RUN npm install multer@1.4.5-lts.2 @types/multer@1.4.12 --save --no-audit

# Явно устанавливаем @google/generative-ai для интеграции с Gemini и socks-proxy-agent для работы через SOCKS5 прокси
RUN npm install @google/generative-ai socks-proxy-agent --save --no-audit

# Устанавливаем emoji-picker-react
RUN npm install emoji-picker-react --save --no-audit

# Устанавливаем AWS SDK для работы с Beget S3 (приоритетно)
RUN npm install --save --no-audit \
    @aws-sdk/client-s3@3.523.0 \
    @aws-sdk/s3-request-presigner@3.523.0 \
    @aws-sdk/lib-storage@3.523.0 \
    && npm ls @aws-sdk/client-s3 \
    && echo "AWS SDK установлен успешно"

# Устанавливаем библиотеки Nivo для визуализации аналитики
RUN npm install --save --no-audit \
    @nivo/pie @nivo/bar @nivo/line \
    @nivo/core @nivo/colors @nivo/scales \
    d3-scale d3-shape d3-time-format \
    && echo "Nivo библиотеки установлены успешно"

# Проверяем наличие библиотек
RUN npm ls react-draggable && npm ls multer && npm ls @google/generative-ai && npm ls socks-proxy-agent && npm ls @aws-sdk/client-s3 && npm ls emoji-picker-react

# Проверяем наличие ffmpeg
RUN ffmpeg -version

# Копируем исходный код
COPY . .

# Проверяем доступность AWS SDK
RUN node -e "try { require('@aws-sdk/client-s3'); console.log('AWS SDK client-s3 доступен'); } catch (e) { console.error('Ошибка импорта AWS SDK client-s3:', e); process.exit(1); }"
RUN node -e "try { require('@aws-sdk/lib-storage'); console.log('AWS SDK lib-storage доступен'); } catch (e) { console.error('Ошибка импорта AWS SDK lib-storage:', e); process.exit(1); }"

# Экспортируем порт для приложения
EXPOSE 5000

# Команда для сборки и запуска приложения
CMD ["npm", "run", "dev"]