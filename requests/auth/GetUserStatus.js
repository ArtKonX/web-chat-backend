module.exports = GetUserStatus = async (ctx, connection) => {

    try {
        const { userId } = ctx.request.query;

        const [user] = await new Promise((resolve, reject) => {
            connection.query(
                'SELECT * FROM users_statuses WHERE id = ?',
                [userId],
                (err, results) => {
                    if (err) return reject(err);
                    resolve(results);
                }
            );
        });

        // Если такого нет выкидываем 404
        if (!user) {
            console.error(`Такой юзер по id - ${userId} не существует(`);
            ctx.response.status = 404;
            ctx.response.body = {
                message: `Такой юзер по id - ${userId} не существует(`,
                status: 'error'
            };
            return
        }

        // Если существует, то отправляем его данные
        console.log('Успешное получение пользователя')
        ctx.response.status = 200;
        ctx.response.body = {
            user,
            message: 'Успешное получение статуса пользователя!',
            status: 'ok'
        };

    } catch (err) {
        console.error('Ошибка получения статуса юзера( ', err.message);
        ctx.response.status = 500;
        ctx.response.body = {
            message: 'Ошибка получения статуса юзера( ' + err.message,
            status: 'error'
        };
    }
}