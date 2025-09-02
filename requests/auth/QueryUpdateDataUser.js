const updateAttempts = require('../../actions-with-bd/updateAttempts');

const bcrypt = require('bcrypt');

const findUserById = require('../../utils/utility-userid/findUserById');

const isProduction = process.env.NODE_ENV === 'production';

module.exports = QueryUpdateDataUser = async (ctx, connection) => {
    try {
        const { id, name, password, pin } = ctx.request.body;

        let fields = Object.entries({ id, name });
        let notFields = [];

        // Перебор всех полей и добавление в notFields
        // полей которые не переданы, кроме пароля,
        // пароль может пользователь не изменять
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

        // Находим юзера в опасных данных
        const findWarningUser = await findUserById(id, 'id', 'users_warning', connection)

        // Если мы их не находим то отправляем 400 статус
        if (findWarningUser.message === 'error') {
            console.error(`Пользователь с таким ${id} не найден!`);
            ctx.response.status = 400;
            ctx.response.body = {
                message: `Пользователь с таким ${id} не найден!`,
                status: 'error'
            };

            return
        }

        if (findWarningUser.fa2_enabled) {
            // Если нет пин кода возвращаем ошибку
            if (!pin) {
                console.error('Отсутсвует пин код!');
                ctx.response.status = 400;
                ctx.response.body = {
                    message: `Отсутсвует пин код!`,
                    status: 'not-pin-code'
                };

                return
            }

            // Если включена проверяем пин
            const isSuccessFA2 = bcrypt.compareSync(pin, findWarningUser.fa2_pin);

            // Если неправильный pin то уменьшаем число попыток на одну
            // и выкидываем 400 статус
            if (!isSuccessFA2 && findWarningUser.fa2_attempts > 0) {
                updateAttempts(connection, findWarningUser.id, findWarningUser.fa2_attempts - 1)
                console.error(`Пин код не верный!`);
                ctx.response.status = 500;
                ctx.response.body = {
                    data: {
                        attempt: findWarningUser.fa2_attempts - 1
                    },
                    message: `Пин код не верный!`,
                    status: 'error'
                };
                return
            } else if (!isSuccessFA2 && findWarningUser.fa2_attempts <= 0) {
                // Если все попытки израсходованы, то оставляем в числе попыток 0
                // на 2 дня и после возвращаем 5 для того чтобы злоумышленник не смог зайти
                console.error(`Вы израсходовали все попытки! Пин код не верный(`);
                ctx.response.status = 500;
                ctx.response.body = {
                    message: `Вы израсходовали все попытки! Пин код не верный(`,
                    status: 'error'
                };

                ctx.cookies.set('jwtToken', '', {
                    expires: new Date(0),
                    httpOnly: true,
                    secure: isProduction || ctx.request.secure,
                    sameSite: 'None'
                });

                setTimeout(() => {
                    updateAttempts(connection, findWarningUser.id, 5)
                }, 2 * 24 * 60 * 60 * 1000);
                return
            }
        }

        // Иначе меняем данные, которые изменились и для опасных данных и для
        // безопасных
        // Если у нас пароль или имя не задано или не поменялось возвращаем
        // такое же

        const updatedUserData = {};

        if (name && name.trim() && name !== findWarningUser.name) {
            updatedUserData.name = name;
        }

        if (password && password.trim()) {
            updatedUserData.password = bcrypt.hashSync(password, 10);;
        }

        // Если нет данных для обновления, то тогда возвращаем
        // статус 400
        if (Object.keys(updatedUserData).length === 0) {
            ctx.response.status = 400;
            ctx.response.body = {
                message: 'Нет данных для обновления',
                status: 'error'
            };
            return;
        }

        // Строка для изменения полей из таблицы
        const dataKeysForDB = Object.keys(updatedUserData)
            .map((key) => `${key} = ?`)
            .join(', ');

        const dataValuesForDB = Object.values(updatedUserData);

        dataValuesForDB.push(id);

        // Изменяем данные сразу для двух таблиц
        await Promise.all(['users_warning', 'users_safe'].map((async (table) => {
            return await new Promise((res, rej) => {
                connection.query(
                    `UPDATE ${table} SET ${dataKeysForDB} WHERE id = ?`,
                    dataValuesForDB,
                    (err, result) => {
                        if (err) {
                            return rej(err)
                        };

                        res(result);
                    }
                );
            })
        })))

        // Получение обновленных данных
        const updatedDataUser = await findUserById(id, 'users_safe', connection)

        // Возвращаем статус 201 с успешным обновлением данных
        // и юзером из безопасных данных
        console.log('Данные успешно обновились!');
        ctx.response.status = 201;
        ctx.response.body = {
            user: updatedDataUser,
            message: 'Данные успешно обновились!',
            status: 'ok'
        }
    } catch (err) {
        console.log('Ошибка обновления данных(');
        ctx.response.status = 500;
        ctx.response.body = {
            message: 'Ошибка обновления данных(',
            status: 'error'
        }
    }
}