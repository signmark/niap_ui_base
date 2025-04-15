/**
 * Скрипт для принудительного запуска сервера
 * Сначала убивает все процессы на портах 5000 и 5001, затем запускает сервер
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function killProcessOnPorts() {
  console.log('Пытаюсь освободить порты 5000 и 5001...');
  
  try {
    // Пытаемся найти процессы Node.js
    const { stdout } = await execAsync('ps aux | grep "node"');
    console.log('Найдены процессы Node.js:');
    console.log(stdout);
    
    // Идентифицируем процессы, использующие порты
    const lines = stdout.split('\n');
    const serverProcesses = lines.filter(line => 
      line.includes('server/index.ts') || 
      line.includes('node --require') ||
      line.includes('tsx server')
    );
    
    // Получаем PIDs серверных процессов
    const pids = [];
    serverProcesses.forEach(line => {
      const match = line.match(/\s*(\d+)\s+/);
      if (match && match[1]) {
        pids.push(match[1]);
      }
    });
    
    if (pids.length > 0) {
      console.log(`Найдены серверные процессы с PID: ${pids.join(', ')}`);
      
      // Убиваем эти процессы
      await execAsync(`kill -9 ${pids.join(' ')}`);
      console.log('Процессы остановлены');
    } else {
      console.log('Серверные процессы не найдены');
    }
  } catch (error) {
    console.error(`Ошибка при освобождении портов: ${error.message}`);
  }
}

async function startServer() {
  console.log('Запускаю сервер...');
  
  try {
    // Настраиваем глобальный флаг для запуска на порту 5000
    process.env.PORT = "5000";
    
    // Запускаем сервер через npm
    const child = exec('npm run dev');
    
    // Перенаправляем вывод
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
    
    console.log('Сервер запущен');
  } catch (error) {
    console.error(`Ошибка при запуске сервера: ${error.message}`);
  }
}

async function main() {
  try {
    await killProcessOnPorts();
    
    // Небольшая пауза для корректного освобождения портов
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await startServer();
  } catch (error) {
    console.error(`Критическая ошибка: ${error.message}`);
  }
}

main();