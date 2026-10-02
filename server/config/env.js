import path from 'node:path'
import dotenv from 'dotenv'

dotenv.config()

/**
 * 各大模型厂商的预设配置
 * 全部走 OpenAI 兼容的 /chat/completions 协议，因此只需切换 baseUrl 与 model
 * 参考价格与免费额度以厂商官网为准
 */
const PROVIDER_PRESETS = {
  deepseek: {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    keyUrl: 'https://platform.deepseek.com/api_keys'
  },
  qwen: {
    label: '通义千问（阿里云百炼）',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    keyUrl: 'https://bailian.console.aliyun.com/'
  },
  zhipu: {
    label: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys'
  },
  moonshot: {
    label: '月之暗面 Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
    keyUrl: 'https://platform.moonshot.cn/console/api-keys'
  },
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    keyUrl: 'https://platform.openai.com/api-keys'
  },
  ollama: {
    label: '本地 Ollama',
    baseUrl: 'http://localhost:11434/v1',
    model: 'qwen2.5',
    keyUrl: 'https://ollama.com/download'
  }
}

const providerKey = (process.env.AI_PROVIDER || 'deepseek').toLowerCase()
const preset = PROVIDER_PRESETS[providerKey] || PROVIDER_PRESETS.deepseek

const nodeEnv = process.env.NODE_ENV || 'development'

// 布尔开关：只有显式写成真值才生效，避免 "false" 被当作 true
const bool = (value, fallback = false) => (value === undefined ? fallback : /^(1|true|yes|on)$/i.test(String(value)))

// 逗号分隔的多值配置，用于同时放行本地、预览与正式域名
const list = (value, fallback = []) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .concat(fallback)

// 统一读取环境变量，避免业务代码里散落 process.env
export const env = {
  port: Number(process.env.PORT || 3001),
  nodeEnv,
  mongoUri: process.env.MONGODB_URI || '',
  // 生产环境使用本地文件存储会导致容器重建即丢数据，必须显式开启才允许
  allowFileStorage: bool(process.env.ALLOW_FILE_STORAGE, false),
  jwtSecret: process.env.JWT_SECRET || 'campuspilot-dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  corsOrigins: list(process.env.CLIENT_URL, nodeEnv === 'production' ? [] : ['http://localhost:5173', 'http://localhost:3001']),
  // 部署在 Render / Nginx 之后需信任一层代理，才能拿到真实客户端 IP（限流按 IP 统计依赖它）
  trustProxy: bool(process.env.TRUST_PROXY, nodeEnv === 'production'),
  logLevel: process.env.LOG_LEVEL || (nodeEnv === 'production' ? 'info' : 'debug'),
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  // 本地文件存储的数据目录，可指向临时目录以便测试与多实例隔离
  dataDir: process.env.DATA_DIR || path.resolve(process.cwd(), 'server', 'data'),
  maxUploadSize: Number(process.env.MAX_UPLOAD_SIZE || 10 * 1024 * 1024),
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    apiMax: Number(process.env.RATE_LIMIT_API_MAX || 600),
    authMax: Number(process.env.RATE_LIMIT_AUTH_MAX || 10),
    aiMax: Number(process.env.RATE_LIMIT_AI_MAX || 30)
  },
  ai: {
    provider: providerKey,
    providerLabel: preset.label,
    // 显式配置的环境变量优先于厂商预设，便于使用自定义网关或私有部署
    baseUrl: process.env.AI_BASE_URL || preset.baseUrl,
    model: process.env.AI_MODEL || preset.model,
    apiKey: process.env.AI_API_KEY || '',
    keyUrl: preset.keyUrl
  }
}

export const isProd = env.nodeEnv === 'production'
export { PROVIDER_PRESETS }

/**
 * 启动前配置校验
 * 生产环境缺失关键配置时直接启动失败，避免带着开发默认密钥
 * 或临时文件存储上线，造成安全事故与数据丢失。
 */
export function assertRuntimeConfig() {
  if (!isProd) return

  const problems = []
  const secret = String(process.env.JWT_SECRET || '').trim()
  if (!secret) problems.push('JWT_SECRET 未配置')
  else if (secret.length < 32) problems.push('JWT_SECRET 长度需不少于 32 位')
  else if (/change-me|dev-secret/i.test(secret)) problems.push('JWT_SECRET 仍为示例值，必须替换为随机密钥')

  if (!String(process.env.MONGODB_URI || '').trim() && !env.allowFileStorage) {
    problems.push('MONGODB_URI 未配置（如确认使用临时文件存储，请显式设置 ALLOW_FILE_STORAGE=true）')
  }

  if (String(process.env.AI_API_KEY || '').trim() && !String(env.ai.baseUrl || '').trim()) {
    problems.push('AI_API_KEY 已配置但 AI_BASE_URL 为空')
  }

  if (problems.length) {
    throw new Error(`生产环境配置校验未通过：\n  - ${problems.join('\n  - ')}`)
  }
}