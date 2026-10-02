import mongoose from 'mongoose'

/**
 * MongoDB 集合 Schema 定义
 * 只在配置了 MONGODB_URI 时生效；未配置时项目使用本地文件存储，
 * 两种模式共享同一套字段结构，业务代码无需感知差异。
 */
const definitions = {
  users: {
    username: String,
    // 邮箱是登录凭据，必须唯一：唯一索引兜住并发注册导致的重复账号
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: String,
    avatar: String,
    school: String,
    major: String,
    grade: String,
    role: { type: String, default: 'student' }
  },
  courses: {
    userId: { type: String, index: true },
    name: String,
    teacher: String,
    semester: String,
    color: String,
    description: String,
    tags: [String],
    progress: { type: Number, default: 0 },
    nextClass: String
  },
  tasks: {
    userId: { type: String, index: true },
    courseId: { type: String, index: true },
    title: String,
    meta: String,
    tag: String,
    color: String,
    priority: { type: String, default: 'medium' },
    status: { type: String, default: 'todo' },
    done: { type: Boolean, default: false },
    dueDate: String,
    estimatedMinutes: { type: Number, default: 30 }
  },
  studyplans: {
    userId: { type: String, index: true },
    title: String,
    goal: String,
    startDate: String,
    endDate: String,
    steps: [Object],
    progress: { type: Number, default: 0 },
    status: { type: String, default: 'active' }
  },
  groups: {
    name: String,
    description: String,
    ownerId: { type: String, index: true },
    memberIds: [String],
    // 邀请码是加入小组的唯一凭据，重复会导致加错小组
    inviteCode: { type: String, unique: true, index: true }
  },
  notices: {
    title: String,
    category: { type: String, index: true },
    content: String,
    source: String,
    publishAt: { type: String, index: true }
  },
  files: {
    userId: { type: String, index: true },
    courseId: { type: String, index: true },
    filename: String,
    fileUrl: String,
    fileType: String,
    fileSize: Number,
    extractedText: String,
    summary: String,
    tags: [String]
  },
  aichats: {
    userId: { type: String, index: true },
    scene: String,
    prompt: String,
    reply: String
  }
}

const cache = new Map()

/**
 * 复合索引：列表接口固定按「当前用户 + 创建时间倒序」翻页，
 * 单字段索引无法覆盖该排序，需要复合索引才能避免内存排序。
 */
const compoundIndexes = {
  tasks: [{ userId: 1, createdAt: -1 }],
  courses: [{ userId: 1, createdAt: 1 }],
  studyplans: [{ userId: 1, createdAt: -1 }],
  files: [{ userId: 1, createdAt: -1 }],
  aichats: [{ userId: 1, createdAt: -1 }]
}

/** 获取（或懒加载创建）Mongoose 模型 */
export function getModel(name) {
  if (cache.has(name)) return cache.get(name)
  const definition = definitions[name]
  if (!definition) throw new Error(`未定义的集合：${name}`)
  const schema = new mongoose.Schema(definition, { timestamps: true, strict: false })
  for (const index of compoundIndexes[name] || []) schema.index(index)
  const model = mongoose.models[name] || mongoose.model(name, schema)
  cache.set(name, model)
  return model
}

export const collectionNames = Object.keys(definitions)