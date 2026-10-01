import { collection } from '../utils/store.js'
import { ApiError, asyncHandler, ok } from '../utils/http.js'
import { newInviteCode } from '../utils/security.js'
import { serialize } from '../utils/serialize.js'

export const groupController = {
  /** 我参与的小组 */
  list: asyncHandler(async (req, res) => {
    const groups = await collection('groups').find({ memberIds: { $in: [req.user.id] } }, { sort: { createdAt: -1 } })
    const users = collection('users')
    const enriched = []
    for (const group of groups) {
      const members = await users.find({ _id: { $in: group.memberIds || [] } })
      enriched.push({
        ...serialize(group),
        memberCount: (group.memberIds || []).length,
        members: members.map((member) => ({ id: serialize(member).id, username: member.username, avatar: member.avatar }))
      })
    }
    ok(res, { groups: enriched })
  }),

  create: asyncHandler(async (req, res) => {
    const { name, description } = req.body
    if (!name) throw new ApiError(400, '小组名称不能为空', 'PARAM_MISSING')
    const group = await collection('groups').insert({
      name,
      description: description || '',
      ownerId: req.user.id,
      memberIds: [req.user.id],
      inviteCode: newInviteCode()
    })
    ok(res, { group: serialize(group) }, '小组创建成功', 201)
  }),

  /** 使用邀请码加入小组 */
  join: asyncHandler(async (req, res) => {
    const code = String(req.body.inviteCode || '').trim().toUpperCase()
    if (!code) throw new ApiError(400, '请输入邀请码', 'PARAM_MISSING')

    const groups = collection('groups')
    const group = await groups.findOne({ inviteCode: code })
    if (!group) throw new ApiError(404, '邀请码无效', 'INVITE_INVALID')
    if ((group.memberIds || []).includes(req.user.id)) throw new ApiError(409, '你已在该小组中', 'ALREADY_JOINED')

    const updated = await groups.updateById(group._id, { memberIds: [...(group.memberIds || []), req.user.id] })
    ok(res, { group: serialize(updated) }, '已加入小组')
  }),

  remove: asyncHandler(async (req, res) => {
    const groups = collection('groups')
    const group = await groups.findById(req.params.id)
    if (!group) throw new ApiError(404, '小组不存在', 'GROUP_NOT_FOUND')
    if (group.ownerId !== req.user.id) throw new ApiError(403, '只有组长可以解散小组', 'FORBIDDEN')
    await groups.deleteById(req.params.id)
    ok(res, null, '小组已解散')
  })
}

export const noticeController = {
  list: asyncHandler(async (req, res) => {
    const filter = {}
    if (req.query.category) filter.category = req.query.category
    const notices = await collection('notices').find(filter, { sort: { publishAt: -1 }, limit: 50 })
    ok(res, { notices: notices.map(serialize) })
  }),

  create: asyncHandler(async (req, res) => {
    const { title, category, content, source } = req.body
    if (!title) throw new ApiError(400, '公告标题不能为空', 'PARAM_MISSING')
    const notice = await collection('notices').insert({
      title,
      category: category || '通知',
      content: content || '',
      source: source || req.user.username,
      publishAt: new Date().toISOString()
    })
    ok(res, { notice: serialize(notice) }, '公告发布成功', 201)
  })
}

export const statsController = {
  overview: asyncHandler(async (req, res) => {
    const { statsService } = await import('../services/statsService.js')
    ok(res, { stats: await statsService.overview(req.user.id) })
  }),
  weekly: asyncHandler(async (req, res) => {
    const { statsService } = await import('../services/statsService.js')
    ok(res, { weekly: await statsService.weekly(req.user.id) })
  })
}