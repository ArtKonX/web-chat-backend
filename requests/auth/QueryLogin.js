const { sign } = require('jsonwebtoken');

const bcrypt = require('bcrypt');

const updateAttempts = require('../../actions-with-bd/updateAttempts');
const findUserById = require('../../utils/utility-userid/findUserById');

module.exports = QueryLogin = async (ctx, next, connection) => {
    try {

        const { email, password, pin } = ctx.request.body;

        // pin может быть не передан если 2FA не включена
        let fields = Object.entries({ email, password });
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
            console.error(`Не заполненно: ${notFields.join(', ')} !`);
            ctx.response.status = 400;
            ctx.response.body = {
                message: `Не заполненно: ${notFields.join(', ')}! ` + err.message,
                status: 'error'
            };
        }

        // Находим юзера в опасных данных
        const findWarningUser = await findUserById(email, 'email', 'users_warning', connection)

        // Если юзера с таким ящиком нет, то выбрасываем статус 404
        if (findWarningUser.message === 'error') {
            console.error(`Пользователь с такой почтой - ${email} не найден!`);
            ctx.response.status = 404;
            ctx.response.body = {
                message: `Пользователь с такой почтой - ${email} не найден!`,
                status: 'error'
            };
        }

        // Проверяем пароль...
        const isSuccessPassword = bcrypt.compare(password, findWarningUser.password);

        // Если пароль неверный, то кидаем статус 400
        if (!isSuccessPassword) {
            console.error('Этот пароль неверный!');
            ctx.response.status = 404;
            ctx.response.body = {
                message: `Этот пароль неверный!`,
                status: 'error'
            };
        }

        // Теперь у пользователя может быть включена 2FA
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
            // и выкидываем 500 статус
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

                setTimeout(() => {
                    updateAttempts(connection, findWarningUser.id, 5)
                }, 2 * 24 * 60 * 60 * 1000);
                return
            }
        }

        // Если все ок
        // Пошли к генерации JWT токена!

        const payload = {
            userId: findWarningUser.id,
            email: findWarningUser.email
        };

        // Остановимся на 7 днях действительности токена
        const expiresIn = '7d';

        // Используем HS256 алгоритм, который по умолчанию
        const token = sign(payload, process.env.JWT_SECRET, {
            expiresIn
        });

        // Формируем печеньки в браузере)
        // Куки на 7 дней ровно столько действителен токен
        // httpOnly чтобы был запрет к кукам из JS для безопасности
        // secure для передачи только по HTTPS
        // sameSite: 'None' без этого куки не работаю в Хроме


        // const isSecure = ctx.request.headers['x-forwarded-proto'] === 'https' || ctx.request.secure;

        ctx.cookies.set('jwtToken', token, {
            expires: new Date(Date.now() + 604800000),
            httpOnly: true,
            secure: true,
            sameSite: 'none'
        });

        console.log('Cookies теперь работают)');

        // Теперь мы вошли в систему)
        console.log('Поздравляю с успешной входом в систему!');
        ctx.status = 200;
        ctx.body = {
            user: {
                id: findWarningUser.id,
                name: findWarningUser.name,
                email: findWarningUser.email
            },
            message: 'Успешный вход в систему!',
            status: 'ok'
        };

        await next();

    } catch (err) {
        console.error('Ошибка входа в систему( ', err.message);
        ctx.response.status = 500;
        ctx.response.body = {
            message: 'Ошибка входа в систему( ' + err.message,
            status: 'error'
        };
    }
}