import dgram from 'dgram';
import { joinRoom, updatePlayer } from './rooms/roomManager.js';

const PORT = 41234;
const server = dgram.createSocket('udp4');

server.on('listening', () => {
    const address = server.address();
    console.log(`🚀 UDP сервер слушает ${address.address}:${address.port}`);
});

server.on('message', (msg, rinfo) => {
    try {
        const str = msg.toString('utf8');  // Преобразуем buffer в строку

        const data = JSON.parse(str);
        const playerIPAndPortInfo = `${rinfo.address}:${rinfo.port}`;

        switch (data.type) {
            case 'join':
                joinRoom({
                    roomId: data?.roomId,
                    playerData: data?.playerData,
                    server,
                    playerIPAndPortInfo,
                });
                break;
            case 'update':
                updatePlayer(playerIPAndPortInfo, data?.playerData, server);
                break;
        }
    }catch (e) {
        console.error('Ошибка обработки сообщения:', e);
        console.error('📦 Исходные данные:', msg.toString('utf8'));
    }
});

server.bind(PORT);
