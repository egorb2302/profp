import express from 'express';
import session from 'express-session';
import path from 'node:path';
import { auth, requireUser } from './auth';
import { fileURLToPath } from 'node:url';
import { recipes, uploadDirectory } from './recipes';
import { admin } from './admin';
import { existsSync } from 'node:fs';
import { db } from './db';

const app = express()
const root = fileURLToPath(new URL('../', import.meta.url));

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'champtask') {
    throw new Error('Add SESSION_SECRET here')
}

app.set('query parser', 'extended');
app.set('view engine', 'ejs');
app.set('views', path.join(root, 'server/views'));

app.use(express.json({ limit: 'lmb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadDirectory));
app.use('/uploads', (_req, res) => {
    res.status(404).json({ message: 'Image not found' })
})
app.use(express.static(path.join(root, 'public')));
app.use('/admin', session({ secret: process.env.SESSION_SECRET, resave: false, 
    saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'lax', maxAge: 3 * 60 * 60 * 1000 } }), admin);
app.use('/api', auth);
app.use('/api', requireUser);

app.get('/api/me', (req, res) => {
    res.json(req.user);
})
app.post('/api/logout', async (req, res) => {
    await query('UPDATE users SET token=NULL WHERE id=?', [req.user.id]);
    res.json({ success: true });
})
app.get('/api/categories', async (_req, res) => {
    res.json(await query('SELECT * FROM categories ORDER BY name'))
})
app.get('/api/igredients', async (_req, res) => {
    res.json(await query('SELECT * FROM ingredients ORDER BY title'))
})
app.use('/api/recipes', recipes);
app.use('/api', (_req, res) => {
    res.status(404).json({ message: 'Not found'});
})
const dist = path.join(root, 'client/dist');
app.use(express.static(dist));
app.get('/{*splat}', (req, res) => {
    existsSync(path.join(dist, 'index.html')) 
        ? res.sendFile(path.join(dist, 'index.html'))   
        : res.status(503).send('Run Vite for dev mode or use npm run build')
})
app.use((error, req, res, next) => {
    let status = error.status || 500;
    let message = error.message;
    let errors = error.errors;
    if (error.name === 'MulterError') {
        status = 422;
        message = 'Invalid fields';
        errors = { image: ['Max 2mb for file, max 10 new images for req']};
    }
    if (error.code === 'ER_CO_REFERENCED_ROW_2') {
        status = 422;
        message = 'Invalid fields';
        errors = { category_id: ['Category or ingredients not exists yet']}
    }
    if (status === 500) {
        console.error(error.code || error.name);
        message = 'Server error';
    }
})
await query('SELECT 1');
const server = app.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => {
    console.log(`App is running, port ${process.env.PORT || 3000}`)
});
process.on('SIGTERM', () => {
    server.close(async () => { await db.end()});
    process.exit(0);
});



