/**
 * Скрипт для тестирования интеграции с Beget S3
 * Проверяет загрузку небольшого текстового файла в хранилище Beget S3
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';

// Функция для вывода информации в консоль
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

async function testBegetS3() {
  log('Начало теста интеграции с Beget S3');
  
  try {
    // Получаем текущую директорию в ES модулях
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    // Создаем временный тестовый файл
    const testFilePath = path.join(__dirname, 'test-upload.txt');
    fs.writeFileSync(testFilePath, 'Тестовый файл для проверки интеграции с Beget S3. ' + new Date().toISOString());
    log(`Создан тестовый файл: ${testFilePath}`);
    
    // Создаем FormData для отправки файла
    const formData = new FormData();
    formData.append('file', fs.createReadStream(testFilePath));
    
    // Сначала получаем токен авторизации
    log('Авторизация пользователя...');
    const authResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'lbrspb@gmail.com',
      password: 'tester12345'
    });
    
    const authToken = authResponse.data.token;
    log('Получен токен авторизации');
    
    // Отправляем запрос на API загрузки
    log('Отправка файла в Beget S3...');
    const response = await axios.post('http://localhost:5000/api/beget-s3/upload', formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${authToken}`
      },
    });
    
    // Выводим результат
    log('Ответ от API:');
    console.log(response.data);
    
    if (response.data && response.data.url) {
      log(`Файл успешно загружен по адресу: ${response.data.url}`);
      
      // Попробуем получить загруженный файл
      log('Проверка доступности файла...');
      const downloadResponse = await axios.get(response.data.url);
      log(`Содержимое файла доступно, размер: ${downloadResponse.data.length} байт`);
      return true;
    } else {
      log('Ошибка при загрузке файла: отсутствует URL в ответе');
      return false;
    }
  } catch (error) {
    log('Ошибка при тестировании интеграции с Beget S3:');
    console.error(error.response ? error.response.data : error.message);
    return false;
  } finally {
    // Удаляем временный файл
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      fs.unlinkSync(path.join(__dirname, 'test-upload.txt'));
      log('Временный файл удален');
    } catch (e) {
      // Игнорируем ошибки при удалении
    }
  }
}

// Запуск теста
testBegetS3()
  .then(success => {
    log(`Тест интеграции с Beget S3 ${success ? 'УСПЕШНО ЗАВЕРШЕН' : 'ЗАВЕРШИЛСЯ С ОШИБКОЙ'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    log('Необработанная ошибка в тесте:');
    console.error(error);
    process.exit(1);
  });