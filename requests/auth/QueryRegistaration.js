const { sign } = require('jsonwebtoken');

// Цвета для фонов профилей юзеров
const colorsForUsers = require('../../data/colors-for-users.json');

const bcrypt = require('bcrypt');

module.exports = QueryRegistaration = async (ctx, connection) => {
    try {
        const { email, name, password, id, publicKey } = ctx.request.body;

        let fields = Object.entries({ email, name, password, id, publicKey });
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

        // Проверяем встречается ли email еще у кого-то
        const [duplicateEmailUser] = await new Promise((resolve, reject) => {
            connection.query(
                'SELECT * FROM users_safe WHERE email = ?',
                [email],
                (err, results) => {
                    if (err) return reject(err);
                    resolve(results);
                }
            );
        });

        // Если встречается, то с одим и тем же email'ом регистрация не возможна
        if (duplicateEmailUser) {
            console.error(`У кого-то этот email - ${email} уже существует!`);
            ctx.response.status = 404;
            ctx.response.body = {
                message: `У кого-то этот email - ${email} уже существует!`,
                status: 'error'
            };
        }

        // Пока все ок)

        // Рандомный цвет для профиля юзера
        const colorProfile = colorsForUsers.colors[Math.floor(Math.random() * colorsForUsers.colors.length)];

        // Хешируемый пароль для юзера из обычного строкового
        // в синхронном режиме
        const hashPassword = bcrypt.hashSync(password, 10);

        const userSafeData = {
            id,
            date_register: new Date(),
            email,
            name,
            city: null,
            color_profile: colorProfile,
            fa2_enabled: false
        }

        const userWarnData = {
            id,
            date_register: new Date(),
            email,
            name,
            password: hashPassword,
            city: null,
            color_profile: colorProfile,
            fa2_enabled: false,
            fa2_pin: null,
            fa2_attempts: 5,
            public_key: publicKey
        }

        await Promise.all(['users_warning', 'users_safe'].map(async (table, indx) => {
            await Promise.all([
                new Promise((res, rej) => {
                    connection.query(
                        `INSERT INTO ${table} ${indx === 0 ?
                            `(${Object.keys(userWarnData).join(', ')})` :
                            `(${Object.keys(userSafeData).join(', ')})`
                        } ` +
                        `VALUES (${indx === 0 ?
                            `${Array(Object.keys(userWarnData).length).fill('?').join(', ')}` :
                            `${Array(Object.keys(userSafeData).length).fill('?').join(', ')}`
                        })`,
                        [...Object.values(indx === 0 ?
                            userWarnData :
                            userSafeData
                        )],
                        (err, results) => {
                            if (err) {
                                return rej(err);
                            }

                            res(results);
                        }
                    );
                })])
        }))

        // Пошли к генерации JWT токена!
        const payload = {
            userId: id,
            email: email
        };

        // Остановимся на 7 днях действительности токена
        const expiresIn = '7d';

        // Используем HS256 алгоритм, который по умолчанию
        const token = sign(payload, process.env.JWT_SECRET, {
            expiresIn
        });

        // Теперь мы в системе)
        console.log('Поздравляю с успешной регистрацией!');
        ctx.response.status = 200;
        ctx.response.body = {
            user: {
                id: id,
                name: name,
                email: email,
                token
            },
            message: 'Успешная регистрация)',
            status: 'ok'
        };

    } catch (err) {
        console.error('Ошибка регистрации( ', err.message);
        ctx.response.status = 500;
        ctx.response.body = {
            message: 'Ошибка при регистрации: ' + err.message,
            status: 'error'
        };
    }
}