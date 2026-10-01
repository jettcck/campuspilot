import { collection } from '../utils/store.js'
import { ApiError, asyncHandler, ok } from '../utils/http.js'
import { serialize } from '../utils/serialize.js'

export const planController = {
  list: asyncHandler(async (req, res) => {
    const filter = { userId: req.user.id }
    if (req.query.status) filter.status = req.query.status
    const plans = await collection('studyplans').find(filter, { sort: { createdAt: -1 } })
    ok(res, { plans: plans.map(serialize) })
  }),

  detail: asyncHandler(async (req, res) => {
    const plan = await collection('studyplans').findById(req.params.id)
    if (!plan || plan.userId !== req.user.id) throw new ApiError(404, '学习计划不存在', 'PLAN_NOT_FOUND')
    ok(res, { plan: serialize(plan) })
  }),

  /** 勾选某一步骤，自动重算整体进度 */
  updateStep: asyncHandler(async (req, res) => {
    const plans = collection('studyplans')
    const plan = await plans.findById(req.params.id)
    if (!plan || plan.userId !== req.user.id) throw new ApiError(404, '学习计划不存在', 'PLAN_NOT_FOUND')

    const index = Number(req.body.index)
    const steps = [...(plan.steps || [])]
    if (!steps[index]) throw new ApiError(400, '步骤序号不正确', 'STEP_INVALID')

    steps[index] = { ...steps[index], done: Boolean(req.body.done) }
    const doneCount = steps.filter((step) => step.done).length
    const progress = steps.length ? Math.round((doneCount / steps.length) * 100) : 0

    const updated = await plans.updateById(req.params.id, {
      steps,
      progress,
      status: progress === 100 ? 'completed' : 'active'
    })
    ok(res, { plan: serialize(updated) }, '计划进度已更新')
  }),

  remove: asyncHandler(async (req, res) => {
    const plans = collection('studyplans')
    const plan = await plans.findById(req.params.id)
    if (!plan || plan.userId !== req.user.id) throw new ApiError(404, '学习计划不存在', 'PLAN_NOT_FOUND')
    await plans.deleteById(req.params.id)
    ok(res, null, '学习计划已删除')
  })
}