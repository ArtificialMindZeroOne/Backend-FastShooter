import dgram from 'dgram';
import {joinRoom, updatePlayer, updateShootData, removePlayer} from './rooms/roomManager.js';

const PORT = 41234;
const server = dgram.createSocket('udp4');

// Храним таймеры для каждого игрока
const playerTimeouts = new Map();

function updatePlayerActivity(playerIPAndPortInfo, playerID) {

    // Сбрасываем старый таймер
    if (playerTimeouts.has(playerIPAndPortInfo)) {
        clearTimeout(playerTimeouts.get(playerIPAndPortInfo).timeout);
    }

    // Устанавливаем новый таймер (30 секунд)
    const timeout = setTimeout(() => {
        console.log(`⏰ Таймаут для игрока ${playerIPAndPortInfo}`);
        removePlayer(playerIPAndPortInfo, server, playerID);
        playerTimeouts.delete(playerIPAndPortInfo);
    }, 5000);

    playerTimeouts.set(playerIPAndPortInfo, {timeout, playerID});
}

server.on('listening', () => {
    const address = server.address();
    console.log(`🚀 UDP сервер слушает ${address.address}:${address.port}`);
});

server.on('message', (msg, rinfo) => {
    try {
        const str = msg.toString('utf8');
        const data = JSON.parse(str);
        const playerIPAndPortInfo = `${rinfo.address}:${rinfo.port}`;
        const playerID = JSON.parse(msg?.toString('utf8'))?.playerData?.id;


        // Обновляем активность игрока при ЛЮБОМ сообщении
        updatePlayerActivity(playerIPAndPortInfo, playerID);

        switch (data.type) {
            case 'join':
                joinRoom({
                    playerData: data?.playerData,
                    server,
                    playerIPAndPortInfo,
                });
                break;
            case 'update':
                updatePlayer(playerIPAndPortInfo, data?.playerData, data?.packNumber, server, data);
                break;
            case 'shootData':
                updateShootData(playerIPAndPortInfo, data?.bulletData, server);
                break;
            // case 'disconnect': // Добавляем обработку явного дисконнекта
            //     console.log(`📤 Игрок ${playerIPAndPortInfo} отключился`);
            //     removePlayer(playerIPAndPortInfo, server);
            //     playerTimeouts.delete(playerIPAndPortInfo);
            //     break;
        }
    } catch (e) {
        console.error('Ошибка обработки сообщения:', e);
        console.error('📦 Исходные данные:', msg.toString('utf8'));
    }
});

server.bind(PORT);