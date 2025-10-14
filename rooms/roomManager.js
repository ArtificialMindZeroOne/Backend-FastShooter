// rooms/roomManager.js
import {generateId} from '../utils/idGenerator.js';

const rooms = new Map();

// Статусы комнат
const ROOM_STATUS = {
    PENDING: 'pending',   // Ожидает второго игрока
    ACTIVE: 'active',     // Оба игрока подключены
    OVER: 'over'          // Один игрок отключился
};

export function createRoom() {
    const roomId = generateId('room');
    rooms.set(roomId, {
        players: new Map(),
        connections: new Map(),
        bullets: [],
        status: ROOM_STATUS.PENDING
    });
    console.log(`🆕 Комната ${roomId} создана (${ROOM_STATUS.PENDING})`);
    return roomId;
}


////// 1) JOIN
export function joinRoom({playerData, server, playerIPAndPortInfo}) {
    let targetRoomId = null;

    // Если roomId не передан или комната недоступна - ищем комнату в статусе PENDING
    for (const [id, room] of rooms.entries()) {
        if (room?.status === ROOM_STATUS.PENDING && room.players.size < 2) {
            targetRoomId = id;
            console.log(`🎯 Найдена комната ${id} в статусе ${ROOM_STATUS.PENDING} с 1 игроком!`);
            break;
        }
    }

    // Если не нашли комнату в статусе PENDING - создаем новую
    if (!targetRoomId) {
        targetRoomId = createRoom();
        console.log(`🆕 Создана новая комната ${targetRoomId}!`);
    }

    const room = rooms.get(targetRoomId);

    // Генерируем ID игрока и создаём объект
    const playerID = generateId('player');
    console.log(`НОВЫЙ ИГРОК СОЗДАН С ID: ${playerID}!!!!!`)
    const player = {
        id: playerID,
        x: playerData?.x ?? 0,
        y: playerData?.y ?? 0,
        direction: playerData?.direction ?? 1,
        nickname: playerData?.nickname ?? `Игрок-${Math.floor(Math.random())}`,
        skin1: playerData?.skin1 ?? 1,
        skin2: playerData?.skin2 ?? 1,
        skin3: playerData?.skin3 ?? 1,
        skin4: playerData?.skin4 ?? 1,
    };

    // Добавляем игрока в комнату
    room.players.set(playerID, player);

    // for (let [_, value] of rooms.entries()) {
    //     for (let [playerID, ipPort] of value.connections.entries()) {
    //         if (ipPort === playerIPAndPortInfo) {
    //             value.connections.delete(playerID);
    //         }
    //     }
    // }

    room.connections.set(playerID, playerIPAndPortInfo);

    console.log(`👥 Игрок ${player.nickname} подключился к комнате ${targetRoomId}`);
    console.log(`📊 В комнате ${targetRoomId} теперь ${room.players.size}/2 игроков`);

    // Обновляем статус комнаты
    if (room.players.size === 2) {
        room.status = ROOM_STATUS.ACTIVE;
        console.log(`🎮 Комната ${targetRoomId} перешла в статус ${ROOM_STATUS.ACTIVE}`);
    }

    // Отправляем игроку данные о подключении
    const [ip, port] = playerIPAndPortInfo.split(':');
    const response = {
        type: 'join',
        roomId: targetRoomId,
        player: player,
        roomStatus: room.status
    };
    server.send(JSON.stringify(response), parseInt(port), ip);
}


////// 2) UPDATE
export function updatePlayer(playerIPAndPortInfo, playerData, packNumber, server, playerOldID) {
    console.log('rooms', rooms)
    console.log('Получаем отсюда', playerIPAndPortInfo)

    if (!playerIPAndPortInfo) return;

    for (const [roomId, room] of rooms.entries()) {
        const playerId = playerData?.id;
        if (!playerId || !room.players.has(playerId)) continue;

        // Обновляем данные игрока только в активных комнатах
        if (room.status !== ROOM_STATUS.ACTIVE) {
            break;
        }

        const player = room.players.get(playerId);

        const updated = {
            ...player,
            x: playerData?.x ?? player.x,
            y: playerData?.y ?? player.y,
            direction: playerData?.direction ?? player.direction,
            nickname: playerData?.nickname ?? player.nickname,
            packNumber: packNumber ?? packNumber,
            skin1: playerData?.skin1 ?? 1,
            skin2: playerData?.skin2 ?? 1,
            skin3: playerData?.skin3 ?? 1,
            skin4: playerData?.skin4 ?? 1,
        };

        room.players.set(playerId, updated);

        // Обновляем IP:порт для отправки следующих пакетов
        room.connections.set(playerId, playerIPAndPortInfo);

        const playersInRoom = Array.from(room.players.entries());

        // Рассылаем каждому данные других игроков (только если в комнате 2 игрока и статус ACTIVE)
        if (playersInRoom.length === 2 && room.status === ROOM_STATUS.ACTIVE) {
            for (const [clientId] of playersInRoom) {
                const clientIPPort = room.connections.get(clientId);
                if (!clientIPPort) continue;
                const [ip, port] = clientIPPort.split(':');

                // Отправляем все остальных игроков кроме самого клиента
                const otherPlayers = playersInRoom.filter(([id]) => id !== clientId);
                for (const [, other] of otherPlayers) {
                    const res = {
                        type: 'update',
                        roomId,
                        player: other,
                        roomStatus: room.status,
                        data1: playerData?.data1 ?? 0,
                        data2: playerData?.data2 ?? 0,
                        data3: playerData?.data3 ?? 0,
                        data4: playerData?.data4 ?? 0,
                        data5: playerData?.data5 ?? 0,
                        data6: playerData?.data6 ?? 0,
                        data7: playerData?.data7 ?? 0,
                        data8: playerData?.data8 ?? 0,
                        data9: playerData?.data9 ?? 0,
                        data10: playerData?.data10 ?? 0,
                    }

                    if (other.id !== playerOldID) {
                        server.send(JSON.stringify(res), parseInt(port), ip);
                    }

                    console.log('Отправляем сюда: ', `${ip + parseInt(port)}`)
                    console.log('-------------')
                }
            }
        }
        break;
    }
}

////// 3) SHOOTUPDATE
export function updateShootData(playerIPAndPortInfo, bulletData, server) {
    console.log(`🔫 Получены данные выстрела от ${playerIPAndPortInfo}:`);

    for (const [roomId, room] of rooms.entries()) {
        let shooterId = null;

        if (bulletData?.playerId && room.players.has(bulletData.playerId)) {
            shooterId = bulletData.playerId;
        }

        if (!shooterId) continue;

        // Проверяем, что комната активна
        if (room.status !== ROOM_STATUS.ACTIVE) {
            console.log(`⏸️ Комната ${roomId} не активна (${room.status}), выстрел пропущен`);
            continue;
        }

        const shooter = room.players.get(shooterId);
        if (!shooter) continue;

        const bullet = {
            id: generateId('bullet'),
            playerId: shooterId,
            x: bulletData?.x ?? shooter.x,
            y: bulletData?.y ?? shooter.y,
            direction: bulletData?.direction ?? shooter.direction,
            damage: bulletData?.damage ?? 10,
            speed: bulletData?.speed ?? 25,
            hideTime: bulletData?.hideTime ?? 200,
            angle: bulletData?.angle ?? 0,
        };

        room.bullets.push(bullet);

        console.log(`💥 Игрок ${shooter.nickname} выстрелил пулю ${bullet.id}`);

        broadcastBulletToRoom(roomId, bullet, server);
        break;
    }
}

function broadcastBulletToRoom(roomId, bullet, server) {
    const room = rooms.get(roomId);
    if (!room || room.status !== ROOM_STATUS.ACTIVE) return;

    const playersInRoom = Array.from(room.players.entries());

    for (const [clientId] of playersInRoom) {
        if (clientId === bullet.playerId) continue;

        const clientIPPort = room.connections.get(clientId);
        if (!clientIPPort) continue;

        const [ip, port] = clientIPPort.split(':');

        const bulletInfo = {
            type: 'shootData',
            bulletData: {
                playerId: bullet.playerId,
                x: bullet.x,
                y: bullet.y,
                direction: bullet.direction,
                damage: bullet.damage,
                speed: bullet.speed,
                hideTime: bullet.hideTime,
                angle: bullet.angle,
            }
        };

        server.send(JSON.stringify(bulletInfo), parseInt(port), ip);
        console.log(`📤 Отправлена пуля от ${room.players.get(bullet.playerId)?.nickname} игроку`);
    }
}

//// 4) REMOVEPLAYER
export function removePlayer(playerIPAndPortInfo, server, playerID) {
    console.log(`🗑️ Попытка удалить игрока ${playerIPAndPortInfo}...`);

    for (const [roomId, room] of rooms.entries()) {
        for (const [playerId, connection] of room.connections.entries()) {
            if (connection === playerIPAndPortInfo) {
                const player = room.players.get(playerId);
                console.log(`👋 Игрок ${player?.nickname} отключился от комнаты ${roomId}`);

                room.players.delete(playerId);
                room.connections.delete(playerId);

                console.log(`📊 В комнате ${roomId} осталось ${room.players.size}/2 игроков.`);

                // Обновляем статус комнаты
                if (room.players.size === 1) {
                    room.status = ROOM_STATUS.OVER;
                    console.log(`💀 Комната ${roomId} перешла в статус ${ROOM_STATUS.OVER}!`);

                    // Уведомляем оставшегося игрока об отключении
                    notifyPlayerDisconnected(roomId, server);
                }
                // Если комната пустая - удаляем
                else if (room.players.size === 0) {
                    rooms.delete(roomId);
                    console.log(`🗑️ Комната ${roomId} удалена (пустая)!`);
                }

                return {roomId, playerId};
            }
        }
    }
    console.log(`❌ Игрок с connection ${playerIPAndPortInfo} не найден`);
    return null;
}

//
// // Остальные функции без изменений...
//
// // Уведомляем игрока о том, что противник отключился
function notifyPlayerDisconnected(roomId, server) {
    const room = rooms.get(roomId);
    if (!room || room.players.size !== 1 || room.status !== ROOM_STATUS.OVER) return;

    // Получаем оставшегося игрока
    const [remainingPlayerId, remainingPlayer] = Array.from(room.players.entries())[0];
    const remainingConnection = room.connections.get(remainingPlayerId);

    if (remainingConnection) {
        const [ip, port] = remainingConnection.split(':');
        const disconnectMessage = {
            type: 'playerDisconnected',
            message: 'Противник отключился',
            roomStatus: ROOM_STATUS.OVER
        };
        server.send(JSON.stringify(disconnectMessage), parseInt(port), ip);
        console.log(`📤 Уведомление об отключении отправлено игроку ${remainingPlayer.nickname}`);
    }
}
