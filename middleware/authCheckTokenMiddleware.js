// Для констант .env
require('dotenv').config();

const jwt = require('jsonwebtoken');

module.exports = async function authCheckTokenMiddleware(ctx, next) {
    try {

        // let token = null;

        // Проверяем токен в кукис
        // if (ctx.cookies.get('jwtToken')) {
        //     token = ctx.cookies.get('jwtToken');
        // }

        const authorization = ctx.headers.authorization;
        const token = authorization.split(' ')[1];

        // Если его нет отправляем статус 500
        if (!token) {
            console.error('Отсутствует токен!');
            ctx.response.status = 500;
            ctx.response.body = {
                message: 'Отсутствует токен',
                status: 'error'
            }
        }

        if (token) {
            // Верифицируем полученный только что токен и получем
            // полузную нагрузку в которой есть id пользователя
            // он нам как раз и нужен
            // сохраняем его в общем пространстве имен для
            // далнейшего взаимодействия
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Если все ок продолжаем...
            if (decoded) {

                // Если есть такой юзер с id, то продолжаем
                if (decoded.userId) {
                    ctx.state.userId = decoded.userId;

                    console.log('decoded.userId', decoded.userId)
                    // Мы успешно проверили токен,
                    // отправляем статус 200
                    console.log('Успешная проверка токена!');
                    ctx.response.status = 200;
                    ctx.response.body = {
                        message: 'Успешная проверка токена!',
                        status: 'ok'
                    }

                    // Передаем работу следующими мидлваре или возвращаемся к нам
                    await next();
                }
            }
        }
    } catch (err) {
        console.error('Время токена истекло( Возьмите новый! ' + err.message);
        ctx.status = 400;
        ctx.response.body = {
            message: 'Время токена истекло( Возьмите новый! ' + err.message,
            status: 'error'
        }
    }
};