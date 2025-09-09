const WebSocket = require('ws');

// хранит экземпляр WS
let wssInstance = null;

const getWebSocketServer = (server, connection) => {
    // сработает только единоразово
    if (!wssInstance) {
        wssInstance = new WebSocket.Server({ server });

        wssInstance.on('connection', (ws) => {
            // создаем соединение с начальным id
            // null
            ws.userId = null;

            // обработчик сообщений
            ws.on('message', async (message) => {
                try {

                    // распарсим входящее сообщение
                    const data = JSON.parse(message);

                    // Если тип коннект
                    // то учтанавливаем id для клиента
                    if (data.type === 'connect') {
                        ws.userId = data.userId;
                        console.log(`Клиент ${data.userId} подключился`);

                        const [user] = await new Promise((resolve, reject) => {
                            connection.query(
                                'SELECT * FROM users_statuses WHERE id = ?',
                                [data.userId],
                                (err, results) => {
                                    if (err) return reject(err);
                                    resolve(results);
                                }
                            );
                        });

                        if (!user) {
                            try {
                                await new Promise((resolve, reject) => {
                                    connection.query(
                                        'INSERT INTO users_statuses (id, status) VALUES (?, TRUE)',
                                        [data.userId],
                                        (err, results) => {
                                            if (err) return reject(err);
                                            resolve(results);
                                        }
                                    );
                                });
                                console.log(`Пользователь ${data.userId} добавлен в базу и подключился`);
                            } catch (err) {
                                console.error('Ошибка добавления пользователя в таблицу со статусами: ', err)
                            }
                        } else {
                            try {
                                await new Promise((resolve, reject) => {
                                    connection.query(
                                        'UPDATE users_statuses SET status = TRUE WHERE id = ?',
                                        [data.userId],
                                        (err, results) => {
                                            if (err) return reject(err);
                                            resolve(results);
                                        }
                                    );
                                });
                                broadcastMessage({
                                    type: 'user-status',
                                    userId: data.userId,
                                    status: true
                                });
                                console.log(`Пользователь ${data.userId} подключился`);
                            } catch (err) {
                                console.error('Ошибка обновления пользвательского статуса: ', err)
                            }
                        }
                    }
                } catch (err) {
                    console.error('Ошибка при обработке сообщения: ', err);
                }
            });

            // если отключаемся, то выводим сообщение
            ws.on('close', async () => {
                console.log(`Клиент ${ws.userId} отключился`);
                try {
                    await new Promise((resolve, reject) => {
                        connection.query(
                            'UPDATE users_statuses SET status = FALSE WHERE id = ?',
                            [ws.userId],
                            (err, results) => {
                                if (err) return reject(err);
                                resolve(results);
                            }
                        );
                    });

                    broadcastMessage({
                        type: 'user-status',
                        userId: ws.userId,
                        status: false
                    });
                } catch (err) {
                    console.error('Ошибка обновления статуса юзера: ', err)
                }
            });
        });
    }

    // Возвращаем инстанс WS
    return wssInstance;
};

function broadcastMessage({ type: type, message: message,
    senderId: senderId, recipientId: recipientId,
    idMessage: idMessage, file: file, lengthMessages,
    userId, nameSender, lastMessage, status, colorProfile }) {

    if (wssInstance) {
        // перебираем всех пользователей
        // подключенных
        wssInstance.clients.forEach((client) => {
            // Если соединение открыто и
            // пользователь с id является или
            // отправителем или получателем, то
            // отправляем
            if (client.readyState === WebSocket.OPEN &&
                (client.userId === senderId || client.userId === recipientId)) {
                // Тип message для всех сообщений
                if (type === 'message') {
                    client.send(JSON.stringify({
                        id: idMessage,
                        type: 'message',
                        message,
                        sender_id: senderId,
                        recipient_id: recipientId,
                        created_at: new Date(),
                        file_url: file && file.url,
                        file_type: file && file.type,
                        file_name: file && file.name,
                        file_size: file && file.size
                    }));
                } else if (type === 'update-message') {
                    client.send(JSON.stringify({
                        type: 'update-message',
                        idMessage,
                        message,
                        sender_id: senderId,
                        recipient_id: recipientId,
                    }))
                } else if (type === 'delete-message') {
                    client.send(JSON.stringify({
                        type: 'delete-message',
                        idMessage,
                        sender_id: senderId,
                        recipient_id: recipientId,
                    }))
                } else {
                    client.send(JSON.stringify({
                        message: 'error'
                    }))
                }

                // тип info-about-chat для сайд-бара
                // с информацией вывода последних сообщений
                if (type === 'info-about-chat') {
                    client.send(JSON.stringify({
                        type: 'info-about-chat',
                        lastMessage,
                        lengthMessages,
                        sender_id: senderId,
                        recipient_id: recipientId,
                        nameSender: nameSender[client.userId].name,
                        userId: userId[client.userId].id,
                        status: status[client.userId].status,
                        colorProfile: colorProfile[client.userId].color_profile
                    }))
                }
            }

            if (type === 'user-status') {
                client.send(JSON.stringify({
                    type: 'user-status',
                    status,
                    userId
                }))
            }
        });
    }
};

module.exports = {
    getWebSocketServer,
    broadcastMessage
};