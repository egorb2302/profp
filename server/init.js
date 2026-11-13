import { readFile } from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import { db, query } from './db.js';


try {
    const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
    for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await query(statement);
    const email = process.env.ADMIN_EMAIL;
    if (!email) throw new Error('Add ADMIN_EMAIL');
    const [existing] = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (!existing) {
        if (!process.env.ADMIN_PASSWORD) throw new Error('Add ur ADMIN_PASSWORD');
        await query('INSERT INTO users(name, email, password, role) VALUES(?, ?, ?, ?)', 
            ['Admin', email, await bcrypt.hash(process.env.ADMIN_PASSWORD, 10), 'admin'])
    }
    console.log('Schema is ready; existing account of admin not been changed')
} finally {
    await db.end()
}