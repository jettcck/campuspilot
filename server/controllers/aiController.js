import { collection } from '../utils/store.js'
import { ApiError, asyncHandler, ok } from '../utils/http.js'
import { serialize } from '../utils/serialize.js'
import { aiService } from '../services/aiService.js'

export const aiController = {
  /** AI 连通性自检：确认 Key 是否真正接通 */
  status: asyncHandler(async (_req, res) => {
    const status = await aiService.status()
    ok(res, status)
  }),

  /** 学习问答：记录对话历史 */
  chat: asyncHandler(async (req, res) => {
    const prompt = String(req.body.prompt || '').trim()
    if (!prompt) throw new ApiError(400, '请输入学习问题', 'PARAM_MISSING')

    const { reply, provider } = await aiService.chat(prompt)
    await collection('aichats').insert({ userId: req.user.id, scene: 'chat', prompt, reply })
    ok(res, { reply, provider, prompt })
  }),

  /** 生成学习计划并落库 */
  studyPlan: asyncHandler(async (req, res) => {
    const goal = String(req.body.goal || '').trim()
    if (!goal) throw new ApiError(400, '请输入学习目标', 'PARAM_MISSING')
    const days = Math.min(Math.max(Number(req.body.days) || 7, 1), 30)

    const result = await aiService.studyPlan(goal, days)
    const plan = await collection('studyplans').insert({
      userId: req.user.id,
      title: goal.slice(0, 30),
      goal,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + days * 86400000).toISOString().slice(0, 10),
      steps: result.steps,
      progress: 0,
      status: 'active'
    })
    ok(res, { plan: serialize(plan), ai: result }, '学习计划已生成', 201)
  }),

  /** 资料总结 */
  summarize: asyncHandler(async (req, res) => {
    const text = String(req.body.text || req.body.prompt || '').trim()
    if (!text) throw new ApiError(400, '请输入需要总结的内容', 'PARAM_MISSING')
    const { summary, provider } = await aiService.summarize(text)
    await collection('aichats').insert({ userId: req.user.id, scene: 'summarize', prompt: text, reply: summary })
    ok(res, { summary, provider })
  }),

  /** 生成自测题 */
  quiz: asyncHandler(async (req, res) => {
    const topic = String(req.body.topic || req.body.prompt || '').trim()
    if (!topic) throw new ApiError(400, '请输入知识点', 'PARAM_MISSING')
    const { quiz, provider } = await aiService.quiz(topic)
    await collection('aichats').insert({ userId: req.user.id, scene: 'quiz', prompt: topic, reply: quiz })
    ok(res, { quiz, provider })
  }),

  /** 对话历史 */
  history: asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 20, 100)
    const chats = await collection('aichats').find({ userId: req.user.id }, { sort: { createdAt: -1 }, limit })
    ok(res, { history: chats.map(serialize) })
  }),

  /** 基于学习数据生成个性化建议 */
  advise: asyncHandler(async (req, res) => {
    const { statsService } = await import('../services/statsService.js')
    const stats = await statsService.overview(req.user.id)
    const advice = await aiService.advise(stats)
    ok(res, { advice, stats })
  })
}