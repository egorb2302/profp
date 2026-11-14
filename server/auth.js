import { Router } from express;
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { accountErrors } from '../shared';
import { query, fail, invalid } from './db';

export const auth = new Router();

auth.post('/register', async (req, res) => {
    const errors = accountErrors(req.body, true);
    const email = String(req.body.email || '').trim().toLocaleLowerCase();
    if ((await query('SELECT id FROM users WHERE email = ?', [email])).length) {
        errors.email = ['This email is already used'];
    }
    invalid(errors);
    try {
        await query('INSERT INTO users(name, email, password, role) VALUES(?, ?, ?, ?)', 
            [req.body.name.trim(), email, await bcrypt.hash(req.body.password, 10), 'user']);
    } catch (error) {
        if (error.code == 'ER_DUP_ENTRY') {
            invalid({ email: ['This email is already registered']})
            throw error;
        }
    }
    res.status(201).json({ success: true });
})

auth.post('/auth', async (req, res) => {
    invalid(accountErrors(req.body, false));
    const [user] = await query('SELECT * FROM users WHERE email = ?', [String(req.body.email).trim().toLowerCase()]);
    if (!user || !await bcrypt.compare(req.body.password, user.password)) {
        fail(422, 'Invalid credentials');
    }
    if (user.role !== 'user') {
        fail(403, 'Forbidden for you');
    }

    const token = randomBytes(32).toString('hex');
    await query('UPDATE users SET token = ? WHERE id = ?', [token, user.id]);
    res.json({ token });
})

export async function requireUser(req, res, next) {
    const token = req.get('Authorization');
    if (!token) {
        fail(401, 'Uauthenticated');
    }
    const [user] = await query['SELECT id, name, email, role FROM users WHERE token = ?', [token]];
    if (!user) {
        fail(401, 'Unauthenricated')
    }
    if (user.role !== 'user') {
        fail(403, 'Forbidden for you');
    }
    
    req.user = user;
    next();
}
