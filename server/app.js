import path from 'node:path'
import express from 'express'
import cors from 'cors'
import routes from './routes/index.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'
import { env } from './config/env.js'

const app = express()

app.use(cors({ origin: env.clientUrl, credentials: true }))
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))

// 静态托管上传的资料
app.use('/uploads', express.static(path.resolve(process.cwd(), env.uploadDir)))

// 业务接口统一挂在 /api 下
app.use('/api', routes)

// 生产环境由同一个进程托管前端构建产物，部署更简单
if (env.nodeEnv === 'production') {
  const dist = path.resolve(process.cwd(), 'dist')
  app.use(express.static(dist))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next()
    res.sendFile(path.join(dist, 'index.html'))
  })
}

app.use(notFoundHandler)
app.use(errorHandler)

export default app