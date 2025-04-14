import { exec } from 'child_process';
import { promisify } from 'util';
import net from 'net';

const execAsync = promisify(exec);

const PORT = 5000;

async function findAndKillProcess() {
  try {
    console.log(`Attempting to find and kill process using port ${PORT}...`);
    
    // Сначала попробуем с помощью команды ps для поиска всех node-процессов
    console.log('Listing all Node processes:');
    try {
      const { stdout } = await execAsync('ps aux | grep node');
      console.log(stdout);
    } catch (error) {
      console.log('Error listing processes:', error.message);
    }
    
    // Попробуем особый подход для Replit: перезапустим все workflows
    console.log('\nAttempting to restart workflows...');
    try {
      await execAsync('pkill -f "node.*server\\.js"');
      console.log('Sent kill signal to server processes');
    } catch (error) {
      console.log('No matching processes found or error:', error.message);
    }
    
    // Проверим, освободился ли порт
    setTimeout(() => {
      const server = net.createServer();
      
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`Port ${PORT} is still in use.`);
        } else {
          console.log(`Error: ${err.code}`);
        }
        server.close();
      });
      
      server.once('listening', () => {
        console.log(`Port ${PORT} is now free!`);
        server.close();
      });
      
      server.listen(PORT);
    }, 1000);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

findAndKillProcess();