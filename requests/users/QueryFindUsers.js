const findUserById = require('../../utils/utility-userid/findUserById');

module.exports = QueryFindUsers = async (ctx, connection) => {

    try {
        const { q, currentId } = ctx.request.query;

        // Если не передан id пользователя отправляем 400 статус
        // id нам нужен, чтобы не получать себя же в списке
        if (!currentId) {
            console.error('Не передан id!')
            ctx.response.status = 400;
            ctx.response.body = {
                message: 'Не передан id!',
                status: 'error'
            }
        }

        const botUserList = [await findUserById('БОТ', 'name', 'users_safe', connection)];

        // Если пользователь ничего не ввел, возвращяем БОТ'а
        if (!q.trim()) {

            console.log('Бот успешно получен!')
            ctx.response.status = 201;
            ctx.response.body = {
                users: botUserList,
                message: `Бот успешно получен!`,
                status: 'ok'
            }
        } else {
            // Если же что-то введено, то осуществляем поиск...

            // Ищем по id, имени и почте
            // Но себя не показываем в поиске)
            const usersFinded = await new Promise((resolve, reject) => {
                connection.query(
                    'SELECT * FROM users_safe WHERE (email LIKE ? OR name LIKE ? OR city LIKE ? OR id LIKE ?) AND id NOT IN (?)',
                    [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, currentId],
                    (err, results) => {
                        if (err) return reject(err);
                        resolve(results);
                    }
                );
            });

            // Если что-то находим возвращаем со статусом 201

            if (usersFinded.length > 0) {
                console.log('Пользователи успешно получены!')
                ctx.response.status = 201;
                ctx.response.body = {
                    users: usersFinded,
                    message: `Пользователи успешно получены!`,
                    status: 'ok'
                }
            } else {
                // Если нет возвращаем БОТ'а

                console.log('Бот успешно получен!')
                ctx.response.status = 201;
                ctx.response.body = {
                    users: botUserList,
                    message: `Бот успешно получен!`,
                    status: 'ok'
                }
            }
        }
    } catch (err) {
        console.log('Ошибка получения пользователей! ', err.message)
        ctx.response.status = 500;
        ctx.response.body = {
            users: [],
            message: 'Ошибка получения пользователей! ' + err.message,
            status: 'error'
        }
    }
}