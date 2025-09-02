const cities = require("../../data/cities.json");

module.exports = QueryGetCities = (ctx) => {
    try {
        const { q } = ctx.request.query;

        // Если у нас в запросе пусто или пробел нам нужно
        // вернуть все возможные города
        if (!q.trim()) {

            // Статус 201 Все города найдены)
            console.log('Успешное получение всех городов');
            ctx.response.status = 201;
            ctx.response.body = {
                cities: cities,
                message: 'Успешное получение всех городов',
                status: 'ok'
            }

            return
        } else {
            // Если мы все таки что-то прописали это
            // нужно найти...

            const findNeededCities = cities.filter(city => city.name.includes(q));

            // Если мы нашли хотябы один город возвращем массив с
            // этим городом или городами
            if (findNeededCities.length > 0) {

                console.log('Успешное получение всех городов');
                ctx.response.status = 201;
                ctx.response.body = {
                    cities: findNeededCities,
                    message: 'Успешное получение всех городов',
                    status: 'ok'
                }

                return
            } else {
                // Если нет в массиве ни одного город, то возвращаем
                // все возвожные города
                console.log('Успешное получение всех городов');
                ctx.response.status = 201;
                ctx.response.body = {
                    cities: cities,
                    message: 'Успешное получение всех городов',
                    status: 'ok'
                }
            }
        }
    } catch (err) {
        console.log('Ошибка при получении городов(');
        ctx.response.status = 500;
        ctx.response.body = {
            message: 'Ошибка при получении городов( ' + err.message,
            status: 'error'
        }
    }
}