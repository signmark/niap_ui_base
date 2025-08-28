FROM node:18-alpine

WORKDIR /app

# Устанавливаем FFmpeg с поддержкой UTF-8 и шрифтов
RUN apk add --no-cache \
    ffmpeg \
    fontconfig \
    ttf-dejavu \
    font-noto \
    && fc-cache -fv

# Устанавливаем кодировку UTF-8
ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8

# Остальной код как было...
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN mkdir -p uploads/temp uploads/processed uploads/videos logs
RUN chown -R node:node /app
USER node
EXPOSE 5000
CMD ["npm", "run", "dev"]