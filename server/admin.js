import { Router } from 'express';

export const admin = Router();
admin.get('/', (_req, res) => {
    res.send('Admin panel would be able to use in stage 6')
})