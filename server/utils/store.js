import fs from 'node:fs'
import path from 'node:path'
import mongoose from 'mongoose'
import { newId } from './security.js'
import { getModel, collectionNames } from '../config/schemas.js'
import { env } from '../config/env.js'

/**
 * 数据访问层
 * - 未配置 MONGODB_URI：使用 server/data/db.json 本地文件存储，零依赖即可运行
 * - 配置了 MONGODB_URI：自动切换为 MongoDB
 * 两种模式对外暴露完全一致的异步接口，因此上层控制器无需区分。
 */

const DATA_DIR = path.resolve(process.cwd(), 'server', 'data')
const DATA_FILE = path.join(DATA_DIR, 'db.json')

let memory = null
let mongoReady = false
let driver = 'file'

function loadMemory() {
  if (memory) return memory
  memory = Object.fromEntries(collectionNames.map((name) => [name, []]))
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
      for (const name of collectionNames) {
        if (Array.isArray(raw[name])) memory[name] = raw[name]
      }
    }
  } catch (error) {
    console.warn('[store] 本地数据读取失败，已按空数据启动：', error.message)
  }
  return memory
}

function saveMemory() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(DATA_FILE, JSON.stringify(memory, null, 2), 'utf8')
  } catch (error) {
    console.warn('[store] 本地数据写入失败：', error.message)
  }
}

/** 连接数据库；MongoDB 不可用时自动降级到本地文件存储 */
export async function connectDatabase(uri = env.mongoUri) {
  if (!uri) {
    driver = 'file'
    loadMemory()
    console.log('[store] 未配置 MONGODB_URI，使用本地文件存储（server/data/db.json）')
    return driver
  }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 })
    mongoReady = true
    driver = 'mongo'
    console.log('[store] MongoDB 连接成功')
  } catch (error) {
    mongoReady = false
    driver = 'file'
    loadMemory()
    console.warn('[store] MongoDB 连接失败，已降级为本地文件存储：', error.message)
  }
  return driver
}

export const getDriver = () => driver
export const isMongoReady = () => mongoReady

/* ------------------------------ 查询条件匹配 ------------------------------ */

function matchValue(value, condition) {
  if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
    const keys = Object.keys(condition)
    return keys.every((key) => {
      const target = condition[key]
      if (key === '$in') return Array.isArray(target) && target.map(String).includes(String(value))
      if (key === '$nin') return Array.isArray(target) && !target.map(String).includes(String(value))
      if (key === '$ne') return String(value) !== String(target)
      if (key === '$regex') return new RegExp(target, condition.$options || 'i').test(String(value ?? ''))
      if (key === '$gte') return value >= target
      if (key === '$lte') return value <= target
      return false
    })
  }
  if (Array.isArray(value)) return value.map(String).includes(String(condition))
  return String(value) === String(condition)
}

function matches(doc, filter = {}) {
  return Object.keys(filter).every((key) => {
    if (key === '$or') return filter.$or.some((sub) => matches(doc, sub))
    return matchValue(doc[key], filter[key])
  })
}

function sortDocs(list, sort) {
  const entries = Object.entries(sort)
  return [...list].sort((a, b) => {
    for (const [field, direction] of entries) {
      const left = a[field] ?? ''
      const right = b[field] ?? ''
      if (left === right) continue
      return (left > right ? 1 : -1) * (direction < 0 ? -1 : 1)
    }
    return 0
  })
}

const stamp = (doc) => ({ ...doc, createdAt: doc.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() })

/* ------------------------------ 本地文件适配器 ------------------------------ */

function fileAdapter(name) {
  const all = () => loadMemory()[name]
  return {
    async find(filter = {}, options = {}) {
      let list = all().filter((doc) => matches(doc, filter))
      if (options.sort) list = sortDocs(list, options.sort)
      if (options.limit) list = list.slice(0, options.limit)
      return JSON.parse(JSON.stringify(list))
    },
    async findOne(filter) {
      return JSON.parse(JSON.stringify(all().find((doc) => matches(doc, filter)) || null))
    },
    async findById(id) {
      return JSON.parse(JSON.stringify(all().find((doc) => String(doc._id) === String(id)) || null))
    },
    async insert(doc) {
      const created = stamp({ _id: newId(), ...doc })
      all().push(created)
      saveMemory()
      return { ...created }
    },
    async updateById(id, patch) {
      const index = all().findIndex((doc) => String(doc._id) === String(id))
      if (index === -1) return null
      all()[index] = { ...all()[index], ...patch, updatedAt: new Date().toISOString() }
      saveMemory()
      return { ...all()[index] }
    },
    async deleteById(id) {
      const index = all().findIndex((doc) => String(doc._id) === String(id))
      if (index === -1) return false
      all().splice(index, 1)
      saveMemory()
      return true
    },
    async deleteMany(filter = {}) {
      const list = all()
      const removed = list.filter((doc) => matches(doc, filter))
      loadMemory()[name] = list.filter((doc) => !matches(doc, filter))
      saveMemory()
      return removed.length
    },
    async count(filter = {}) {
      return all().filter((doc) => matches(doc, filter)).length
    }
  }
}

/* ------------------------------ MongoDB 适配器 ------------------------------ */

const toPlain = (doc) => (doc ? JSON.parse(JSON.stringify(doc)) : null)

function mongoAdapter(name) {
  const Model = getModel(name)
  return {
    async find(filter = {}, options = {}) {
      let query = Model.find(filter)
      if (options.sort) query = query.sort(options.sort)
      if (options.limit) query = query.limit(options.limit)
      return (await query.lean()).map(toPlain)
    },
    async findOne(filter) {
      return toPlain(await Model.findOne(filter).lean())
    },
    async findById(id) {
      if (!mongoose.isValidObjectId(id)) return null
      return toPlain(await Model.findById(id).lean())
    },
    async insert(doc) {
      const created = await Model.create(doc)
      return toPlain(created.toObject())
    },
    async updateById(id, patch) {
      if (!mongoose.isValidObjectId(id)) return null
      return toPlain(await Model.findByIdAndUpdate(id, patch, { new: true }).lean())
    },
    async deleteById(id) {
      if (!mongoose.isValidObjectId(id)) return false
      const result = await Model.findByIdAndDelete(id)
      return Boolean(result)
    },
    async deleteMany(filter = {}) {
      const result = await Model.deleteMany(filter)
      return result.deletedCount || 0
    },
    async count(filter = {}) {
      return Model.countDocuments(filter)
    }
  }
}

/** 获取集合操作对象 */
export function collection(name) {
  if (!collectionNames.includes(name)) throw new Error(`未定义的集合：${name}`)
  return mongoReady ? mongoAdapter(name) : fileAdapter(name)
}