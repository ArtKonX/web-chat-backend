// Для отправки сообщения собеседникам
const { broadcastMessage } = require('../../websocket/websocket');

const findUserById = require('../../utils/utility-userid/findUserById');

module.exports = QuerySendMessage = async (ctx, connection) => {
    try {
        const { userId, currentUserId } = ctx.request.query;
        const message = JSON.parse(ctx.request.body.message);

        let fields = Object.entries({ userId, currentUserId, message });
        let notFields = [];

        // Перебор всех полей и добавление в notFields
        // полей которые не переданы
        fields.forEach(([key, value]) => {
            if (!value) {
                notFields.push(key);
            }
        })

        // Если какое-то поле или поля не переданы
        // выбрасываем 400 статус
        if (notFields.length > 0) {
            console.error(`Не заполненно: ${notFields.join(', ')}!`);
            ctx.response.status = 400;
            ctx.response.body = {
                message: `Не заполненно: ${notFields.join(', ')}!`,
                status: 'error'
            };
        }

        // Формируем сообщение...
        const messageData = {
            id: message.id,
            created_at: new Date(),
            message: message.message,
            recipient_id: userId,
            sender_id: currentUserId
        }

        new Promise((resolve, reject) => {
            connection.query(
                `INSERT INTO messages (${Object.keys(messageData).join(', ')}) VALUES (${Array(Object.keys(messageData).length).fill('?').join(', ')})`,
                [
                    ...Object.values(messageData)
                ],
                (err, result) => {
                    if (err) return reject(err);
                    resolve(result);
                }
            );
        })

        const messages = await new Promise((resolve, reject) => {
            connection.query(
                'SELECT * FROM messages WHERE ((sender_id = ?) AND (recipient_id = ?)) OR ((sender_id = ?) AND (recipient_id = ?)) ORDER BY created_at',
                [currentUserId, userId, userId, currentUserId],
                (err, results) => {
                    if (err) return reject(err);
                    resolve(results);
                }
            );
        });

        broadcastMessage({
            type: 'message', message: messageData.message,
            senderId: messageData.sender_id, recipientId: messageData.recipient_id,
            idMessage: message.id
        })

        const differentUserId = messageData.recipient_id === userId ?
            messageData.sender_id :
            messageData.recipient_id

        const [user] = await new Promise((resolve, reject) => {
            connection.query(
                'SELECT * FROM users_statuses WHERE id = ?',
                [differentUserId],
                (err, results) => {
                    if (err) return reject(err);
                    resolve(results);
                }
            );
        });

        const dataUser = await findUserById(differentUserId, 'id', 'users_safe', connection);

        // Промис с инфо
        // по диалогу юзера из безопасных
        // данных
        await new Promise((_, reject) => {
            connection.query(
                'SELECT * FROM users_safe WHERE id = ?',
                [currentUserId === messageData.sender_id ? messageData.recipient_id : messageData.sender_id],
                (err, res) => {
                    if (err) return reject(err);

                    broadcastMessage({
                        type: 'info-about-chat', lastMessage: messageData.message,
                        senderId: messageData.sender_id,
                        recipientId: messageData.recipient_id,
                        idMessage: message.id, lengthMessages: messages.length,
                        nameSender: res[0]?.name,
                        userId: differentUserId,
                        colorProfile: dataUser?.color_profile,
                        status: user?.status
                    })
                })
        })

        console.log('Сообщение успешно доставлено)')
        ctx.response.status = 200;
        ctx.response.body = {
            messageData: messageData,
            message: 'Сообщение успешно доставлено)',
            status: 'ok'
        }

    } catch (err) {
        console.error('Ошибка отправки сообщения ', err.message);
        ctx.response.status = 500;
        ctx.response.body = {
            message: 'Ошибка отправки сообщения ' + err.message,
            status: 'error'
        }
    }
}