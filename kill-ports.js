/**
 * Скрипт для принудительного завершения процессов, использующих указанные порты
 * Запуск: node kill-ports.js [порт1 порт2 ...]
 */

import { exec } from 'child_process';

// Порты для освобождения, принимаем из аргументов командной строки или используем по умолчанию
const portsToKill = process.argv.slice(2).length > 0 
  ? process.argv.slice(2).map(p => parseInt(p, 10)) 
  : [5001, 5000]; // По умолчанию освобождаем порты 5001 и 5000

// Убедимся, что все порты - числа
const validPorts = portsToKill.filter(port => !isNaN(port) && port > 0 && port < 65536);

if (validPorts.length === 0) {
  console.error('Не указаны действительные порты для освобождения');
  process.exit(1);
}

console.log(`Попытка освободить порты: ${validPorts.join(', ')}`);

// В Replit у нас ограниченные возможности, поэтому используем доступные команды
// Находим PID процессов, использующих указанные порты с помощью ps и grep 
validPorts.forEach(port => {
  console.log(`Ищем процессы, использующие порт ${port}...`);
  
  // Пытаемся найти процессы, прослушивающие порт
  exec(`ps aux | grep "node" | grep -v "grep"`, (err, stdout) => {
    if (err) {
      console.error(`Ошибка при выполнении команды: ${err.message}`);
      return;
    }
    
    console.log('Найдены следующие Node.js процессы:');
    console.log(stdout);
    
    // Пытаемся найти Node.js процессы по тексту команды, включая номер порта
    const portProcessRegExp = new RegExp(`(\\d+).*node.*${port}`, 'i');
    const lines = stdout.split('\n');
    
    let killedAny = false;
    
    lines.forEach(line => {
      // Для демонстрационных целей, но в реальности нужно быть осторожнее с этим
      if (line.includes('node') && line.includes(`${port}`)) {
        const match = line.match(/\s*(\d+)\s+/);
        if (match && match[1]) {
          const pid = parseInt(match[1], 10);
          console.log(`Найден процесс с PID ${pid}, который может использовать порт ${port}`);
          
          // Отправляем SIGKILL для принудительного завершения процесса
          try {
            process.kill(pid, 'SIGKILL');
            console.log(`Успешно отправлен SIGKILL процессу ${pid}`);
            killedAny = true;
          } catch (e) {
            console.log(`Не удалось отправить SIGKILL процессу ${pid}: ${e.message}`);
          }
        }
      }
    });
    
    // Если нет четкого совпадения, позволяем пользователю выбрать PID для убийства
    if (!killedAny) {
      console.log(`Не найдены процессы, очевидно использующие порт ${port}.`);
      console.log('Выберите PID для завершения из списка выше или запустите сервер на другом порту.');
    }
  });
});

// Также попробуем более прямой подход с kill-port, если он установлен
try {
  exec(`npx kill-port ${validPorts.join(' ')}`, (err, stdout, stderr) => {
    if (err) {
      // Ошибка может быть, если kill-port не установлен, это ожидаемо
      return;
    }
    console.log('Результат выполнения npx kill-port:');
    console.log(stdout);
  });
} catch (e) {
  // Игнорируем ошибки, связанные с отсутствием kill-port
}

// Подтверждение завершения скрипта
setTimeout(() => {
  console.log(`Скрипт завершен. Вы можете попробовать запустить сервер снова.`);
}, 1000);