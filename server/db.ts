import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import ws from "ws";
import * as schema from "@shared/schema";
import * as fs from 'fs';
import * as path from 'path';

neonConfig.webSocketConstructor = ws;

// Включаем подробные логи для отладки
console.log('Initializing database connection');
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);

// Create mock DB if DATABASE_URL is not set
let pool;
let db;

if (!process.env.DATABASE_URL) {
  console.warn(
    "DATABASE_URL is not set. Using mock database. Some features may not work correctly."
  );
  
  // Create mock implementations
  pool = {
    query: async () => ({ rows: [] }),
    connect: async () => ({}),
    end: async () => {},
  };
  
  db = {
    query: async () => [],
    select: () => ({ from: () => ({ where: () => ({ get: async () => null }) }) }),
    insert: () => ({ values: () => ({ returning: () => ({ get: async () => null }) }) }),
    // Add other mock methods as needed
  };
} else {
  try {
    console.log('Creating Neon database pool');
    pool = new Pool({ 
      connectionString: process.env.DATABASE_URL,
      max: 10, // ограничиваем максимальное число соединений
      idleTimeoutMillis: 30000, // timeout для неиспользуемых соединений
    });
    
    console.log('Testing database connection...');
    // Проверим соединение
    pool.query('SELECT NOW()').then(() => {
      console.log('Database connection successful');
    }).catch(err => {
      console.error('Database connection test failed:', err);
    });
    
    // Инициализируем Drizzle ORM
    console.log('Initializing Drizzle ORM');
    db = drizzle({ client: pool, schema });
    
    // Создаем необходимые таблицы (миграция через SQL)
    (async () => {
      try {
        console.log('Creating tables if needed...');
        
        // Список таблиц из нашей схемы
        const tables = [
          'user_campaigns',
          'content_sources', 
          'trend_topics',
          'campaign_trend_topics',
          'source_posts',
          'campaign_content'
        ];
        
        // Проверяем каждую таблицу и создаем, если не существует
        for (const table of tables) {
          try {
            console.log(`Checking if table '${table}' exists...`);
            await pool.query(`SELECT 1 FROM ${table} LIMIT 1`);
            console.log(`Table '${table}' exists.`);
          } catch (err) {
            if (err.code === '42P01') { // 42P01 - relation does not exist
              console.log(`Table '${table}' doesn't exist, creating...`);
              await db.execute(schema[`create${table.charAt(0).toUpperCase() + table.slice(1)}Table`]);
              console.log(`Table '${table}' created successfully.`);
            } else {
              console.error(`Error checking table '${table}':`, err);
            }
          }
        }
        
        console.log('Database initialization completed.');
      } catch (err) {
        console.error('Error during database initialization:', err);
      }
    })();
  } catch (err) {
    console.error('Fatal error initializing database:', err);
    
    // Fallback to mock DB in case of error
    console.warn('Falling back to mock database. Some features may not work correctly.');
    pool = {
      query: async () => ({ rows: [] }),
      connect: async () => ({}),
      end: async () => {},
    };
    
    db = {
      query: async () => [],
      select: () => ({ from: () => ({ where: () => ({ get: async () => null }) }) }),
      insert: () => ({ values: () => ({ returning: () => ({ get: async () => null }) }) }),
    };
  }
}

export { pool, db };
