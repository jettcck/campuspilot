import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { upload } from '../middleware/upload.js'
import { validate } from '../middleware/validate.js'
import { aiLimiter, authLimiter } from '../middleware/security.js'
import {
  aiChatSchema,
  aiPlanSchema,
  aiQuizSchema,
  aiSummarizeSchema,
  courseCreateSchema,
  courseUpdateSchema,
  groupCreateSchema,
  groupJoinSchema,
  listQuerySchema,
  loginSchema,
  noticeCreateSchema,
  planStepSchema,
  registerSchema,
  taskCreateSchema,
  taskStatusSchema,
  taskUpdateSchema,
  updatePasswordSchema,
  updateProfileSchema
} from '../validation/schemas.js'
import { authController } from '../controllers/authController.js'
import { healthController } from '../controllers/healthController.js'
import { onboardingController } from '../controllers/onboardingController.js'
import { taskController } from '../controllers/taskController.js'
import { courseController, fileController } from '../controllers/courseController.js'
import { planController } from '../controllers/planController.js'
import { aiController } from '../controllers/aiController.js'
import { groupController, noticeController, statsController } from '../controllers/socialController.js'

const router = Router()

/* ------------------------------- 健康检查 ------------------------------- */
// 存活探针（容器重启判定）与就绪探针（流量接入判定）分离
router.get('/health', healthController.live)
router.get('/health/ready', healthController.ready)

/* --------------------------------- 认证 --------------------------------- */
router.post('/auth/register', authLimiter, validate(registerSchema), authController.register)
router.post('/auth/login', authLimiter, validate(loginSchema), authController.login)
router.get('/auth/me', requireAuth, authController.me)
router.put('/auth/profile', requireAuth, validate(updateProfileSchema), authController.updateProfile)
router.put('/auth/password', requireAuth, validate(updatePasswordSchema), authController.updatePassword)

/* ------------------------------- 新用户引导 ------------------------------ */
router.get('/onboarding/status', requireAuth, onboardingController.status)
router.post('/onboarding/sample-data', requireAuth, onboardingController.importSampleData)

/* --------------------------------- 任务 --------------------------------- */
router.get('/tasks', requireAuth, validate(listQuerySchema, 'query'), taskController.list)
router.post('/tasks', requireAuth, validate(taskCreateSchema), taskController.create)
router.get('/tasks/:id', requireAuth, taskController.detail)
router.put('/tasks/:id', requireAuth, validate(taskUpdateSchema), taskController.update)
router.patch('/tasks/:id/status', requireAuth, validate(taskStatusSchema), taskController.updateStatus)
router.delete('/tasks/:id', requireAuth, taskController.remove)

/* --------------------------------- 课程 --------------------------------- */
router.get('/courses', requireAuth, validate(listQuerySchema, 'query'), courseController.list)
router.post('/courses', requireAuth, validate(courseCreateSchema), courseController.create)
router.put('/courses/:id', requireAuth, validate(courseUpdateSchema), courseController.update)
router.delete('/courses/:id', requireAuth, courseController.remove)

/* ------------------------------- 课程资料 ------------------------------- */
router.get('/files', requireAuth, validate(listQuerySchema, 'query'), fileController.list)
router.post('/files', requireAuth, upload.single('file'), fileController.upload)
router.post('/files/:id/summarize', requireAuth, aiLimiter, fileController.summarize)
router.delete('/files/:id', requireAuth, fileController.remove)

/* ------------------------------- 学习计划 ------------------------------- */
router.get('/study-plans', requireAuth, validate(listQuerySchema, 'query'), planController.list)
router.get('/study-plans/:id', requireAuth, planController.detail)
router.patch('/study-plans/:id/step', requireAuth, validate(planStepSchema), planController.updateStep)
router.delete('/study-plans/:id', requireAuth, planController.remove)

/* --------------------------------- AI ---------------------------------- */
router.get('/ai/status', aiController.status)
router.post('/ai/chat', requireAuth, aiLimiter, validate(aiChatSchema), aiController.chat)
router.post('/ai/study-plan', requireAuth, aiLimiter, validate(aiPlanSchema), aiController.studyPlan)
router.post('/ai/summarize', requireAuth, aiLimiter, validate(aiSummarizeSchema), aiController.summarize)
router.post('/ai/quiz', requireAuth, aiLimiter, validate(aiQuizSchema), aiController.quiz)
router.get('/ai/history', requireAuth, validate(listQuerySchema, 'query'), aiController.history)
router.get('/ai/advise', requireAuth, aiLimiter, aiController.advise)

/* --------------------------------- 小组 --------------------------------- */
router.get('/groups', requireAuth, groupController.list)
router.post('/groups', requireAuth, validate(groupCreateSchema), groupController.create)
router.post('/groups/join', requireAuth, validate(groupJoinSchema), groupController.join)
router.delete('/groups/:id', requireAuth, groupController.remove)

/* ------------------------------- 校园信息 ------------------------------- */
// 公告面向全校广播，发布权限收敛到教师与管理员，普通学生只读
router.get('/notices', validate(listQuerySchema, 'query'), noticeController.list)
router.post('/notices', requireAuth, requireRole('admin', 'teacher'), validate(noticeCreateSchema), noticeController.create)

/* --------------------------------- 统计 --------------------------------- */
router.get('/stats/overview', requireAuth, statsController.overview)
router.get('/stats/weekly', requireAuth, statsController.weekly)

export default router