module.exports = getStatuses = async (userId, currentUserId, connection) => {
    return await Promise.all([userId, currentUserId].map(async id => {
        const [dataStatus] = await new Promise((resolve, reject) => {
            connection.query(
                'SELECT * FROM users_statuses WHERE id = ?',
                [id],
                (err, results) => {
                    if (err) return reject(err);
                    resolve(results);
                }
            );
        });

        return dataStatus
    }))
}