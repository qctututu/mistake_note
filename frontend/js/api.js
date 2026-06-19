/**
 * 错题本 - API 通信层
 * 所有后端请求集中管理
 */
const API = (() => {
  const BASE = 'http://localhost:5000/api';

  /** 通用请求封装 */
  async function request(method, path, body, isFormData = false) {
    const opts = { method };
    if (isFormData) {
      opts.body = body; // FormData, no Content-Type header
    } else {
      opts.headers = { 'Content-Type': 'application/json' };
      if (body !== undefined) {
        opts.body = JSON.stringify(body);
      }
    }
    const res = await fetch(`${BASE}${path}`, opts);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data;
  }

  function get(path) { return request('GET', path); }
  function post(path, body) { return request('POST', path, body); }
  function postForm(path, fd) { return request('POST', path, fd, true); }
  function put(path, body) { return request('PUT', path, body); }
  function del(path) { return request('DELETE', path); }

  return {
    // ─── 科目 ───
    getSubjects: () => get('/subjects'),
    addSubject: (name) => post('/subjects', { name }),

    // ─── 错题 CRUD ───
    listQuestions: (params = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs.set(k, v);
      });
      return get(`/questions?${qs.toString()}`);
    },
    getQuestion: (id) => get(`/questions/${id}`),
    addQuestion: (data) => post('/questions', data),
    addQuestionWithImages: (formData) => postForm('/questions', formData),
    updateQuestion: (id, data) => put(`/questions/${id}`, data),
    deleteQuestion: (id) => del(`/questions/${id}`),

    // ─── 复习 ───
    getDueReviews: (limit = 10, subjectId) => {
      let path = `/review/due?limit=${limit}`;
      if (subjectId) path += `&subject_id=${subjectId}`;
      return get(path);
    },
    submitReview: (qid, result) => post('/review/submit', { question_id: qid, result }),
    getReviewHistory: (qid) => get(`/review/history/${qid}`),
    getReviewForecast: () => get('/review/forecast'),

    // ─── 练习 ───
    generatePractice: (count = 5, subject_id, useAi = true) =>
      post('/practice/generate', { count, subject_id, use_ai: useAi }),
    generateFromQuestion: (questionId, count = 1) =>
      post('/practice/generate-from-question', { question_id: questionId, count }),
    gradePractice: (qid, userAnswer, modifiedContent, modifiedAnswer, images) =>
      post('/practice/grade', {
        question_id: qid,
        user_answer: userAnswer,
        modified_content: modifiedContent,
        modified_correct_answer: modifiedAnswer,
        user_answer_images: images || [],
      }),
    analyzePractice: (qid, userAnswer, modifiedContent, modifiedAnswer, isCorrect, images) =>
      post('/practice/analyze', {
        question_id: qid,
        user_answer: userAnswer,
        modified_content: modifiedContent,
        modified_correct_answer: modifiedAnswer,
        is_correct: isCorrect,
        user_answer_images: images || [],
      }),

    // ─── 统计 ───
    getStats: () => get('/stats'),

    // ─── 健康 ───
    health: () => get('/health'),

    // ─── AI 模型 ───
    getAiConfig: () => get('/ai/config'),
    setAiConfig: (cfg) => post('/ai/config', cfg),
    clearAiConfig: () => del('/ai/config'),
    testAiConnection: () => get('/ai/test'),
    testAiConnectionWith: (cfg) => post('/ai/test', cfg),
    getAiStatus: () => get('/ai/status'),
    generateWithAi: (qid) => post('/ai/generate', { question_id: qid }),

    // ─── 知识库 ───
    kbInit: () => post('/kb/init'),
    kbUpload: (file) => {
      const fd = new FormData();
      fd.append('file', file);
      return postForm('/kb/upload', fd);
    },
    kbListFiles: () => get('/kb/files'),
    kbDeleteFile: (fid) => del(`/kb/files/${fid}`),
    kbSearch: (query) => post('/kb/search', { query }),

    // ─── 图片 ───
    uploadImage: (file) => {
      const fd = new FormData();
      fd.append('image', file);
      return postForm('/upload-image', fd);
    },
  };
})();
