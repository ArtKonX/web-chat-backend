// Для .env
require('dotenv').config();

const mysql = require('mysql');

module.exports = pool = mysql.createPool({
    host: process.env.host_db,
    port: process.env.port_db,
    user: process.env.user_db,
    password: process.env.password_db,
    database: process.env.database_db,
    connectionLimit: 30,
    waitForConnections: true,
    connectTimeout: 60 * 60 * 1000,
    acquireTimeout: 60 * 60 * 1000,
    multipleStatements: true
});