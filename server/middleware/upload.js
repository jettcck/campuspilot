import fs from 'node:fs'
import path from 'node:path'
import multer from 'multer'
import { env } from '../config/env.js'
import { newId } from '../utils/security.js'
import { ApiError } from '../utils/http.js'

const uploadRoot = path.resolve(process.cwd(), env.uploadDir)
fs.mkdirSync(uploadRoot, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadRoot),
  filename: (_req, file, cb) => {
    // 使用随机名避免覆盖，同时保留原始扩展名
    const ext = path.extname(file.originalname)
    cb(null, `${Date.now()}-${newId()}${ext}`)
  }
})

const allowed = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.txt', '.md', '.png', '.jpg', '.jpeg', '.zip']

export const upload = multer({
  storage,
  limits: { fileSize: env.maxUploadSize },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (!allowed.includes(ext)) return cb(new ApiError(400, `不支持的文件类型：${ext}`, 'FILE_TYPE_NOT_ALLOWED'))
    cb(null, true)
  }
})

export const UPLOAD_ROOT = uploadRoot