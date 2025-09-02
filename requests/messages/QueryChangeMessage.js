const { broadcastMessage } = require('../../websocket/websocket');

module.exports = QueryChangeMessage = async (ctx, connection) => {
    try {
        const { messageId, userId } = ctx.request.query;
        const message = ctx.request.body.message;

        let fields = Object.entries({ messageId, message });
        let notFields = [];

        // Перебор всех полей и добавление в notFields
        // полей которые не переданы
        fields.forEach(([key, value]) => {
            if (!value) {
                notFields.push(key);
            }
        })

        // Если какое-то поле или поля не переданы
        // выбрасываем 400 статус и ошибку в сообщении
        if (notFields.length) {
            console.error(`Не заполненно: ${notFields.join(', ')}!`);
            ctx.response.status = 400;
            ctx.response.body = {
                message: `Не заполненно: ${notFields.join(', ')}!`,
                status: 'error'
            };
        }

        await new Promise((resolve, reject) => {
            connection.query(
                'UPDATE messages SET message = ? WHERE id = ?',
                [message, messageId],
                (err, results) => {
                    if (err) return reject(err);
                    resolve(results);
                }
            );
        });

        const [messageUpdated] = await new Promise((resolve, reject) => {
            connection.query(
                'SELECT * FROM messages WHERE id = ?',
                [messageId],
                (err, results) => {
                    if (err) return reject(err);
                    resolve(results);
                }
            );
        });

        const messages = await new Promise((resolve, reject) => {
            connection.query(
                'SELECT * FROM messages WHERE ((sender_id = ?) AND (recipient_id = ?)) OR ((recipient_id = ?) AND (sender_id = ?)) ORDER BY created_at',
                [messageUpdated.sender_id, messageUpdated.recipient_id, messageUpdated.sender_id, messageUpdated.recipient_id],
                (err, results) => {
                    if (err) return reject(err);
                    resolve(results);
                }
            );
        });

        const findIndexMessage = messages.findIndex(message => message.id === messageId);

        if (findIndexMessage !== -1 && findIndexMessage === messages.length - 1) {
            broadcastMessage({
                type: 'info-about-chat', lastMessage: message,
                senderId: messages[messages.length - 1].sender_id,
                recipientId: messages[messages.length - 1].recipient_id,
                idMessage: messages[messages.length - 1].id, lengthMessages: messages.length,
                nameSender: messages[messages.length - 1].sender_id === userId ? 'Вы' : messages[messages.length - 1].name,
                userId: userId
            })
        }

        broadcastMessage({
            type: 'update-message',
            message,
            idMessage: messageId,
            senderId: messageUpdated.sender_id,
            recipientId: messageUpdated.recipient_id
        })

        // Возвращаем статус 201 с успешным обновлением данных
        // и юзером из безопасных данных
        console.log('Данные сообщения успешно обновились!');
        ctx.response.status = 201;
        ctx.response.body = {
            messageUpdated,
            message: 'Данные сообщения успешно обновились!',
            status: 'ok'
        }

    } catch (err) {
        console.log('Ошибка изменения сообщения!' + err.message);
        ctx.response.status = 500;
        ctx.response.body = {
            message: 'Ошибка изменения сообщения!' + err.message,
            status: 'error'
        };
    }
}