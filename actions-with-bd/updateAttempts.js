module.exports = async function updateAttempts(connection, userId, newAttempts) {
    return new Promise((resolve, reject) => {
        connection.query(
            'UPDATE users_warning SET fa2_attempts = ? WHERE id = ?',
            [newAttempts, userId],
            (err, result) => {
                if (err) {
                    return reject(err);
                }
                resolve(result);
            }
        );
    });
}