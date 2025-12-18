// функция для безопасного поиска по id
const findUserById = require('../../utils/utility-userid/findUserById');

module.exports = QueryGetUser = async (ctx, connection, next) => {

    try {
        // Находим юзера по id
        const findedUserById = await findUserById(ctx.state.userId, 'id', 'users_safe', connection);

        console.log('findedUserById', findedUserById, ctx.state.userId)

        // Если такого нет выкидываем 404
        if (findedUserById.message === 'error') {
            console.error(`Такой юзер по id - ${ctx.state.userId} не существует(`);
            ctx.response.status = 404;
            ctx.response.body = {
                message: `Такой юзер по id - ${ctx.state.userId} не существует(`,
                status: 'error'
            };
            return
        }

        // Если существует, то отправляем его данные
        console.log('Успешное получение пользователя')
        ctx.response.status = 200;
        ctx.response.body = {
            user: findedUserById,
            message: 'Успешное получение пользователя!',
            status: 'ok'
        };

    } catch (err) {
        console.error('Ошибка получения данных юзера( ', err.message);
        ctx.response.status = 500;
        ctx.response.body = {
            message: 'Ошибка получения данных юзера( ' + err.message,
            status: 'error'
        };
    }
}