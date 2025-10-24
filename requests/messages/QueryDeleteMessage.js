const { broadcastMessage } = require('../../websocket/websocket');
const findUserById = require('../../utils/utility-userid/findUserById');

const getStatuses = require('../../actions-with-bd/getStatuses');

module.exports = QueryDeleteMessage = async (ctx, connection) => {
    try {
        const { messageId } = ctx.request.query;

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

        const messageList = await new Promise((res, rej) => {
            connection.query(
                'SELECT * FROM messages WHERE id = ?',
                [messageId],
                (err, mess) => {
                    if (err) return rej(err);
                    res(mess);
                }
            );
        })

        if (messageList.length) {
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

            console.log('messageList', messageList)

            const messages = await new Promise((resolve, reject) => {
                connection.query(
                    'SELECT * FROM messages WHERE ((sender_id = ?) AND (recipient_id = ?)) OR ((recipient_id = ?) AND (sender_id = ?)) ORDER BY created_at',
                    [messageList[0].sender_id, messageList[0].recipient_id, messageList[0].sender_id, messageList[0].recipient_id],
                    (err, results) => {
                        if (err) return reject(err);
                        resolve(results);
                    }
                );
            });

            console.log('messages', messages)

            if (messages && messages.length) {
                // Для отправки сообщения через WS для правильного отображения
                // отправителя в диалогах
                const userIdData = await findUserById(messages[messages.length - 1].sender_id, 'id', 'users_safe', connection);
                const currentUserIdData = await findUserById(messages[messages.length - 1].recipient_id, 'id', 'users_safe', connection);

                const dataStatuses = await getStatuses(messages[messages.length - 1].sender_id, messages[messages.length - 1].recipient_id, connection);

                broadcastMessage({
                    type: 'info-about-chat', lastMessage: messages[messages.length - 1].message,
                    senderId: messages[messages.length - 1].sender_id,
                    recipientId: messages[messages.length - 1].recipient_id,
                    idMessage: messages[messages.length - 1].id, lengthMessages: messages.length,
                    nameSender: {
                        [userIdData.id]:
                            { name: userIdData.name },
                        [currentUserIdData.id]:
                            { name: currentUserIdData.name }
                    },
                    userId: {
                        [userIdData.id]:
                            { id: userIdData.id },
                        [currentUserIdData.id]:
                            { id: currentUserIdData.id }
                    },
                    colorProfile: {
                        [userIdData.id]:
                            { color_profile: userIdData.color_profile },
                        [currentUserIdData.id]:
                            { color_profile: currentUserIdData.color_profile }
                    },
                    status: {
                        [dataStatuses[0].id]:
                            { status: dataStatuses[0].status },
                        [dataStatuses[1].id]:
                            { status: dataStatuses[1].status }
                    }
                })
            } else {
                console.log('messageList[0]', messageList[0])
                broadcastMessage({
                    type: 'info-about-chat', lastMessage: null,
                    senderId: messageList[0].sender_id,
                    recipientId: messageList[0].recipient_id,
                    idMessage: messageList[0].id, lengthMessages: 0,
                    nameSender: null,
                    userId: null,
                    colorProfile: null,
                    status: null
                })
            }

            broadcastMessage({
                type: 'delete-message',
                idMessage: messageId,
                senderId: messageList[0].sender_id,
                recipientId: messageList[0].recipient_id
            })

            // Возвращаем статус 200 с успешным обновлением данных
            // и юзером из безопасных данных
            console.log('Данные сообщения успешно удалены!');
            ctx.response.status = 200;
            ctx.response.body = {
                message: 'Данные сообщения успешно удалены!',
                status: 'ok'
            }
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