module.exports = getConnection = async (pool) => {
    try {
        console.log('Начинаем подключение к БД');

        const connection = await new Promise((resolve, reject) => {

            const timeout = setTimeout(() => {
                reject(new Error('Timeout: не удалось подключиться к БД за 10 сек'));
            }, 10000);

            pool.getConnection((err, conn) => {
                clearTimeout(timeout);

                if (err) {
                    console.error('Ошибка подключения к БД:', err.message);
                    return reject(err);
                }

                console.log('Успешное подключение к БД');
                resolve(conn);
            });
        });

        return connection;
    } catch (err) {
        console.error('Критическая ошибка при получении соединения:', err.message);
        throw err;
    }
};