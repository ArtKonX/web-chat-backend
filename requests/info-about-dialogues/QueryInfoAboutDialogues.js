const findUserById = require('../../utils/utility-userid/findUserById');

module.exports = QueryInfoAboutDialogues = async (ctx, connection) => {
    try {

        const { userId } = ctx.request.query;

        // Если userId не передан
        // выбрасываем 400 статус
        if (userId) {
            console.error(`Не заполненно: userId!`);
            ctx.response.status = 400;
            ctx.response.body = {
                message: `Не заполненно: userId!`,
                status: 'error'
            };
        }

        // Ищем сообщения от отправлителя или от получателя
        const messagesFromTwoUsers = await new Promise((resolve, reject) => {
            connection.query(
                'SELECT * FROM messages WHERE (sender_id = ?) OR (recipient_id = ?) ORDER BY created_at',
                [userId, userId],
                (err, results) => {
                    if (err) return reject(err);
                    resolve(results);
                }
            );
        });

        let sendsUsersSet = new Set()

        const sendsUsersList = []

        // Повторяющиеся id просто не записываем
        // из-за множества и JSON
        messagesFromTwoUsers.forEach(message => {
            sendsUsersSet.add(JSON.stringify([message.sender_id, message.recipient_id]))
        })

        //
        sendsUsersSet.forEach(user => {
            const parseUser = JSON.parse(user);

            // Находим дубликаты с двух сторон id юзеров
            const findUsersDouble = sendsUsersList.find(userItem =>
                parseUser.includes(userItem[0])
                && parseUser.includes(userItem[1]))

            // Если они есть не добавляем в массив
            if (!findUsersDouble) {
                sendsUsersList.push(JSON.parse(user))
            }
        })

        // Ищем сообщения напраленные отправилем получателю и наоборот по id
        const messagesFromTwoSides = await Promise.all(sendsUsersList.map(async (sendUser) => {
            return await new Promise((resolve, reject) => {
                connection.query(
                    'SELECT * FROM messages WHERE ((sender_id = ?) AND (recipient_id = ?)) OR ((sender_id = ?) AND (recipient_id = ?)) ORDER BY created_at',
                    [sendUser[0], sendUser[1], sendUser[1], sendUser[0]],
                    (err, results) => {
                        if (err) return reject(err);
                        resolve(results);
                    }
                );
            })
        }))

        let dataListAboutDialogues;

        if (messagesFromTwoSides.length) {
            dataListAboutDialogues = await Promise.all(messagesFromTwoSides.map(async (message) => {
                const lastDataMessage = message[message.length - 1];

                const differentUserId = lastDataMessage.recipient_id === userId ?
                    lastDataMessage.sender_id :
                    lastDataMessage.recipient_id

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

                // Возвращаем промис с инфо
                // по диалогу каждого юзера из безопасных
                // данных
                return await new Promise((resolve, reject) => {
                    connection.query(
                        'SELECT * FROM users_safe WHERE id = ?',
                        [userId === lastDataMessage.sender_id ? lastDataMessage.recipient_id : lastDataMessage.sender_id],
                        (err, res) => {
                            if (err) return reject(err);

                            resolve({
                                lastMessage: lastDataMessage.message,
                                lengthMessages: message.length,
                                sender_id: lastDataMessage.sender_id,
                                recipient_id: lastDataMessage.recipient_id,
                                nameSender: res[0]?.name,
                                userId: lastDataMessage.recipient_id === userId ?
                                    lastDataMessage.sender_id :
                                    lastDataMessage.recipient_id,
                                created_at: lastDataMessage.created_at,
                                colorProfile: dataUser.color_profile,
                                status: user?.status
                            })
                        }
                    );
                });
            }))
        } else {
            // Если сообщений нет, то записываем пустой
            // массив
            dataListAboutDialogues = [];
        }

        const sortedDataListAboutDialogues = dataListAboutDialogues.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

        console.log('Поздравляю с успешным получением диалогов)');
        ctx.response.status = 200;
        ctx.response.body = {
            data: sortedDataListAboutDialogues,
            message: 'Поздравляю с успешным получением диалогов)',
            status: 'ok'
        };
    } catch (err) {
        console.log('Ошибка при получении информации о диалогах(');
        ctx.response.status = 500;
        ctx.response.body = {
            message: 'Ошибка при получении диалогов( ' + err.message,
            status: 'error'
        }
    }
}