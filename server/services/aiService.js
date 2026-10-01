import { env } from '../config/env.js'

/**
 * AI 服务层
 * 设计目标：屏蔽具体模型厂商差异，业务层只调用统一方法。
 * - 配置了 AI_API_KEY：走 OpenAI 兼容的 /chat/completions 接口
 *   （OpenAI、DeepSeek、通义千问兼容模式、智谱、Ollama 均可使用同一套协议）
 * - 未配置：使用内置的规则引擎生成结果，保证项目在无 Key 时依旧可演示
 */

const SYSTEM_PROMPTS = {
  chat: '你是 CampusPilot 的学习助手，面向中国大学生。回答要具体、可执行，优先给出步骤和示例，语言简洁。',
  plan: '你是学习规划助手。用户会给你学习目标与天数，你只输出一个 JSON 数组，不要 markdown 代码块、不要任何解释文字。每项格式：{"day":1,"title":"当天主题","minutes":60,"point":"一句话要点"}',
  summarize: '你是资料整理助手。请把用户提供的课程资料压缩成结构化摘要：核心概念、关键结论、易错点。',
  quiz: '你是出题助手。请根据知识点生成题目，包含题干、选项（如有）、答案与解析。'
}

/** 把 HTTP 状态码翻译成可读原因，便于接入 Key 时快速定位问题 */
const STATUS_HINTS = {
  400: '请求参数有误，通常是模型名不存在',
  401: 'API Key 无效或未通过鉴权，请检查 AI_API_KEY',
  402: '账户余额不足，请前往厂商控制台充值',
  403: 'Key 无该模型的访问权限',
  404: '接口地址不存在，请检查 AI_BASE_URL 与 AI_PROVIDER 是否匹配',
  422: '参数校验失败，可能是模型名不被支持',
  429: '请求频率或额度超限，稍后重试或更换 Key'
}

/** 统一调用大模型；无 Key 时返回 null 由调用方走本地兜底 */
async function callModel(scene, prompt) {
  if (!env.ai.apiKey) return null
  const endpoint = `${env.ai.baseUrl.replace(/\/$/, '')}/chat/completions`
  let response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.ai.apiKey}`
      },
      body: JSON.stringify({
        model: env.ai.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPTS[scene] || SYSTEM_PROMPTS.chat },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      })
    })
  } catch (error) {
    throw new Error(`无法连接 ${env.ai.providerLabel}（${env.ai.baseUrl}）：${error.message}`)
  }

  if (!response.ok) {
    const detail = await response.text()
    const hint = STATUS_HINTS[response.status] || '未知错误'
    throw new Error(`${env.ai.providerLabel} 调用失败(${response.status})：${hint}｜原始返回：${detail.slice(0, 200)}`)
  }
  const payload = await response.json()
  return payload.choices?.[0]?.message?.content?.trim() || null
}

/* ------------------------------- 本地规则引擎 ------------------------------- */

const FALLBACK_TEMPLATES = {
  chat: (prompt) => `关于「${prompt}」，建议按下面的顺序推进：
1. 先用 10 分钟梳理已知条件和目标，写下你确定掌握的部分。
2. 用 25 分钟集中攻克一个最小知识点，做完立刻合上资料复述一遍。
3. 休息 5 分钟后，用 15 分钟做 3 道相关练习检验理解。
4. 把今天没弄懂的点记录到错题本，明天优先复习。

如果你告诉我具体课程和截止时间，我可以继续帮你拆成每日任务。`,
  summarize: (prompt) => `【资料摘要】${prompt.slice(0, 40)}
· 核心概念：围绕主题的 3 个关键定义与适用场景。
· 关键结论：先掌握主干流程，再补充细节参数。
· 易错点：边界条件、单位换算、公式适用前提。
· 复习建议：24 小时内复述一次，一周内重做练习。`,
  quiz: (prompt) => `【自测题】${prompt.slice(0, 40)}
1. 选择题：该知识点最核心的作用是什么？（答案见解析）
2. 填空：请补充完整流程中的关键步骤。
3. 简答：举一个你课程中的实际例子并说明理由。
解析：重点在于理解适用条件，而不是死记结论。`
}

/** 把模型返回的文本解析成结构化步骤；解析失败返回 null，由调用方退回模板 */
function parsePlanSteps(raw, days) {
  if (!raw) return null
  // 兼容模型仍把 JSON 包在 ```json 代码块里的情况
  const cleaned = String(raw).replace(/```[a-zA-Z]*/g, '').trim()
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start === -1 || end <= start) return null

  let list
  try {
    list = JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    return null
  }
  if (!Array.isArray(list) || list.length === 0) return null

  return list.slice(0, days).map((item, index) => ({
    day: Number(item?.day) || index + 1,
    title: String(item?.title || `第 ${index + 1} 天`).slice(0, 60),
    minutes: Number(item?.minutes) || 60,
    point: String(item?.point || item?.desc || item?.detail || '').slice(0, 120),
    done: false
  }))
}

/**
 * 生成学习计划步骤
 * 注意：必须返回结构化数组。模型输出的是自由文本，直接当成 steps 返回会让
 * 前端对字符串调用 .map() 而整页崩溃，因此这里强制解析成 JSON，失败则退回模板。
 */
async function generatePlanSteps(goal, days = 7) {
  const prompt = `学习目标：${goal}。请拆成 ${days} 天。只返回 JSON 数组，不要 markdown 代码块，不要任何解释文字。`
  const raw = await callModel('plan', prompt).catch(() => null)
  const steps = parsePlanSteps(raw, days)
  if (steps) return { steps, usedAi: true }

  const phase = ['基础概念与术语', '核心流程与原理', '典型例题精讲', '动手实践与调试', '综合练习', '查漏补缺', '复盘与自测']
  return {
    steps: Array.from({ length: days }).map((_, index) => ({
      day: index + 1,
      title: `第 ${index + 1} 天：${phase[index % phase.length]}`,
      minutes: index % 3 === 2 ? 90 : 60,
      point: `${goal} 的${phase[index % phase.length]}，完成后做一次 3 分钟复述`,
      done: false
    })),
    usedAi: false
  }
}

/* --------------------------------- 对外接口 --------------------------------- */

export const aiService = {
  /** 场景化对话 */
  async chat(prompt) {
    const ai = await callModel('chat', prompt).catch((error) => {
      console.warn('[ai] 调用失败，使用本地兜底：', error.message)
      return null
    })
    return { reply: ai || FALLBACK_TEMPLATES.chat(prompt), provider: ai ? env.ai.model : 'local-fallback' }
  },

  /** 资料总结 */
  async summarize(text) {
    const input = String(text || '').trim()
    if (!input) throw new Error('缺少需要总结的内容')
    const ai = await callModel('summarize', input).catch(() => null)
    return { summary: ai || FALLBACK_TEMPLATES.summarize(input), provider: ai ? env.ai.model : 'local-fallback' }
  },

  /** 生成练习/自测题 */
  async quiz(topic) {
    const input = String(topic || '').trim()
    if (!input) throw new Error('缺少知识点')
    const ai = await callModel('quiz', input).catch(() => null)
    return { quiz: ai || FALLBACK_TEMPLATES.quiz(input), provider: ai ? env.ai.model : 'local-fallback' }
  },

  /** 生成学习计划 */
  async studyPlan(goal, days = 7) {
    const input = String(goal || '').trim()
    if (!input) throw new Error('缺少学习目标')
    // 只调用一次模型：步骤由同一份 JSON 产出，避免重复计费
    const { steps, usedAi } = await generatePlanSteps(input, days)
    return { goal: input, days, steps, provider: usedAi ? env.ai.model : 'local-fallback' }
  },

  /**
   * 连通性自检：返回当前 AI 配置与真实可用性
   * 用于部署后确认 Key 是否真正接通，而不是静默走兜底
   */
  async status() {
    const base = {
      provider: env.ai.provider,
      providerLabel: env.ai.providerLabel,
      model: env.ai.model,
      baseUrl: env.ai.baseUrl,
      keyUrl: env.ai.keyUrl,
      configured: Boolean(env.ai.apiKey)
    }
    if (!env.ai.apiKey) {
      return { ...base, reachable: false, mode: 'local-fallback', message: '未配置 AI_API_KEY，当前使用内置规则引擎' }
    }
    try {
      const reply = await callModel('chat', '回复两个字：正常')
      return { ...base, reachable: true, mode: 'remote', message: `已连接 ${env.ai.providerLabel}，模型 ${env.ai.model}，示例返回：${String(reply).slice(0, 40)}` }
    } catch (error) {
      return { ...base, reachable: false, mode: 'remote-error', message: error.message }
    }
  },

  /** 根据学习数据生成个性化建议 */
  async advise(stats) {
    const ai = await callModel('chat', `我的学习数据：${JSON.stringify(stats)}，请给出 3 条改进建议。`).catch(() => null)
    if (ai) return ai
    return `本周完成率 ${stats.completionRate}%，建议：
1. 把大任务拆成 25 分钟以内的小块，降低启动阻力。
2. 每天固定一个不可移动的学习时段，优先处理高优先级任务。
3. 对未完成的任务做一次原因复盘，区分「没时间」和「不会做」。`
  }
}