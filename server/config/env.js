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

// 统一读取环境变量，避免业务代码里散落 process.env
export const env = {
  port: Number(process.env.PORT || 3001),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI || '',
  jwtSecret: process.env.JWT_SECRET || 'campuspilot-dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxUploadSize: Number(process.env.MAX_UPLOAD_SIZE || 10 * 1024 * 1024),
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