import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { env } from '../config/env.js'

// 生成 JWT，载荷中只放非敏感信息
export const signToken = (user) =>
  jwt.sign({ userId: String(user._id), role: user.role || 'student' }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn
  })

// 校验 JWT，失败时抛出异常交给调用方处理
export const verifyToken = (token) => jwt.verify(token, env.jwtSecret)

// 密码哈希：bcrypt 自动加盐
export const hashPassword = (plain) => bcrypt.hash(plain, 10)

// 密码校验
export const comparePassword = (plain, hash) => bcrypt.compare(plain, hash)

// 生成随机 ID（本地文件存储模式下作为主键）
export const newId = () => crypto.randomUUID()

// 生成小组邀请码
export const newInviteCode = () => crypto.randomBytes(3).toString('hex').toUpperCase()