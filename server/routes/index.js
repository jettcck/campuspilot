import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { upload } from '../middleware/upload.js'
import { authController } from '../controllers/authController.js'
import { taskController } from '../controllers/taskController.js'
import { courseController, fileController } from '../controllers/courseController.js'
import { planController } from '../controllers/planController.js'
import { aiController } from '../controllers/aiController.js'
import { groupController, noticeController, statsController } from '../controllers/socialController.js'

const router = Router()

/* ------------------------------- 健康检查 ------------------------------- */
router.get('/health', (_req, res) =>
  res.json({ success: true, message: 'CampusPilot API is running', data: { time: new Date().toISOString() } })
)

/* --------------------------------- 认证 --------------------------------- */
router.post('/auth/register', authController.register)
router.post('/auth/login', authController.login)
router.get('/auth/me', requireAuth, authController.me)
router.put('/auth/profile', requireAuth, authController.updateProfile)
router.put('/auth/password', requireAuth, authController.updatePassword)

/* --------------------------------- 任务 --------------------------------- */
router.get('/tasks', requireAuth, taskController.list)
router.post('/tasks', requireAuth, taskController.create)
router.get('/tasks/:id', requireAuth, taskController.detail)
router.put('/tasks/:id', requireAuth, taskController.update)
router.patch('/tasks/:id/status', requireAuth, taskController.updateStatus)
router.delete('/tasks/:id', requireAuth, taskController.remove)

/* --------------------------------- 课程 --------------------------------- */
router.get('/courses', requireAuth, courseController.list)
router.post('/courses', requireAuth, courseController.create)
router.put('/courses/:id', requireAuth, courseController.update)
router.delete('/courses/:id', requireAuth, courseController.remove)

/* ------------------------------- 课程资料 ------------------------------- */
router.get('/files', requireAuth, fileController.list)
router.post('/files', requireAuth, upload.single('file'), fileController.upload)
router.post('/files/:id/summarize', requireAuth, fileController.summarize)
router.delete('/files/:id', requireAuth, fileController.remove)

/* ------------------------------- 学习计划 ------------------------------- */
router.get('/study-plans', requireAuth, planController.list)
router.get('/study-plans/:id', requireAuth, planController.detail)
router.patch('/study-plans/:id/step', requireAuth, planController.updateStep)
router.delete('/study-plans/:id', requireAuth, planController.remove)

/* --------------------------------- AI ---------------------------------- */
router.get('/ai/status', aiController.status)
router.post('/ai/chat', requireAuth, aiController.chat)
router.post('/ai/study-plan', requireAuth, aiController.studyPlan)
router.post('/ai/summarize', requireAuth, aiController.summarize)
router.post('/ai/quiz', requireAuth, aiController.quiz)
router.get('/ai/history', requireAuth, aiController.history)
router.get('/ai/advise', requireAuth, aiController.advise)

/* --------------------------------- 小组 --------------------------------- */
router.get('/groups', requireAuth, groupController.list)
router.post('/groups', requireAuth, groupController.create)
router.post('/groups/join', requireAuth, groupController.join)
router.delete('/groups/:id', requireAuth, groupController.remove)

/* ------------------------------- 校园信息 ------------------------------- */
router.get('/notices', noticeController.list)
router.post('/notices', requireAuth, noticeController.create)

/* --------------------------------- 统计 --------------------------------- */
router.get('/stats/overview', requireAuth, statsController.overview)
router.get('/stats/weekly', requireAuth, statsController.weekly)

export default router