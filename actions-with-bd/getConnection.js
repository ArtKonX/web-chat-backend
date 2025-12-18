module.exports = getConnection = async (pool) => {
    try {
        return await new Promise((resolve, reject) => {
            console.log('Начинаем подключение к БД')

            pool.getConnection((err, conn) => {

                if (err) {
                    console.error('Ошибка подключения к БД:', err.message);
                    return reject(err);
                }

                // Возвращаем соединение
                console.log('Успешное подключение к БД')
                resolve(conn);
            });
        });
    } catch (err) {
        console.error(err)
    }
}