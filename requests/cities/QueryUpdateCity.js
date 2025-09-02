const findUserById = require('../../utils/utility-userid/findUserById');

module.exports = QueryUpdateCity = async (ctx, connection) => {
    try {
        const { id, city } = ctx.request.body;

        let fields = Object.entries({ id, city });
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
        }

        const findWarningUser = await new Promise((resolve, reject) => {
            connection.query(
                'SELECT * FROM users_warning WHERE id = ?',
                [id],
                (err, results) => {
                    if (err) return reject(err);
                    resolve(results);
                }
            );
        });

        // Если пользователь не найден возвращаем 400 статус код
        if (!findWarningUser) {
            console.error(`Юзер с этим id - ${id} не найден`);
            ctx.response.status = 400;
            ctx.response.body = {
                message: `Юзер с этим id - ${id} не найден`,
                status: 'error'
            };
        }

        await new Promise((resolve, reject) => {
            connection.query(
                `UPDATE users_warning SET city = ? WHERE id = ?`,
                [city, id],
                (err, result) => {
                    if (err) return reject(err);
                    resolve(result);
                }
            );
        });

        await new Promise((resolve, reject) => {
            connection.query(
                `UPDATE users_safe SET city = ? WHERE id = ?`,
                [city, id],
                (err, result) => {
                    if (err) return reject(err);
                    resolve(result);
                }
            );
        });

        const findSafeUser = await findUserById(id, 'id', 'users_safe', connection);

        // Если все пошло по плану, то возвращаем 201 код
        console.log('Поздравляю с успешным изменением города)');
        ctx.response.status = 201;
        ctx.response.body = {
            user: findSafeUser,
            message: 'Успешное изменение города)',
            status: 'ok'
        };
    } catch (err) {
        console.error('Ошибка изменение города( ', err.message);
        ctx.response.status = 500;
        ctx.response.body = {
            message: 'Ошибка изменение города( ' + err.message,
            status: 'error'
        };
    }
}