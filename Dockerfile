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

# Устанавливаем зависимости из package.json
RUN npm ci --no-audit --verbose

# Проверяем наличие ключевых зависимостей
RUN npm ls google-auth-library && npm ls gtoken && npm ls @google/generative-ai

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