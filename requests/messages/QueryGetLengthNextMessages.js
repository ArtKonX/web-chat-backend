module.exports = QueryGetLengthNextMessages = async (ctx, connection) => {
    try {
        const { nextOffset, senderId, recipientId } = ctx.request.query;

        let fields = Object.entries({ nextOffset, senderId, recipientId });
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

        const limit = 10;

        let messages = await new Promise((resolve, reject) => {
            connection.query(
                'SELECT * FROM messages WHERE ((sender_id = ?) AND (recipient_id = ?)) OR ((sender_id = ?) AND (recipient_id = ?)) ORDER BY created_at',
                [senderId, recipientId, recipientId, senderId],
                (err, results) => {
                    if (err) return reject(err);
                    resolve(results);
                }
            );
        });

        messages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        messages = messages.splice(nextOffset, limit).reverse();

        console.log('Успешное получение длины следующих сообщений!');
        ctx.response.status = 200;
        ctx.response.body = {
            message: 'Успешное получение длины следующих сообщений!',
            lengthNextMessages: messages.length,
            isNextMessages: messages.length > 0,
            status: 'ok'
        };

    } catch (err) {
        console.log('Ошибка получения количества следующих сообщений: ' + err.message);
        ctx.response.status = 500;
        ctx.response.body = {
            message: 'Ошибка получения количества следующих сообщений: ' + err.message,
            status: 'error'
        };
    }
}