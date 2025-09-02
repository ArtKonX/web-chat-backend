const bcrypt = require('bcrypt');

const findUserById = require('../../utils/utility-userid/findUserById');

const isProduction = process.env.NODE_ENV === 'production';

module.exports = Query2FADisable = async (ctx, connection) => {
    try {

        const { id, pin } = ctx.request.body;

        let fields = Object.entries({ id, pin });
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

        const userWarning = await findUserById(id, 'id', 'users_warning', connection);
        const userSafe = await findUserById(id, 'id', 'users_safe', connection);

        // Если мы не нашли индек выбрасываем 400 статус
        if (!userWarning) {
            console.error(`Юзер с таким id - ${id} не найден!`);
            ctx.response.status = 400;
            ctx.response.body = {
                message: `Юзер с таким id - ${id} не найден!`,
                status: 'error'
            };
        }

        // Проверяем пин код, который нам дал юзер
        const isCheckPinCode = bcrypt.compareSync(pin, userWarning.fa2_pin);

        // Если не тот пин код, то уменьшаем количество попыток на одну
        if (!isCheckPinCode) {
            if (userWarning.fa2_attempts > 0) {
                new Promise((resolve, reject) => {
                    connection.query(
                        'UPDATE users_warning ' +
                        'SET fa2_attempts = ? ' +
                        'WHERE id = ?',
                        [
                            userWarning.fa2_attempts - 1,
                            id
                        ],
                        (err, result) => {
                            if (err) return reject(err);
                            resolve(result);
                        }
                    );
                })

                const attempt = userWarning.fa2_attempts - 1

                console.error(`Пин код не верный!`);
                ctx.response.body = {
                    attempt: attempt,
                    message: `Пин код не верный!`,
                    status: 'error'
                };
                ctx.response.status = 500;
            }

            // Если мы израсходовали все попытки, то значит
            // это злоумышленник, который получил доступ к аккаунту
            // выходим из аккаунта
            if (userWarning.fa2_attempts <= 0) {
                // Для того чтобы выйти мы должны удалить куки
                // Для этого надо прописать в expires - 01 Jan 1970 00:00:01 GMT
                const isSecure = ctx.request.headers['x-forwarded-proto'] === 'https' || ctx.request.secure;

                ctx.cookies.set('jwtToken', '', {
                    expires: new Date(0),
                    httpOnly: true,
                    secure: isSecure,
                    sameSite: isProduction ? 'None' : 'Lax'
                });

                console.error(`Вы израсходовали все попытки! Пин код не верный(`);
                ctx.response.status = 500;
                ctx.response.body = {
                    attempt: 0,
                    message: `Вы израсходовали все попытки! Пин код не верный(`,
                    status: 'error'
                };

                // Добавляем попытки
                new Promise((resolve, reject) => {
                    connection.query(
                        'UPDATE users_warning ' +
                        'SET fa2_attempts = ? ' +
                        'WHERE id = ?',
                        [
                            5,
                            id
                        ],
                        (err, result) => {
                            if (err) return reject(err);
                            resolve(result);
                        }
                    );
                })
            }
        }

        // Если пин код верный, то изменяем его и отключаем 2FA
        if (isCheckPinCode) {
            new Promise((resolve, reject) => {
                connection.query(
                    'UPDATE users_warning ' +
                    'SET fa2_enabled = ?, fa2_pin = ?, fa2_attempts = ? ' +
                    'WHERE id = ?',
                    [
                        false,
                        null,
                        5,
                        id
                    ],
                    (err, result) => {
                        if (err) return reject(err);
                        resolve(result);
                    }
                );
            })

            new Promise((resolve, reject) => {
                connection.query(
                    'UPDATE users_safe ' +
                    'SET fa2_enabled = ? ' +
                    'WHERE id = ?',
                    [
                        false,
                        id
                    ],
                    (err, result) => {
                        if (err) return reject(err);
                        resolve(result);
                    }
                );
            })

            // Мы отключили 2FA отправляем 201 код!
            console.log('Успешное отключение 2FA!');
            ctx.response.body = {
                data: {
                    user: userSafe
                },
                message: `Успешное отключение 2FA!`,
                status: 'ok'
            };
        }
    } catch (err) {
        console.error('Ошибка отключения 2FA!', err.message);
        ctx.response.status = 500;
        ctx.response.body = {
            message: 'Ошибка отключения 2FA! ' + err.message,
            status: 'error'
        };
    }
}