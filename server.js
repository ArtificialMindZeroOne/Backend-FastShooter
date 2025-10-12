const dgram = require('dgram');
const server = dgram.createSocket('udp4');

const PORT = 41234;
const clients = new Set();

server.on('listening', () => {
    const address = server.address();
    console.log(`🚀 UDP сервер слушает ${address.address}:${address.port}`);
});

server.on('message', (msg, rinfo) => {
    const clientId = `${rinfo.address}:${rinfo.port}`;
    clients.add(clientId);

    console.log(`Сообщение от ${clientId}: ${msg}`);

    // Рассылаем всем кроме отправителя
    clients.forEach((id) => {
        if (id !== clientId) {
            const [ip, port] = id.split(':');
            server.send(msg, parseInt(port), ip);
        }
    });
});

server.bind(PORT);
