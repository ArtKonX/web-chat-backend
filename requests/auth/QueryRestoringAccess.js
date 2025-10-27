module.exports = QueryRestoringAccess = async (ctx, connection) => {
    try {
        const { id, publicKey } = ctx.request.body;

        let fields = Object.entries({ id, publicKey });
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
        if (notFields.length) {
            console.error(`Не заполненно: ${notFields.join(', ')}!`);
            ctx.response.status = 400;
            ctx.response.body = {
                message: `Не заполненно: ${notFields.join(', ')}!`,
                status: 'error'
            };

            return
        }

        await Promise.all(['users_warning'].map((async (table) => {
            return await new Promise((res, rej) => {
                connection.query(
                    `UPDATE ${table} SET public_key = ? WHERE id = ?`,
                    [publicKey, id],
                    (err, result) => {
                        if (err) {
                            return rej(err)
                        };

                        res(result);
                    }
                );
            })
        })))

        console.log('Поздравляю с успешным обновление публичного ключа!');
        ctx.response.status = 200;
        ctx.response.body = {
            message: 'Успешное обновление публичного ключа)',
            status: 'ok'
        };

    } catch (err) {
        console.error('Ошибка обновления публичного ключа( ', err.message);
        ctx.response.status = 500;
        ctx.response.body = {
            message: 'Ошибка обновления публичного ключа: ' + err.message,
            status: 'error'
        };
    }
}