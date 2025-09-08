const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

const findUserById = require('../../utils/utility-userid/findUserById');

module.exports = Query2FATurnOn = async (ctx, connection) => {
    try {
        const { id } = ctx.request.body;

        // Если id нет, то возвращаем 400 статус кода
        if (!id) {
            console.error(`Не передан id!`);
            ctx.response.status = 400;
            ctx.response.body = {
                message: `Не передан id!`,
                status: 'error'
            };
        }

        // Находим пользователя в опасных данных
        const userWarning = await findUserById(id, 'id', 'users_warning', connection);

        // Если не находим юзера то возвращаем 400 код
        if (!userWarning) {
            console.error(`Юзер с таким id - ${id} не найден!`);
            ctx.response.status = 400;
            ctx.response.body = {
                message: `Юзер с таким id - ${id} не найден!`,
                status: 'error'
            };
        } else {
            // Если уже подключена 2FA то отправляем 404 код
            if (userWarning.fa2_enabled) {
                console.error(`Уже 2FA подключена!`);
                ctx.response.status = 404;
                ctx.response.body = {
                    message: `Уже 2FA подключена!`,
                    status: 'error'
                };
                return
            } else {
                // Если 2FA не подключена то
                // Генерируем pin
                const pin = uuidv4();

                // Для предоставления большей безопасности
                // хешируем пин код
                const hashPin = bcrypt.hashSync(pin, 10);

                // Если находим юзера, то включаем 2FA и даем pin-code
                // в опасных данных

                new Promise((resolve, reject) => {
                    connection.query(
                        'UPDATE users_warning ' +
                        'SET fa2_enabled = ?, fa2_pin = ?, fa2_attempts = ? ' +
                        'WHERE id = ?',
                        [
                            true,
                            hashPin,
                            5,
                            id
                        ],
                        (err, result) => {
                            if (err) return reject(err);
                            resolve(result);
                        }
                    );
                })

                // и включаем в безопасных данных
                // двойную защиту
                new Promise((resolve, reject) => {
                    connection.query(
                        'UPDATE users_safe ' +
                        'SET fa2_enabled = ? ' +
                        'WHERE id = ?',
                        [
                            true,
                            id
                        ],
                        (err, result) => {
                            if (err) return reject(err);
                            resolve(result);
                        }
                    );
                })

                // Находим юзера в безопасных данных
                const usersSafe = await findUserById(id, 'users_safe', connection);

                // Отдаем 200 код и данные с пользователем и пином
                console.log(`Успешное подключение 2FA!`);
                ctx.response.status = 200;
                ctx.response.body = {
                    data: {
                        user: usersSafe,
                        pinCode: pin
                    },
                    message: `Успешное подключение 2FA!`,
                    status: 'ok'
                };
            }
        }
    } catch (err) {
        console.error('Ошибка подключения 2FA!', err.message);
        ctx.response.status = 500;
        ctx.response.body = {
            message: 'Ошибка подключения 2FA! ' + err.message,
            status: 'error'
        };
    }
}