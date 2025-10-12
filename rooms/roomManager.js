// rooms/roomManager.js
import { generateId } from '../utils/idGenerator.js';

const rooms = new Map(); // roomId -> { players: Map<playerId, playerData>, connections: Map<playerId, ipPort> }

export function createRoom() {
    const roomId = generateId('room');
    rooms.set(roomId, { players: new Map(), connections: new Map() });
    console.log(`🆕 Комната ${roomId} создана`);
    return roomId;
}

export function joinRoom({ roomId, playerData, server, playerIPAndPortInfo }) {
    let targetRoomId = null;

    // Ищем комнату, где меньше 2 игроков
    for (const [id, room] of rooms.entries()) {
        if (room?.players.size < 2) {
            targetRoomId = id;
            break;
        }
    }

    // Если нет — создаём новую
    if (!targetRoomId) targetRoomId = createRoom();
    const room = rooms.get(targetRoomId);

    // Генерируем ID игрока и создаём объект
    const playerID = generateId('player');
    const player = {
        id: playerID,
        x: playerData?.x ?? 0,
        y: playerData?.y ?? 0,
        direction: playerData?.direction ?? '1',
        nickname: playerData?.nickname ?? 'Unknown',
    };

    // Добавляем игрока в комнату
    room.players.set(playerID, player);
    room.connections.set(playerID, playerIPAndPortInfo);

    console.log(`👥 Игрок ${player.nickname} (${playerIPAndPortInfo}) подключился к комнате ${targetRoomId}`);

    // Отправляем игроку только его собственные данные (подтверждение)
    const [ip, port] = playerIPAndPortInfo.split(':');
    const response = {
        type: 'join',
        roomId: targetRoomId,
        player: player
    };

    server.send(JSON.stringify(response), parseInt(port), ip);
}

export function updatePlayer(playerIPAndPortInfo, playerData, server) {
    for (const [roomId, room] of rooms.entries()) {
        const playerId = playerData?.id;
        if (!playerId || !room.players.has(playerId)) continue;

        // Обновляем данные игрока
        const player = room.players.get(playerId);
        const updated = {
            ...player,
            x: playerData?.x ?? player.x,
            y: playerData?.y ?? player.y,
            direction: playerData?.direction ?? player.direction,
            nickname: playerData?.nickname ?? player.nickname,
        };
        room.players.set(playerId, updated);

        // Обновляем IP:порт для отправки следующих пакетов
        room.connections.set(playerId, playerIPAndPortInfo);

        const playersInRoom = Array.from(room.players.entries());

        if (playersInRoom.length < 2) {
            console.log(`⚠️ В комнате ${roomId} меньше 2 игроков — update не рассылается`);
            break;
        }

        // Рассылаем каждому данные других игроков
        for (const [clientId, clientPlayer] of playersInRoom) {
            const clientIPPort = room.connections.get(clientId);
            if (!clientIPPort) continue;
            const [ip, port] = clientIPPort.split(':');

            // Отправляем все остальных игроков кроме самого клиента
            const otherPlayers = playersInRoom.filter(([id]) => id !== clientId);
            for (const [, other] of otherPlayers) {

                const res = {
                    type: 'update',
                    roomId,
                    player: other
                }

                server.send(JSON.stringify(res), parseInt(port), ip);
            }
        }


        break;
    }
}
