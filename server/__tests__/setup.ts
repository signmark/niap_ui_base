/**
 * Настройка тестового окружения
 * Содержит общие моки и утилиты для тестирования
 */

import axios from 'axios';
import { DirectusAuthManager } from '../services/directus-auth-manager';
import path from 'path';
import fs from 'fs';

// Настройки окружения и константы для тестов
const TEST_USER_EMAIL = 'test@example.com';
const TEST_USER_PASSWORD = 'test_password';
const TEST_USER_ID = 'test-user-id';
const TEST_ADMIN_EMAIL = 'admin@example.com';
const TEST_ADMIN_PASSWORD = 'admin_password';
const TEST_ADMIN_ID = 'test-admin-id';
const TEST_DIRECTUS_URL = 'https://test-directus.example.com';

// Экспортируем объект настроек
export const config = {
  userEmail: TEST_USER_EMAIL,
  userPassword: TEST_USER_PASSWORD,
  userId: TEST_USER_ID,
  adminEmail: TEST_ADMIN_EMAIL,
  adminPassword: TEST_ADMIN_PASSWORD,
  adminId: TEST_ADMIN_ID,
  directusUrl: TEST_DIRECTUS_URL,
  testImagesDir: path.join(__dirname, '../../uploads/test-images'),
};

// Создаем временную директорию для изображений
function setupTestImagesDirectory() {
  try {
    if (!fs.existsSync(config.testImagesDir)) {
      fs.mkdirSync(config.testImagesDir, { recursive: true });
    }
    
    // Создаем тестовые изображения
    const testImagePaths = [
      path.join(config.testImagesDir, 'test-image-1.jpg'),
      path.join(config.testImagesDir, 'test-image-2.jpg'),
      path.join(config.testImagesDir, 'test-image-3.jpg'),
    ];
    
    testImagePaths.forEach((imagePath, index) => {
      if (!fs.existsSync(imagePath)) {
        fs.writeFileSync(imagePath, `This is a fake image content for test ${index + 1}`);
      }
    });
    
    return testImagePaths;
  } catch (error) {
    console.error('Ошибка при создании тестовых изображений:', error);
    return [];
  }
}

// Мокируем ответ для аутентификации в Directus
export const mockAuthResponse = {
  data: {
    access_token: 'test_access_token',
    refresh_token: 'test_refresh_token',
    expires: 900000,
  }
};

// Мокируем axios для перехвата запросов к API
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

mockedAxios.post.mockImplementation((url: string) => {
  if (url.includes('/auth/login')) {
    return Promise.resolve(mockAuthResponse);
  }
  if (url.includes('/auth/refresh')) {
    return Promise.resolve(mockAuthResponse);
  }
  return Promise.resolve({ data: {} });
});

// Перед началом всех тестов настраиваем окружение
beforeAll(async () => {
  // Устанавливаем переменные окружения для тестов
  process.env.DIRECTUS_URL = TEST_DIRECTUS_URL;
  process.env.DIRECTUS_ADMIN_EMAIL = TEST_ADMIN_EMAIL;
  process.env.DIRECTUS_ADMIN_PASSWORD = TEST_ADMIN_PASSWORD;
  
  // Создаем тестовую директорию для изображений
  setupTestImagesDirectory();
  
  // Сбрасываем счетчики вызовов для моков
  jest.clearAllMocks();
});

// Мок для DirectusAuthManager
export class MockDirectusAuthManager {
  private static instance: MockDirectusAuthManager;
  private adminToken: string | null = null;
  private userTokens: Map<string, string> = new Map();
  
  static getInstance(): MockDirectusAuthManager {
    if (!MockDirectusAuthManager.instance) {
      MockDirectusAuthManager.instance = new MockDirectusAuthManager();
    }
    return MockDirectusAuthManager.instance;
  }
  
  async login(email: string, password: string): Promise<{ success: boolean; token?: string }> {
    return { success: true, token: 'test_token' };
  }
  
  async loginAdmin(): Promise<{ success: boolean; token?: string }> {
    this.adminToken = 'test_admin_token';
    return { success: true, token: this.adminToken };
  }
  
  getToken(userId: string): string {
    return this.userTokens.get(userId) || 'test_token';
  }
  
  getAdminToken(): string {
    return this.adminToken || 'test_admin_token';
  }
  
  clearTokens(): void {
    this.adminToken = null;
    this.userTokens.clear();
  }
}

// Перезаписываем модуль DirectusAuthManager
jest.mock('../services/directus-auth-manager', () => {
  return {
    DirectusAuthManager: MockDirectusAuthManager
  };
});

// После всех тестов очищаем окружение
afterAll(() => {
  jest.resetModules();
  jest.clearAllMocks();
  
  // Удаляем тестовую директорию
  try {
    if (fs.existsSync(config.testImagesDir)) {
      const files = fs.readdirSync(config.testImagesDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(config.testImagesDir, file));
      });
      fs.rmdirSync(config.testImagesDir);
    }
  } catch (error) {
    console.error('Ошибка при удалении тестовой директории:', error);
  }
});

// Экспортируем моки для использования в тестах
export const mocks = {
  authManager: MockDirectusAuthManager.getInstance(),
  axios: mockedAxios,
  testImagePaths: setupTestImagesDirectory(),
};

// Добавляем глобальные вспомогательные функции для тестов
global.setupTest = async () => {
  jest.clearAllMocks();
  return { 
    authManager: MockDirectusAuthManager.getInstance(),
    testImagePaths: mocks.testImagePaths,
  };
};