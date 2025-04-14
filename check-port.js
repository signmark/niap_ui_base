import net from 'net';

const server = net.createServer();

const port = 5000;

server.once('error', function(err) {
  if (err.code === 'EADDRINUSE') {
    console.log(`Порт ${port} уже используется.`);
  } else {
    console.log(`Произошла ошибка: ${err.code}`);
  }
});

server.once('listening', function() {
  console.log(`Порт ${port} свободен.`);
  server.close();
});

server.listen(port);