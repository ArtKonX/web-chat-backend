const { broadcastMessage } = require('../../websocket/websocket');
const findUserById = require('../../utils/utility-userid/findUserById');

module.exports = QueryDeleteMessage = async (ctx, connection) => {
    try {
        const { messageId, userId } = ctx.request.query;

        let fields = Object.entries({ messageId });
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

        const [message] = await new Promise((res, rej) => {
            connection.query(
                'SELECT * FROM messages WHERE id = ?',
                [messageId],
                (err, mess) => {
                    if (err) return rej(err);
                    res(mess);
                }
            );
        })

        await new Promise((resolve, reject) => {
            connection.query(
                'DELETE FROM messages WHERE id = ?',
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
                [message.sender_id, message.recipient_id, message.sender_id, message.recipient_id],
                (err, results) => {
                    if (err) return reject(err);
                    resolve(results);
                }
            );
        });

        // Находим юзера для получения имени
        const user = await findUserById(messages[messages.length - 1].sender_id, 'id', 'users_safe', connection);

        broadcastMessage({
            type: 'info-about-chat', lastMessage: messages[messages.length - 1].message,
            senderId: messages[messages.length - 1].sender_id,
            recipientId: messages[messages.length - 1].recipient_id,
            idMessage: messages[messages.length - 1].id, lengthMessages: messages.length,
            nameSender: messages[messages.length - 1].sender_id === userId ? 'Вы' : user.name,
            userId: userId
        })

        broadcastMessage({
            type: 'delete-message',
            idMessage: messageId,
            senderId: message.sender_id,
            recipientId: message.recipient_id
        })

        // Возвращаем статус 200 с успешным обновлением данных
        // и юзером из безопасных данных
        console.log('Данные сообщения успешно удалены!');
        ctx.response.status = 200;
        ctx.response.body = {
            message: 'Данные сообщения успешно удалены!',
            status: 'ok'
        }

    } catch (err) {
        console.log('Ошибка удаления сообщения!' + err.message);
        ctx.response.status = 500;
        ctx.response.body = {
            message: 'Ошибка удаления сообщения!' + err.message,
            status: 'error'
        };
    }
}