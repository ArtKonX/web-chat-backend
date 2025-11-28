// Для отправки сообщения собеседникам
const { broadcastMessage } = require('../../websocket/websocket');

const findUserById = require('../../utils/utility-userid/findUserById');

const getStatuses = require('../../actions-with-bd/getStatuses')

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

        const dataStatuses = await getStatuses(userId, currentUserId, connection);

        // Для отправки сообщения через WS для правильного отображения
        // отправителя в диалогах
        const userIdData = await findUserById(userId, 'id', 'users_safe', connection);
        const currentUserIdData = await findUserById(currentUserId, 'id', 'users_safe', connection);

        broadcastMessage({
            type: 'info-about-chat', lastMessage: messageData.message,
            senderId: messageData.sender_id,
            recipientId: messageData.recipient_id,
            listDates: messages.map(item => item.created_at),
            idMessage: message?.id, lengthMessages: messages.length,
            nameSender: {
                [userIdData?.id]:
                    { name: userIdData.name },
                [currentUserIdData?.id]:
                    { name: currentUserIdData.name }
            },
            userId: {
                [userIdData?.id]:
                    { id: userIdData?.id },
                [currentUserIdData?.id]:
                    { id: currentUserIdData?.id }
            },
            colorProfile: {
                [userIdData?.id]:
                    { color_profile: userIdData.color_profile },
                [currentUserIdData?.id]:
                    { color_profile: currentUserIdData.color_profile }
            },
            status: {
                [dataStatuses[0]?.id]:
                    { status: dataStatuses[0]?.status },
                [dataStatuses[1]?.id]:
                    { status: dataStatuses[1]?.status }
            }
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