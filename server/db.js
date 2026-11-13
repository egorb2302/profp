import mysql from 'mysql2/promise';

export const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: 'utf8mb4',
    decimalNumbers: true,
    connectionLimit: 5
});

export async function query(sql, values = [], connection = db) {
    const [rows] = await connection.query(sql, values)
    return rows
}

export function fail(status, message, errors) {
    const error = new Error(message);
    Object.assign(error, { status, errors });
    throw error;
}

export function invalid(errors) {
    if (Object.keys(errors).length) fail(422, 'Invalid fields', errors);
}