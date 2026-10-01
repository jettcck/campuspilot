import React, { useRef, useState } from 'react'
import { api } from '../api/client.js'
import { useApi } from '../hooks/useApi.js'
import { useToast } from '../components/Toast.jsx'

const COLORS = { coral: '#ec9d7b', blue: '#78a6c6', mint: '#9ccf64', yellow: '#e9c46a' }

/** 课程与资料管理页 */
export default function CoursesPage() {
  const toast = useToast()
  const fileInput = useRef(null)
  const [activeCourse, setActiveCourse] = useState('')
  const [form, setForm] = useState({ name: '', teacher: '', semester: '2024 秋', color: 'coral', nextClass: '' })

  const { data: courseData, reload: reloadCourses } = useApi(() => api.courses(), [])
  const { data: fileData, reload: reloadFiles } = useApi(() => api.files(activeCourse), [activeCourse])
  const courses = courseData?.courses || []
  const files = fileData?.files || []

  const createCourse = async (event) => {
    event.preventDefault()
    if (!form.name.trim()) return toast('请填写课程名称', 'error')
    try {
      await api.createCourse(form)
      setForm({ name: '', teacher: '', semester: form.semester, color: form.color, nextClass: '' })
      await reloadCourses()
      toast('课程创建成功')
    } catch (error) {
      toast(error.message, 'error')
    }
  }

  const removeCourse = async (course) => {
    try {
      await api.deleteCourse(course.id)
      if (activeCourse === course.id) setActiveCourse('')
      await reloadCourses()
      toast('课程已删除')
    } catch (error) {
      toast(error.message, 'error')
    }
  }

  const upload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    if (activeCourse) formData.append('courseId', activeCourse)
    try {
      await api.uploadFile(formData)
      await reloadFiles()
      toast('资料上传成功')
    } catch (error) {
      toast(error.message, 'error')
    } finally {
      event.target.value = ''
    }
  }

  const summarize = async (file) => {
    toast('正在生成摘要…')
    try {
      await api.summarizeFile(file.id)
      await reloadFiles()
      toast('摘要已生成')
    } catch (error) {
      toast(error.message, 'error')
    }
  }

  const removeFile = async (file) => {
    try {
      await api.deleteFile(file.id)
      await reloadFiles()
      toast('资料已删除')
    } catch (error) {
      toast(error.message, 'error')
    }
  }

  return (
    <div className="content-wrap">
      <section className="course-toolbar">
        <form className="panel inline-form" onSubmit={createCourse}>
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="课程名称" />
          <input value={form.teacher} onChange={(event) => setForm({ ...form, teacher: event.target.value })} placeholder="任课教师" />
          <input value={form.nextClass} onChange={(event) => setForm({ ...form, nextClass: event.target.value })} placeholder="下次上课" />
          <select value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })}>
            <option value="coral">珊瑚</option><option value="blue">天蓝</option><option value="mint">薄荷</option><option value="yellow">暖黄</option>
          </select>
          <button className="primary-button" type="submit">添加课程</button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div><h2>课程列表</h2><p>点击课程可筛选对应资料</p></div>
          {activeCourse && <button className="text-button" onClick={() => setActiveCourse('')}>显示全部资料</button>}
        </div>
        <div className="course-grid">
          {courses.length === 0 && <p className="empty">还没有课程，先在上方添加一门课程。</p>}
          {courses.map((course) => (
            <div className={'course-card ' + (activeCourse === course.id ? 'active' : '')} key={course.id} onClick={() => setActiveCourse(course.id)}>
              <div className="course-art" style={{ background: COLORS[course.color] || '#78a6c6' }}>{course.name.slice(0, 2)}</div>
              <div className="course-info">
                <b>{course.name}</b>
                <span>{course.teacher || '未填写教师'} · {course.semester}</span>
                <div className="course-progress"><i style={{ width: `${course.progress || 0}%`, background: COLORS[course.color] || '#8cb8d2' }} /><small>{course.progress || 0}%</small></div>
              </div>
              <button className="link-danger" onClick={(event) => { event.stopPropagation(); removeCourse(course) }}>删除</button>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div><h2>课程资料</h2><p>支持 PDF / Word / PPT / 图片 / 文本，单文件不超过 10MB</p></div>
          <div>
            <input ref={fileInput} type="file" hidden onChange={upload} />
            <button className="primary-button" onClick={() => fileInput.current?.click()}><span>＋</span> 上传资料</button>
          </div>
        </div>
        <div className="file-list">
          {files.length === 0 && <p className="empty">暂无资料，上传课件或笔记后会显示在这里。</p>}
          {files.map((file) => (
            <div className="file-row" key={file.id}>
              <div className="file-type">{(file.fileType || '?').toUpperCase()}</div>
              <div className="file-info">
                <b>{file.filename}</b>
                <span>{(file.fileSize / 1024).toFixed(1)} KB · 上传于 {String(file.createdAt || '').slice(0, 10)}</span>
                {file.summary && <p className="file-summary">{file.summary}</p>}
              </div>
              <div className="file-actions">
                <a className="ghost-button" href={file.fileUrl} target="_blank" rel="noreferrer">查看</a>
                <button className="ghost-button" onClick={() => summarize(file)}>AI 摘要</button>
                <button className="link-danger" onClick={() => removeFile(file)}>删除</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}