// 统一 API 客户端：自动附带 JWT、统一错误处理
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
const TOKEN_KEY = 'campuspilot_token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY) || '',
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY)
}

/**
 * 发起请求
 * @param {string} path 例如 /tasks
 * @param {{ method?: string, body?: any, isForm?: boolean }} options
 */
export async function request(path, options = {}) {
  const { method = 'GET', body, isForm = false } = options
  const headers = {}
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body && !isForm) headers['Content-Type'] = 'application/json'

  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined
    })
  } catch {
    throw new Error('无法连接服务器，请确认后端已启动')
  }

  const payload = await response.json().catch(() => ({ message: '服务器返回内容异常' }))

  if (response.status === 401) {
    tokenStore.clear()
  }
  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || `请求失败(${response.status})`)
  }
  return payload.data
}

export const api = {
  // 认证
  register: (body) => request('/auth/register', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  me: () => request('/auth/me'),
  updateProfile: (body) => request('/auth/profile', { method: 'PUT', body }),
  updatePassword: (body) => request('/auth/password', { method: 'PUT', body }),
  // 新用户引导
  onboardingStatus: () => request('/onboarding/status'),
  importSampleData: () => request('/onboarding/sample-data', { method: 'POST' }),
  // 任务
  tasks: (query = '') => request(`/tasks${query}`),
  createTask: (body) => request('/tasks', { method: 'POST', body }),
  updateTaskStatus: (id, done) => request(`/tasks/${id}/status`, { method: 'PATCH', body: { done } }),
  updateTask: (id, body) => request(`/tasks/${id}`, { method: 'PUT', body }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),
  // 课程与资料
  courses: () => request('/courses'),
  createCourse: (body) => request('/courses', { method: 'POST', body }),
  deleteCourse: (id) => request(`/courses/${id}`, { method: 'DELETE' }),
  files: (courseId = '') => request(`/files${courseId ? `?courseId=${courseId}` : ''}`),
  uploadFile: (formData) => request('/files', { method: 'POST', body: formData, isForm: true }),
  summarizeFile: (id) => request(`/files/${id}/summarize`, { method: 'POST' }),
  deleteFile: (id) => request(`/files/${id}`, { method: 'DELETE' }),
  // 学习计划
  plans: () => request('/study-plans'),
  updatePlanStep: (id, index, done) => request(`/study-plans/${id}/step`, { method: 'PATCH', body: { index, done } }),
  deletePlan: (id) => request(`/study-plans/${id}`, { method: 'DELETE' }),
  // AI
  aiChat: (prompt) => request('/ai/chat', { method: 'POST', body: { prompt } }),
  aiPlan: (goal, days) => request('/ai/study-plan', { method: 'POST', body: { goal, days } }),
  aiSummarize: (text) => request('/ai/summarize', { method: 'POST', body: { text } }),
  aiQuiz: (topic) => request('/ai/quiz', { method: 'POST', body: { topic } }),
  aiHistory: () => request('/ai/history'),
  aiAdvise: () => request('/ai/advise'),
  // 小组与校园
  groups: () => request('/groups'),
  createGroup: (body) => request('/groups', { method: 'POST', body }),
  joinGroup: (inviteCode) => request('/groups/join', { method: 'POST', body: { inviteCode } }),
  deleteGroup: (id) => request(`/groups/${id}`, { method: 'DELETE' }),
  notices: () => request('/notices'),
  // 统计
  statsOverview: () => request('/stats/overview'),
  statsWeekly: () => request('/stats/weekly')
}