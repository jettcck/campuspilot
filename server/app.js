import path from 'node:path'
import express from 'express'
import routes from './routes/index.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'
import { env, isProd } from './config/env.js'
import { httpLogger, requestContext } from './middleware/observability.js'
import { apiLimiter, compressionMiddleware, corsPolicy, securityHeaders } from './middleware/security.js'

const app = express()

// 部署在反向代理（Render / Nginx）之后，需信任一层代理才能取得真实客户端 IP
if (env.trustProxy) app.set('trust proxy', 1)
app.disable('x-powered-by')

// 请求追踪与访问日志最先执行，保证任何异常都带上 requestId
app.use(requestContext)
app.use(httpLogger)
app.use(securityHeaders)
app.use(corsPolicy)
app.use(compressionMiddleware)

// 请求体上限收敛到 1MB：接口本身不接收大文件，上传走 multipart
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

// 静态托管上传的资料
app.use(
  '/uploads',
  express.static(path.resolve(process.cwd(), env.uploadDir), {
    maxAge: isProd ? '7d' : 0,
    index: false,
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff')
  })
)

// 业务接口统一挂在 /api 下，并施加全局限流
app.use('/api', apiLimiter, routes)

// 生产环境由同一个进程托管前端构建产物，部署更简单
if (isProd) {
  const dist = path.resolve(process.cwd(), 'dist')
  app.use(express.static(dist, { index: false, maxAge: '1h' }))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next()
    res.sendFile(path.join(dist, 'index.html'))
  })
}

app.use(notFoundHandler)
app.use(errorHandler)

export default app