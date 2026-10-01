import mongoose from 'mongoose'

/**
 * MongoDB 集合 Schema 定义
 * 只在配置了 MONGODB_URI 时生效；未配置时项目使用本地文件存储，
 * 两种模式共享同一套字段结构，业务代码无需感知差异。
 */
const definitions = {
  users: {
    username: String,
    email: { type: String, index: true },
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
    courseId: String,
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
    ownerId: String,
    memberIds: [String],
    inviteCode: String
  },
  notices: {
    title: String,
    category: String,
    content: String,
    source: String,
    publishAt: String
  },
  files: {
    userId: String,
    courseId: String,
    filename: String,
    fileUrl: String,
    fileType: String,
    fileSize: Number,
    extractedText: String,
    summary: String,
    tags: [String]
  },
  aichats: {
    userId: String,
    scene: String,
    prompt: String,
    reply: String
  }
}

const cache = new Map()

/** 获取（或懒加载创建）Mongoose 模型 */
export function getModel(name) {
  if (cache.has(name)) return cache.get(name)
  const definition = definitions[name]
  if (!definition) throw new Error(`未定义的集合：${name}`)
  const schema = new mongoose.Schema(definition, { timestamps: true, strict: false })
  const model = mongoose.models[name] || mongoose.model(name, schema)
  cache.set(name, model)
  return model
}

export const collectionNames = Object.keys(definitions)