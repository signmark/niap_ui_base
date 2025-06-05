FROM node:18-alpine

WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production

# Копируем исходный код
COPY . .

# Создаем директории для uploads и logs
RUN mkdir -p uploads logs

# Устанавливаем права
RUN chown -R node:node /app

USER node

EXPOSE 5000

CMD ["npm", "run", "dev"]