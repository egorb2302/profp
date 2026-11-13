import express from 'express';

const app = express()
app.use(express.static('public'))
app.get('/api/ping', (_req, res) => {
    res.json({ ok: true })
})

app.listen(Number(process.env.PORT || 3000), process.env.HOST || `127.0.0.1`)
