/**
 * 错题本 - 前端主应用
 * SPA 路由、页面渲染、交互逻辑
 */
(() => {
  'use strict';

  const $ = (s, p) => (p || document).querySelector(s);
  const $$ = (s, p) => [...(p || document).querySelectorAll(s)];
  const content = () => $('#content');

  // ═══════════════════════════════════════════════
  //  工具函数
  // ═══════════════════════════════════════════════

  function toast(msg, type = 'info') {
    const container = $('#toastContainer');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(100%)'; el.style.transition = '0.3s'; }, 2500);
    setTimeout(() => el.remove(), 3000);
  }

  function escHtml(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  /** 把文本中的 Markdown 图片语法 `![alt](url)` 渲染成 <img>（兼容旧数据） */
  function renderTextWithImages(text) {
    return (text || '').replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="inline-image">');
  }

  /** 从文本中提取所有 Markdown 图片 URL */
  function extractImageUrls(text) {
    var urls = [];
    text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function(_, alt, url) { urls.push(url); });
    return urls;
  }

  /** 渲染指定字段的图片缩略图（从 images JSON 中提取） */
  function renderFieldImages(field, imagesJson) {
    if (!imagesJson) return '';
    try {
      var imgs = JSON.parse(imagesJson);
      var urls = imgs[field] || [];
      if (urls.length === 0) return '';
      return urls.map(function (url) {
        return '<img src="' + url + '" class="field-image" loading="lazy">';
      }).join('');
    } catch (e) {
      return '';
    }
  }

  /**
   * 为表单的文本区域添加图片上传功能
   * textareaId: textarea 的 id 或 name
   * previewId: 缩略图预览容器的 id
   */
  function setupImageUpload(textareaName, previewId) {
    // 只返回按钮，隐藏的 file input 统一在表单底部渲染
    return '<span class="img-upload-btn" data-target="' + textareaName + '" title="上传图片">\uD83D\uDDBC</span>';
  }

  function formatDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso.replace(' ', 'T') + '+08:00');
    return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function diffDays(iso) {
    if (!iso) return 99;
    const now = new Date();
    const d = new Date(iso.replace(' ', 'T') + '+08:00');
    return Math.ceil((d - now) / 86400000);
  }

  function difficultyTag(diff) {
    const labels = { 1: '⭐ 简单', 2: '⭐⭐ 较易', 3: '⭐⭐⭐ 中等', 4: '⭐⭐⭐⭐ 较难', 5: '⭐⭐⭐⭐⭐ 困难' };
    return `<span class="tag tag-difficulty-${diff}">${labels[diff] || '中等'}</span>`;
  }

  // ─── Modal 弹窗 ───
  function showModal(title, bodyHtml, footerBtns) {
    const overlay = $('#modalOverlay');
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = bodyHtml;
    const footer = $('#modalFooter');
    footer.innerHTML = '';
    if (footerBtns) {
      footerBtns.forEach(btn => {
        const el = document.createElement('button');
        el.className = `btn ${btn.cls || 'btn-secondary'}`;
        el.textContent = btn.text;
        if (btn.onclick) el.onclick = btn.onclick;
        footer.appendChild(el);
      });
    }
    overlay.classList.remove('hidden');
    return overlay;
  }

  function closeModal() {
    $('#modalOverlay').classList.add('hidden');
  }

  // 点击遮罩关闭
  document.addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') closeModal();
  });
  if ($('#modalCloseBtn')) {
    $('#modalCloseBtn').addEventListener('click', closeModal);
  }

  // ─── AI 连接检查 ───
  async function checkAiConfigured() {
    try {
      const status = await API.getAiStatus();
      return status.configured;
    } catch { return false; }
  }

  async function loadSubjects() {
    try { return await API.getSubjects(); }
    catch { return []; }
  }

  function renderSubjectOptions(subjects, selectedId) {
    return subjects.map(s =>
      `<option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>${escHtml(s.name)}</option>`
    ).join('');
  }

  // 星星评分
  function starRating(value, name = 'difficulty') {
    let html = '<div class="star-rating">';
    for (let i = 1; i <= 5; i++) {
      html += `<span class="star ${i <= value ? 'active' : ''}" data-value="${i}" data-name="${name}">★</span>`;
    }
    html += '</div>';
    return html;
  }

  // ═══════════════════════════════════════════════
  //  导航路由
  // ═══════════════════════════════════════════════

  let currentPage = 'dashboard';
  const renderers = {};

  function navigate(page) {
    if (currentPage === page) return;
    currentPage = page;
    $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
    location.hash = '#' + page;
    if (renderers[page]) renderers[page]();
    else content().innerHTML = '<div class="empty-state"><div class="icon">🚧</div><h3>页面建设中</h3></div>';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // 更新待复习徽章
  async function updateDueBadge() {
    try {
      const due = await API.getDueReviews(1);
      const count = due.length;
      const badge = $('#dueBadge');
      if (badge) {
        badge.innerHTML = count > 0 ? `📅 ${count} 题待复习` : '📅 今日无复习';
        badge.style.background = count > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.2)';
      }
    } catch { /* ignore */ }
  }

  // ═══════════════════════════════════════════════
  //  页面 1: 概览 (Dashboard)
  // ═══════════════════════════════════════════════

  renderers.dashboard = async () => {
    try {
      const stats = await API.getStats();
      const html = `
        <h2 class="page-title">📊 学习概览</h2>
        <p class="page-subtitle">你的错题学习总览</p>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">📚</div>
            <div class="stat-value">${stats.total_questions}</div>
            <div class="stat-label">总错题数</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">🔄</div>
            <div class="stat-value">${stats.total_reviews}</div>
            <div class="stat-label">总复习次数</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">📅</div>
            <div class="stat-value">${stats.due_reviews}</div>
            <div class="stat-label">待复习</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">🎯</div>
            <div class="stat-value">${stats.mastery_rate}%</div>
            <div class="stat-label">掌握率</div>
          </div>
        </div>

        <div class="chart-container">
          <h3 class="card-title">📂 各科错题分布</h3>
          ${renderBarChart(stats.subject_distribution, 'indigo')}
        </div>

        <div class="chart-container">
          <h3 class="card-title">📈 最近 30 天复习质量</h3>
          ${renderReviewQualityChart(stats.recent_reviews)}
        </div>

        <div class="chart-container">
          <h3 class="card-title">🏆 各科掌握率</h3>
          <div class="bar-chart">
            ${(stats.subject_mastery || []).map(sm => `
              <div class="bar-wrapper">
                <div class="bar-value">${sm.rate}%</div>
                <div class="bar" style="height:${Math.max(4, sm.rate * 1.8)}px; background: linear-gradient(180deg, #10b981, #059669);"></div>
                <div class="bar-label">${escHtml(sm.subject)}<br><small>(${sm.total}题)</small></div>
              </div>
            `).join('')}
          </div>
        </div>

        <div style="text-align: center; margin-top: 8px;">
          <button class="btn btn-primary" onclick="window.__nav('add')">✏️ ${stats.total_questions > 0 ? '录入错题' : '录入第一道错题'}</button>
          <button class="btn btn-secondary" onclick="window.__nav('review')" style="margin-left:8px;">🔄 开始复习</button>
        </div>
      `;
      content().innerHTML = html;
    } catch (e) {
      content().innerHTML = `
        <div class="empty-state">
          <div class="icon">🔌</div>
          <h3>无法连接到后端</h3>
          <p>请确认后端已启动：<code>python backend/app.py</code></p>
        </div>
      `;
    }
  };

  function renderBarChart(data, color = 'primary') {
    const vals = Object.values(data);
    const max = Math.max(...vals, 1);
    const colors = { indigo: 'linear-gradient(180deg, #818cf8, #4f46e5)', blue: 'linear-gradient(180deg, #38bdf8, #0ea5e9)', green: 'linear-gradient(180deg, #34d399, #10b981)' };
    const g = colors[color] || colors.indigo;
    return `
      <div class="bar-chart">
        ${Object.entries(data).map(([k, v]) => `
          <div class="bar-wrapper">
            <div class="bar-value">${v}</div>
            <div class="bar" style="height:${Math.max(4, (v / max) * 180)}px; background: ${g};"></div>
            <div class="bar-label">${escHtml(k)}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderReviewQualityChart(reviews) {
    const colors = { correct: '#10b981', partial: '#f59e0b', wrong: '#ef4444' };
    const labels = { correct: '正确', partial: '部分对', wrong: '错误' };
    const total = Object.values(reviews).reduce((a, b) => a + b, 0) || 1;
    return `
      <div style="display:flex; gap:20px; justify-content:center; align-items:flex-end; height:160px; padding: 20px 0;">
        ${Object.entries(reviews).map(([k, v]) => `
          <div style="text-align:center;">
            <div style="font-size:12px; font-weight:700; margin-bottom:4px;">${v}</div>
            <div style="width:80px; height:${Math.max(4, (v / total) * 140)}px; border-radius:4px; background:${colors[k]}; transition: height 0.6s;"></div>
            <div style="font-size:11px; color:#64748b; margin-top:6px;">${labels[k]}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ═══════════════════════════════════════════════
  //  页面 2: 录入错题
  // ═══════════════════════════════════════════════

  renderers.add = async () => {
    const subjects = await loadSubjects();
    var _fromPractice = window.__practiceAddData ? true : false;
    const html = `
      <h2 class="page-title">✏️ ${_fromPractice ? '从练习录入' : '录入错题'}</h2>
      <p class="page-subtitle">${_fromPractice ? '练习中做错的变形题，自动填入下方' : '记录你的错题，下次不再掉进同一个坑'}</p>

      <div class="card">
        ${_fromPractice ? '<div style="margin-bottom:12px;"><button class="btn btn-secondary" onclick="window.__practiceReturn()">🔙 返回练习</button></div>' : ''}
        <form id="addForm">
          <div class="form-row">
            <div class="form-group">
              <label>科目 <span class="required">*</span></label>
              <select name="subject_id" required>
                <option value="">— 请选择科目 —</option>
                ${renderSubjectOptions(subjects)}
              </select>
            </div>
            <div class="form-group">
              <label>难度</label>
              <div id="difficultyStars">${starRating(3)}</div>
              <input type="hidden" name="difficulty" value="3">
            </div>
          </div>

          <div class="form-group">
            <label>题目内容 <span class="required">*</span> ${setupImageUpload('content', 'preview_content')}</label>
            <textarea name="content" id="ta_content" rows="4" placeholder="输入题目内容……" required></textarea>
            <div class="img-preview" id="preview_content"></div>
          </div>

          <div class="form-group">
            <label>正确答案 <span class="required">*</span> ${setupImageUpload('correct_answer', 'preview_correct')}</label>
            <textarea name="correct_answer" id="ta_correct_answer" rows="3" placeholder="标准答案或正确解法" required></textarea>
            <div class="img-preview" id="preview_correct"></div>
          </div>

          <div class="form-group">
            <label>你的错误答案 ${setupImageUpload('wrong_answer', 'preview_wrong')}</label>
            <textarea name="wrong_answer" id="ta_wrong_answer" rows="2" placeholder="当时你写了什么？"></textarea>
            <div class="img-preview" id="preview_wrong"></div>
          </div>

          <div class="form-group">
            <label>错因分析</label>
            <textarea name="analysis" rows="3" placeholder="为什么错了？知识点漏洞？粗心？思路不对？"></textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>知识点标签（逗号分隔）</label>
              <input type="text" name="knowledge_points" placeholder="如：二次函数, 韦达定理">
            </div>
            <div class="form-group">
              <label>题目来源</label>
              <input type="text" name="source" placeholder="如：期中考试, 课后作业">
            </div>
          </div>

          <!-- 图片上传的隐藏 file input（必须放在 label 外面，防止双击弹窗） -->
          <input type="file" accept="image/*" id="imgInput_content" style="display:none">
          <input type="file" accept="image/*" id="imgInput_correct_answer" style="display:none">
          <input type="file" accept="image/*" id="imgInput_wrong_answer" style="display:none">

          <div class="form-actions">
            <button type="submit" class="btn btn-primary btn-block">✅ 保存错题</button>
            <button type="reset" class="btn btn-secondary">重置</button>
          </div>
        </form>
      </div>
    `;
    content().innerHTML = html;

    // 星星评分交互
    const stars = $('#difficultyStars');
    if (stars) {
      stars.addEventListener('click', (e) => {
        const star = e.target.closest('.star');
        if (!star) return;
        const val = parseInt(star.dataset.value);
        stars.querySelectorAll('.star').forEach((s, i) => s.classList.toggle('active', i < val));
        $('#addForm [name="difficulty"]').value = val;
      });
    }

    // ─── 图片上传功能 ───
    // 每个字段的图片 URL 存到单独的数组里，不写到文本框
    var _imgUrls = { content: [], correct_answer: [], wrong_answer: [] };

    function bindImageUpload(textareaName) {
      var btn = document.querySelector('.img-upload-btn[data-target="' + textareaName + '"]');
      var input = document.getElementById('imgInput_' + textareaName);
      var preview = document.getElementById('preview_' + textareaName);
      if (!btn || !input || !preview) return;

      btn.addEventListener('click', function (e) {
        e.stopPropagation();  // 防止事件冒泡到 label 触发二次弹窗
        input.click();
      });

      input.addEventListener('change', async function () {
        var file = input.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
          toast('图片不能超过 10MB', 'error');
          input.value = '';
          return;
        }
        try {
          input.disabled = true;
          btn.style.opacity = '0.5';
          var result = await API.uploadImage(file);
          _imgUrls[textareaName].push(result.url);
          renderThumbnails(textareaName, preview);
          toast('图片已上传', 'success');
        } catch (err) {
          toast('上传失败: ' + err.message, 'error');
        } finally {
          input.disabled = false;
          btn.style.opacity = '1';
          input.value = '';
        }
      });
    }

    function renderThumbnails(field, preview) {
      var urls = _imgUrls[field] || [];
      if (urls.length === 0) {
        preview.innerHTML = '';
        return;
      }
      preview.innerHTML = urls.map(function (url) {
        return '<div class="img-thumb-wrapper"><img src="' + url + '" class="img-thumb" loading="lazy"><span class="img-thumb-remove" title="移除">&times;</span></div>';
      }).join('');
      preview.querySelectorAll('.img-thumb-remove').forEach(function (el, idx) {
        el.addEventListener('click', function () {
          _imgUrls[field].splice(idx, 1);
          renderThumbnails(field, preview);
        });
      });
    }

    bindImageUpload('content');
    bindImageUpload('correct_answer');
    bindImageUpload('wrong_answer');

    // ─── 从练习模式预填数据 ───
    if (window.__practiceAddData) {
      var pData = window.__practiceAddData;
      var taContent = document.getElementById('ta_content');
      var taCorrect = document.getElementById('ta_correct_answer');
      var taWrong = document.getElementById('ta_wrong_answer');
      if (taContent) taContent.value = pData.content || '';
      if (taCorrect) taCorrect.value = pData.correct_answer || '';
      if (taWrong) taWrong.value = pData.wrong_answer || '';
      // 预填错误答案的图片
      // 预填科目
      if (pData.subject) {
        var subjSelect = document.querySelector('#addForm select[name="subject_id"]');
        if (subjSelect) {
          // 在 subjects 列表中找匹配的科目名
          var matched = subjects.find(function(s) { return s.name === pData.subject; });
          if (matched) {
            subjSelect.value = matched.id;
          }
        }
      }
      // 预填错误答案的图片
      if (pData.wrong_answer_images && pData.wrong_answer_images.length > 0) {
        _imgUrls.wrong_answer = pData.wrong_answer_images.slice();
        var pw = document.getElementById('preview_wrong_answer');
        if (pw) renderThumbnails('wrong_answer', pw);
      }
      // 清除预填标记，防止刷新重复填充
      window.__practiceAddData = null;
    }

    // 表单提交
    $('#addForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = Object.fromEntries(fd.entries());
      data.subject_id = parseInt(data.subject_id);
      data.difficulty = parseInt(data.difficulty || 3);

      if (!data.subject_id) { toast('请选择科目', 'error'); return; }
      if (!data.content.trim()) { toast('请输入题目内容', 'error'); return; }
      if (!data.correct_answer.trim()) { toast('请输入正确答案', 'error'); return; }

      // 收集图片 URL 并清空预览
      data.images = JSON.stringify(_imgUrls);
      _imgUrls = { content: [], correct_answer: [], wrong_answer: [] };

      try {
        const result = await API.addQuestion(data);
        toast('✅ 错题已保存！', 'success');
        e.target.reset();
        // 重置难度和缩略图
        $('#difficultyStars').querySelectorAll('.star').forEach((s, i) => s.classList.toggle('active', i < 3));
        $('#addForm [name="difficulty"]').value = 3;
        document.querySelectorAll('.img-preview').forEach(function(el) { el.innerHTML = ''; });
        updateDueBadge();

        // 如果是从练习来的，保存后返回练习
        if (window.__practiceSavedState) {
          window.__practiceSavedState = null;
          navigate('practice');
        }
      } catch (err) {
        toast('保存失败：' + err.message, 'error');
      }
    });
  };

  // ═══════════════════════════════════════════════
  //  页面 3: 分类浏览
  // ═══════════════════════════════════════════════

  renderers.browse = async () => {
    const subjects = await loadSubjects();
    content().innerHTML = `
      <h2 class="page-title">📂 分类浏览</h2>
      <p class="page-subtitle">按科目、知识点筛选你的错题库</p>

      <div class="card">
        <div class="filter-bar">
          <select id="filterSubject">
            <option value="">全部科目</option>
            ${renderSubjectOptions(subjects)}
          </select>
          <input type="text" id="filterSearch" placeholder="🔍 搜索题目/答案/分析...">
          <select id="filterSort">
            <option value="created_at">按录入时间</option>
            <option value="difficulty">按难度</option>
            <option value="review_count">按复习次数</option>
            <option value="next_review_at">按复习时间</option>
          </select>
          <button class="btn btn-primary btn-sm" id="btnFilter">筛选</button>
        </div>
      </div>

      <div id="browseList"><div class="loading"><div class="spinner"></div><p>加载中...</p></div></div>
      <div id="browsePagination" class="pagination"></div>
    `;

    const state = { page: 1, pageSize: 10, subjectId: '', search: '', sortBy: 'created_at', sortOrder: 'desc' };

    async function loadBrowse() {
      const el = $('#browseList');
      try {
        const res = await API.listQuestions({
          page: state.page, page_size: state.pageSize,
          subject_id: state.subjectId || undefined,
          search: state.search || undefined,
          sort_by: state.sortBy, sort_order: state.sortOrder,
        });
        renderBrowseList(el, res, state);
        renderPagination(res, state);
      } catch (e) {
        el.innerHTML = `<div class="empty-state"><div class="icon">❌</div><h3>加载失败</h3><p>${e.message}</p></div>`;
      }
    }

    // 筛选事件
    $('#btnFilter').addEventListener('click', () => {
      state.subjectId = $('#filterSubject').value;
      state.search = $('#filterSearch').value;
      state.sortBy = $('#filterSort').value;
      state.page = 1;
      loadBrowse();
    });

    // 回车搜索
    $('#filterSearch').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('#btnFilter').click();
    });

    loadBrowse();
  };

  function renderBrowseList(el, res, state) {
    if (res.data.length === 0) {
      el.innerHTML = `<div class="empty-state"><div class="icon">📭</div><h3>还没有错题</h3><p>去录入第一道吧！</p></div>`;
      return;
    }

    const html = res.data.map(q => `
      <div class="question-card" data-id="${q.id}">
        <div class="q-subject">${escHtml(q.subject_name)} · ${formatDate(q.created_at)}</div>
        <div class="q-content">${renderTextWithImages(q.content)}${renderFieldImages('content', q.images)}</div>
        ${q.wrong_answer ? `<div class="q-wrong">❌ 你的错误答案：${renderTextWithImages(q.wrong_answer)}${renderFieldImages('wrong_answer', q.images)}</div>` : ''}
        <div class="q-answer">✅ 正确答案：${renderTextWithImages(q.correct_answer)}${renderFieldImages('correct_answer', q.images)}</div>
        ${q.analysis ? `<div class="q-analysis">💡 分析：${escHtml(q.analysis)}</div>` : ''}
        <div class="q-meta">
          ${difficultyTag(q.difficulty)}
          ${q.knowledge_points ? q.knowledge_points.split(',').map(k => `<span class="tag">${escHtml(k.trim())}</span>`).join('') : ''}
          <span>🔄 复习 ${q.review_count} 次</span>
          <span>📅 ${diffDays(q.next_review_at) <= 0 ? '🔴 待复习' : `⏳ ${diffDays(q.next_review_at)} 天后复习`}</span>
          <button class="btn btn-sm btn-secondary" onclick="window.__editQuestion(${q.id})">✏️ 编辑</button>
          <button class="btn btn-sm btn-danger" onclick="window.__deleteQuestion(${q.id})">🗑️ 删除</button>
        </div>
      </div>
    `).join('');
    el.innerHTML = html;
  }

  function renderPagination(res, state) {
    const el = $('#browsePagination');
    if (res.total_pages <= 1) { el.innerHTML = ''; return; }
    let html = '';
    html += `<button ${state.page <= 1 ? 'disabled' : ''} onclick="window.__browsePage(${state.page - 1})">‹ 上一页</button>`;
    for (let p = Math.max(1, state.page - 2); p <= Math.min(res.total_pages, state.page + 2); p++) {
      html += p === state.page
        ? `<span class="current-page">${p}</span>`
        : `<button onclick="window.__browsePage(${p})">${p}</button>`;
    }
    html += `<button ${state.page >= res.total_pages ? 'disabled' : ''} onclick="window.__browsePage(${state.page + 1})">下一页 ›</button>`;
    el.innerHTML = html;
  }

  // ─── 浏览用全局导航 ───
  window.__browsePage = (p) => {
    // 通过重新触发筛选来翻页（维持状态）
    const state = window.__browseState || { page: 1, pageSize: 10 };
    state.page = p;
    window.__browseState = state;
    // 重新加载
    const asyncLoad = async () => {
      const el = $('#browseList');
      try {
        const res = await API.listQuestions({
          page: state.page, page_size: state.pageSize,
          subject_id: state.subjectId || undefined,
          search: state.search || undefined,
          sort_by: state.sortBy, sort_order: state.sortOrder,
        });
        renderBrowseList(el, res, state);
        renderPagination(res, state);
      } catch (e) {
        el.innerHTML = `<div class="empty-state"><div class="icon">❌</div><h3>加载失败</h3><p>${e.message}</p></div>`;
      }
    };
    asyncLoad();
  };

  window.__deleteQuestion = async (id) => {
    if (!confirm('确定要删除这道错题吗？')) return;
    try {
      await API.deleteQuestion(id);
      toast('已删除', 'success');
      renderers.browse();
      updateDueBadge();
    } catch (e) {
      toast('删除失败：' + e.message, 'error');
    }
  };

  window.__editQuestion = async (id) => {
    try {
      const q = await API.getQuestion(id);
      const subjects = await loadSubjects();
      // 简单的内联编辑弹窗
      const html = `
        <div class="card" style="max-width: 700px; margin: 0 auto;">
          <h3 class="card-title">✏️ 编辑错题</h3>
          <form id="editForm">
            <div class="form-row">
              <div class="form-group">
                <label>科目</label>
                <select name="subject_id">
                  ${renderSubjectOptions(subjects, q.subject_id)}
                </select>
              </div>
              <div class="form-group">
                <label>难度</label>
                ${starRating(q.difficulty || 3)}
                <input type="hidden" name="difficulty" value="${q.difficulty || 3}">
              </div>
            </div>
            <div class="form-group">
              <label>题目内容 ${setupImageUpload('edit_content', 'preview_edit_content')}</label>
              <textarea name="content" id="ta_edit_content" rows="4">${escHtml(q.content)}</textarea>
              <div class="img-preview" id="preview_edit_content"></div>
            </div>
            <div class="form-group">
              <label>正确答案 ${setupImageUpload('edit_correct_answer', 'preview_edit_correct')}</label>
              <textarea name="correct_answer" id="ta_edit_correct_answer" rows="3">${escHtml(q.correct_answer)}</textarea>
              <div class="img-preview" id="preview_edit_correct"></div>
            </div>
            <div class="form-group">
              <label>你的错误答案 ${setupImageUpload('edit_wrong_answer', 'preview_edit_wrong')}</label>
              <textarea name="wrong_answer" id="ta_edit_wrong_answer" rows="2">${escHtml(q.wrong_answer || '')}</textarea>
              <div class="img-preview" id="preview_edit_wrong"></div>
            </div>
            <div class="form-group">
              <label>错因分析</label>
              <textarea name="analysis" rows="3">${escHtml(q.analysis || '')}</textarea>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>知识点标签</label>
                <input type="text" name="knowledge_points" value="${escHtml(q.knowledge_points || '')}">
              </div>
              <div class="form-group">
                <label>来源</label>
                <input type="text" name="source" value="${escHtml(q.source || '')}">
              </div>
            </div>
            <!-- 图片上传的隐藏 file input（必须放在 label 外面，防止双击弹窗） -->
            <input type="file" accept="image/*" id="imgInput_edit_content" style="display:none">
            <input type="file" accept="image/*" id="imgInput_edit_correct_answer" style="display:none">
            <input type="file" accept="image/*" id="imgInput_edit_wrong_answer" style="display:none">

            <div class="form-actions">
              <button type="submit" class="btn btn-primary btn-block">💾 保存修改</button>
              <button type="button" class="btn btn-secondary" onclick="renderers.browse()">取消</button>
            </div>
          </form>
        </div>
      `;
      content().innerHTML = html;

      // 星星评分
      const stars = $('#editForm .star-rating');
      if (stars) {
        stars.addEventListener('click', (e) => {
          const star = e.target.closest('.star');
          if (!star) return;
          const val = parseInt(star.dataset.value);
          stars.querySelectorAll('.star').forEach((s, i) => s.classList.toggle('active', i < val));
          $('#editForm [name="difficulty"]').value = val;
        });
      }

      // 编辑表单图片上传
      var _editImgUrls = { edit_content: [], edit_correct_answer: [], edit_wrong_answer: [] };
      // 加载已有图片
      try {
        var existingImgs = JSON.parse(q.images || '{}');
        _editImgUrls.edit_content = existingImgs.content || [];
        _editImgUrls.edit_correct_answer = existingImgs.correct_answer || [];
        _editImgUrls.edit_wrong_answer = existingImgs.wrong_answer || [];
        ['edit_content', 'edit_correct_answer', 'edit_wrong_answer'].forEach(function(f) {
          var preview = document.getElementById('preview_' + f);
          if (preview) renderEditThumbnails(f, preview);
        });
      } catch(e) {}

      function bindEditImageUpload(textareaName) {
        var btn = document.querySelector('.img-upload-btn[data-target="' + textareaName + '"]');
        var input = document.getElementById('imgInput_' + textareaName);
        var preview = document.getElementById('preview_' + textareaName);
        if (!btn || !input || !preview) return;
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          input.click();
        });
        input.addEventListener('change', async function () {
          var file = input.files[0];
          if (!file) return;
          if (file.size > 10 * 1024 * 1024) { toast('图片不能超过 10MB', 'error'); input.value = ''; return; }
          try {
            input.disabled = true; btn.style.opacity = '0.5';
            var result = await API.uploadImage(file);
            _editImgUrls[textareaName].push(result.url);
            renderEditThumbnails(textareaName, preview);
            toast('图片已上传', 'success');
          } catch (err) { toast('上传失败: ' + err.message, 'error'); }
          finally { input.disabled = false; btn.style.opacity = '1'; input.value = ''; }
        });
      }
      function renderEditThumbnails(field, preview) {
        var urls = _editImgUrls[field] || [];
        if (urls.length === 0) { preview.innerHTML = ''; return; }
        preview.innerHTML = urls.map(function (url) {
          return '<div class="img-thumb-wrapper"><img src="' + url + '" class="img-thumb" loading="lazy"><span class="img-thumb-remove" title="移除">&times;</span></div>';
        }).join('');
        preview.querySelectorAll('.img-thumb-remove').forEach(function (el, idx) {
          el.addEventListener('click', function () {
            _editImgUrls[field].splice(idx, 1);
            renderEditThumbnails(field, preview);
          });
        });
      }

      bindEditImageUpload('edit_content');
      bindEditImageUpload('edit_correct_answer');
      bindEditImageUpload('edit_wrong_answer');

      $('#editForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const data = Object.fromEntries(fd.entries());
        data.subject_id = parseInt(data.subject_id);
        data.difficulty = parseInt(data.difficulty || 3);
        // 图片数据
        data.images = JSON.stringify({
          content: _editImgUrls.edit_content,
          correct_answer: _editImgUrls.edit_correct_answer,
          wrong_answer: _editImgUrls.edit_wrong_answer
        });
        try {
          await API.updateQuestion(id, data);
          toast('已更新', 'success');
          renderers.browse();
        } catch (err) {
          toast('更新失败：' + err.message, 'error');
        }
      });
    } catch (e) {
      toast('加载失败：' + e.message, 'error');
    }
  };

  // ═══════════════════════════════════════════════
  //  页面 4: 复习模式 (SM-2 遗忘曲线)
  // ═══════════════════════════════════════════════

  renderers.review = async () => {
    const due = await API.getDueReviews(10);
    if (due.length === 0) {
      content().innerHTML = `
        <h2 class="page-title">🔄 复习模式</h2>
        <div class="empty-state">
          <div class="icon">🎉</div>
          <h3>今日无待复习题目</h3>
          <p>太棒了！或者去录入一些错题吧。</p>
          <button class="btn btn-primary" onclick="window.__nav('add')" style="margin-top:12px;">✏️ 录入错题</button>
        </div>
      `;
      return;
    }

    content().innerHTML = `
      <h2 class="page-title">🔄 复习模式</h2>
      <p class="page-subtitle">基于遗忘曲线的智能复习，巩固薄弱环节</p>
      <div class="review-container" id="reviewContainer"></div>
    `;

    let queue = [...due];
    let currentIdx = 0;
    let revealed = false;

    function renderCurrent() {
      if (currentIdx >= queue.length) {
        // 完成！
        $('#reviewContainer').innerHTML = `
          <div class="review-card">
            <div style="font-size:48px; margin-bottom:16px;">🎉</div>
            <h3>复习完成！</h3>
            <p style="color:#64748b; margin:12px 0;">本次共复习 ${queue.length} 道题</p>
            <button class="btn btn-primary" onclick="window.__nav('dashboard')">📊 返回概览</button>
          </div>
        `;
        updateDueBadge();
        return;
      }

      const q = queue[currentIdx];
      revealed = false;
      $('#reviewContainer').innerHTML = `
        <div class="review-progress">
          第 ${currentIdx + 1} / ${queue.length} 题
          <div class="progress-bar">
            <div class="progress-bar-fill" style="width:${(currentIdx / queue.length) * 100}%"></div>
          </div>
        </div>
        <div class="review-card">
          <div style="width:100%; text-align:left;">
            <div class="q-subject" style="margin-bottom:8px;">${escHtml(q.subject_name)} · ${difficultyTag(q.difficulty)}</div>
            <div class="question-text">${renderTextWithImages(q.content)}${renderFieldImages('content', q.images)}</div>
            ${q.knowledge_points ? `<div style="margin-bottom:12px;">${q.knowledge_points.split(',').map(k => `<span class="tag">${escHtml(k.trim())}</span>`).join('')}</div>` : ''}
          </div>

          <div class="answer-section">
            <textarea id="reviewAnswer" rows="4" placeholder="在脑海里过一遍解题思路，或者把答案写下来……"></textarea>
          </div>

          <div id="reviewResultArea"></div>

          <div class="review-actions" id="reviewActions">
            <button class="btn btn-primary" id="btnRevealAnswer">👁️ 查看答案</button>
            <button class="btn btn-secondary" id="btnSkipReview" style="display:none;">⏭️ 跳过</button>
          </div>
        </div>
      `;

      $('#btnRevealAnswer').addEventListener('click', () => revealAnswer(q));
      $('#btnSkipReview').addEventListener('click', () => { currentIdx++; renderCurrent(); });
    }

    function revealAnswer(q) {
      revealed = true;
      const userAnswer = $('#reviewAnswer')?.value?.trim() || '';
      const area = $('#reviewResultArea');
      const actions = $('#reviewActions');

      area.innerHTML = `
        <div class="review-result-card">
          <div class="review-answer-compare wrong" style="margin-bottom:12px;">
            <strong>✅ 正确答案：</strong><br>${renderTextWithImages(q.correct_answer)}${renderFieldImages('correct_answer', q.images)}
          </div>
          ${q.wrong_answer ? `
          <div class="review-answer-compare" style="background:#fef2f2; border:1px solid '#fecaca'; padding:12px; border-radius:8px; margin-bottom:12px;">
            <strong>❌ 你当时的错误答案：</strong><br>${renderTextWithImages(q.wrong_answer)}${renderFieldImages('wrong_answer', q.images)}
          </div>` : ''}
          ${q.analysis ? `
          <div class="review-answer-compare" style="background:#fffbeb; border:1px solid '#fde68a'; padding:12px; border-radius:8px;">
            <strong>💡 错因分析：</strong><br>${escHtml(q.analysis)}
          </div>` : ''}
          <div style="margin-top:16px; text-align:center;">
            <p style="color:#64748b; font-size:13px; margin-bottom:8px;">这次复习你做得怎么样？</p>
          </div>
        </div>
      `;

      actions.innerHTML = `
        <button class="btn btn-success" onclick="window.__submitReview(${q.id}, 'correct', ${currentIdx})">✅ 正确</button>
        <button class="btn btn-warning" onclick="window.__submitReview(${q.id}, 'partial', ${currentIdx})">⚠️ 部分正确</button>
        <button class="btn btn-danger" onclick="window.__submitReview(${q.id}, 'wrong', ${currentIdx})">❌ 错误</button>
      `;

      updateDueBadge();
    }

    window.__submitReview = async (qid, result, idx) => {
      try {
        await API.submitReview(qid, result);
        toast(result === 'correct' ? '🎉 很棒！' : result === 'partial' ? '继续加油！' : '💪 下次一定对！',
              result === 'correct' ? 'success' : result === 'partial' ? 'warning' : 'error');
      } catch (e) {
        toast('保存失败', 'error');
      }
      currentIdx++;
      renderCurrent();
    };

    renderCurrent();
  };

  // ═══════════════════════════════════════════════
  //  页面 5: 练习模式（变形题）
  // ═══════════════════════════════════════════════

  renderers.practice = async () => {
    // ── 如果有保存的练习状态，直接恢复 ──
    if (window.__practiceSavedState) {
      var saved = window.__practiceSavedState;
      window.__practiceSavedState = null; // 清除，避免重复恢复
      window.__practiceQuestions = saved.questions;
      window.__practiceImgUrls = saved.imgUrls || {};
      if (saved.html) {
        // 有完整 HTML 快照（从录入页面跳回）
        document.getElementById('content').innerHTML = saved.html;
        if (saved.scrollY) { setTimeout(function () { window.scrollTo(0, saved.scrollY); }, 50); }
        return;
      } else {
        // 没有 HTML 快照（从空白页面跳回），重新渲染配置卡片并恢复题目列表
        // 这种情况直接 fallthrough 到下面的正常渲染，但保留 __practiceQuestions
        window.__practiceRestoreQuestions = saved.questions;
        window.__practiceRestoreImgUrls = saved.imgUrls;
      }
    }

    // ── 先检查 AI 是否已配置 ──
    const aiConfigured = await checkAiConfigured();
    if (!aiConfigured) {
      showModal(
        '🤖 需要配置 AI 模型',
        '<p>练习模式需要 AI 模型支持来生成高质量的变形题。</p><p>请先配置并测试 AI 模型连接。</p>',
        [
          { text: '去配置', cls: 'btn-primary', onclick: () => { closeModal(); navigate('ai_model'); } },
          { text: '关闭', cls: 'btn-secondary', onclick: () => { closeModal(); navigate('dashboard'); } },
        ]
      );
      content().innerHTML = `
        <h2 class="page-title">🎯 练习模式</h2>
        <div class="empty-state">
          <div class="icon">🤖</div>
          <h3>请先配置 AI 模型</h3>
          <p>练习模式需要 AI 模型支持，请前往「AI 模型」页面配置。</p>
          <button class="btn btn-primary" onclick="window.__nav('ai_model')" style="margin-top:12px;">⚙️ 去配置</button>
        </div>
      `;
      return;
    }

    const subjects = await loadSubjects();
    const html = `
      <h2 class="page-title">🎯 练习模式</h2>
      <p class="page-subtitle">AI 生成变形题，训练真正的理解能力</p>

      <div class="card">
        <div class="form-row">
          <div class="form-group">
            <label>科目</label>
            <select id="practiceSubject">
              ${renderSubjectOptions(subjects)}
            </select>
          </div>
          <div class="form-group">
            <label>生成数量</label>
            <select id="practiceCount">
              <option value="1">1 题</option>
              <option value="3">3 题</option>
              <option value="5" selected>5 题</option>
            </select>
          </div>
        </div>
        <button class="btn btn-primary btn-block" id="btnGeneratePractice">🤖 AI 生成变形题</button>
        <p style="text-align:center; font-size:12px; color:#94a3b8; margin-top:8px;">
          AI 将根据原题 + 知识库上下文生成相似题目
        </p>
      </div>

      <div id="practiceList"></div>
    `;
    content().innerHTML = html;

    // ── 恢复之前练习的题目列表（从录入页面跳回，没有 HTML 快照）──
    if (window.__practiceRestoreQuestions) {
      var restoreQs = window.__practiceRestoreQuestions;
      var restoreUrls = window.__practiceRestoreImgUrls || {};
      window.__practiceRestoreQuestions = null;
      window.__practiceRestoreImgUrls = null;
      window.__practiceQuestions = restoreQs;
      window.__practiceImgUrls = restoreUrls;
      var listEl = $('#practiceList');
      if (listEl && restoreQs.length > 0) {
        renderPracticeList(listEl, restoreQs);
      }
    }

    $('#btnGeneratePractice').addEventListener('click', async () => {
      const count = parseInt($('#practiceCount').value);
      const subjectId = $('#practiceSubject').value || undefined;
      const list = $('#practiceList');
      list.innerHTML = '<div class="loading"><div class="spinner"></div><p>🤖 AI 正在生成变形题，请稍候...</p></div>';

      try {
        const questions = await API.generatePractice(count, subjectId, true);
        if (!questions || questions.length === 0) {
          list.innerHTML = '<div class="empty-state"><div class="icon">📭</div><h3>没有足够的题目</h3><p>请先录入一些错题</p></div>';
          return;
        }
        renderPracticeList(list, questions);
      } catch (e) {
        list.innerHTML = `<div class="empty-state"><div class="icon">❌</div><h3>生成失败</h3><p>${e.message}</p></div>`;
      }
    });
  };

  function renderPracticeList(container, questions) {
    const genMethod = questions.some(q => q.strategies_used && q.strategies_used.includes('AI 生成')) ? 'AI' : '规则引擎';
    const html = questions.map((q, i) => {
      if (q.error) {
        return `<div class="practice-card" style="border-left-color: '#ef4444';">
          <div class="q-subject">${escHtml(q.subject || '')} · 第 ${i + 1} 题</div>
          <div style="color:#ef4444; padding:12px;">❌ AI 生成失败: ${escHtml(q.error)}</div>
        </div>`;
      }
      return `
      <div class="practice-card">
        ${q.hint ? `<div class="practice-hint">💡 ${escHtml(q.hint)}</div>` : ''}
        ${q.changed_aspects ? `<div style="font-size:12px; color:#0ea5e5; background:#f0f9ff; padding:6px 12px; border-radius:6px; margin-bottom:12px;">🔄 改动说明: ${escHtml(q.changed_aspects)}</div>` : ''}
        <div class="q-subject">${escHtml(q.subject)} · 变形题 ${i + 1}</div>
        ${q.knowledge_points ? `<div style="margin-bottom:8px;">${q.knowledge_points.split(',').map(k => `<span class="tag">${escHtml(k.trim())}</span>`).join('')}</div>` : ''}
        <div class="q-content" style="font-size:16px;">${escHtml(q.modified_content)}</div>

        <div id="practiceAnswer_${i}" style="margin-top:12px;">
          <textarea id="pta_${i}" placeholder="写出你的答案……" rows="3" style="width:100%; padding:10px 14px; border:1.5px solid '#e2e8f0'; border-radius:8px; font-size:14px; resize:vertical;"></textarea>
          <div style="margin-top:4px;">
            <span class="img-upload-btn" data-target="practice_${i}" title="上传图片答案">\uD83D\uDDBC 上传图片答案</span>
            <div class="img-preview" id="preview_practice_${i}"></div>
          </div>
        </div>

        <div style="display:flex; gap:8px; margin-top:12px;">
          <button class="btn btn-sm btn-primary" onclick="window.__checkPractice(${i}, this)">📝 核对答案</button>
          <button class="btn btn-sm btn-secondary" id="btnAnalysis_${i}" disabled style="opacity:0.5; cursor:not-allowed;">📖 问题解析</button>
        </div>
        <div id="practiceResult_${i}" style="margin-top:12px;"></div>
        <div class="original-ref">
          📎 使用 ${genMethod} · 原题 ID: ${q.original_id}
        </div>
      </div>
    `}).join('');
    container.innerHTML = html;

    // 保存题目数据供全局引用
    window.__practiceQuestions = questions;

    // 初始化图片上传
    questions.forEach(function(q, i) {
      if (q.error) return;
      window.__practiceImgUrls = window.__practiceImgUrls || {};
      window.__practiceImgUrls[i] = [];
      bindPracticeImageUpload(i);
    });
  }

  function bindPracticeImageUpload(idx) {
    var btn = document.querySelector('.img-upload-btn[data-target="practice_' + idx + '"]');
    var preview = document.getElementById('preview_practice_' + idx);
    if (!btn || !preview) return;

    // 创建隐藏 file input（放 body 里避免 label 嵌套）
    var inputId = 'imgInput_practice_' + idx;
    var existing = document.getElementById(inputId);
    if (existing) existing.remove();
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.id = inputId;
    input.style.display = 'none';
    document.body.appendChild(input);

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      input.click();
    });

    input.addEventListener('change', async function () {
      var file = input.files[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        toast('图片不能超过 10MB', 'error');
        input.value = '';
        return;
      }
      try {
        input.disabled = true;
        btn.style.opacity = '0.5';
        var result = await API.uploadImage(file);
        window.__practiceImgUrls[idx].push(result.url);
        renderPracticeThumbnails(idx, preview);
        toast('图片已上传', 'success');
      } catch (err) {
        toast('上传失败: ' + err.message, 'error');
      } finally {
        input.disabled = false;
        btn.style.opacity = '1';
        input.value = '';
      }
    });
  }

  function renderPracticeThumbnails(idx, preview) {
    var urls = window.__practiceImgUrls[idx] || [];
    if (urls.length === 0) { preview.innerHTML = ''; return; }
    preview.innerHTML = urls.map(function (url) {
      return '<div class="img-thumb-wrapper"><img src="' + url + '" class="img-thumb" loading="lazy"><span class="img-thumb-remove" title="移除">&times;</span></div>';
    }).join('');
    preview.querySelectorAll('.img-thumb-remove').forEach(function (el, j) {
      el.addEventListener('click', function () {
        window.__practiceImgUrls[idx].splice(j, 1);
        renderPracticeThumbnails(idx, preview);
      });
    });
  }

  window.__checkPractice = async (idx, btn) => {
    const qs = window.__practiceQuestions || [];
    const qData = qs[idx];
    if (!qData) return;
    const ta = document.getElementById('pta_' + idx);
    const answer = ta ? ta.value.trim() : '';
    const images = window.__practiceImgUrls && window.__practiceImgUrls[idx] || [];
    const resultDiv = document.getElementById('practiceResult_' + idx);
    const analyzeBtn = document.getElementById('btnAnalysis_' + idx);
    resultDiv.innerHTML = '<div class="loading" style="padding:8px;"><div class="spinner" style="width:20px;height:20px;"></div></div>';

    try {
      const res = await API.gradePractice(
        qData.original_id,
        answer,
        qData.modified_content,
        qData.modified_correct_answer || '',
        images
      );

      if (res.is_correct) {
        resultDiv.innerHTML = `<div style="background:#f0fdf4; border:1px solid #bbf7d0; padding:12px; border-radius:8px; color:#059669;">
          <strong>✅ 正确！</strong><br>
          ${escHtml(res.feedback || '')}
        </div>`;
        window.__lastIsCorrect = true;
      } else {
        resultDiv.innerHTML = `<div style="background:#fef2f2; border:1px solid #fecaca; padding:12px; border-radius:8px;">
          <strong>❌ 还需要改进</strong><br>
          ${escHtml(res.feedback || '')}
          ${res.fallback_hint ? `<div style="margin-top:8px; font-size:13px; color:#64748b;">💡 ${escHtml(res.fallback_hint)}</div>` : ''}
        </div>`;
        window.__lastIsCorrect = false;

        // 显示「录入错题」按钮
        var addBtnRow = document.getElementById('practiceAddBtn_' + idx);
        if (!addBtnRow) {
          addBtnRow = document.createElement('div');
          addBtnRow.id = 'practiceAddBtn_' + idx;
          addBtnRow.style.cssText = 'margin-top:8px;';
          resultDiv.after(addBtnRow);
        }
        addBtnRow.innerHTML = '<button class="btn btn-sm btn-warning" onclick="window.__practiceGoAdd(' + idx + ')">✏️ 录入错题</button>';
      }
      // 启用问题解析按钮
      if (analyzeBtn) {
        analyzeBtn.disabled = false;
        analyzeBtn.style.opacity = '1';
        analyzeBtn.style.cursor = 'pointer';
        analyzeBtn.onclick = function () {
          window.__showPracticeAnalysis(idx);
        };
      }
    } catch (e) {
      resultDiv.innerHTML = '<div style="color:#ef4444; padding:8px;">批改失败：' + e.message + '</div>';
    }
  };

  window.__showPracticeAnalysis = async (idx) => {
    const qs = window.__practiceQuestions || [];
    const qData = qs[idx];
    if (!qData) return;
    const answer = document.getElementById('pta_' + idx) ? document.getElementById('pta_' + idx).value.trim() : '';
    const images = window.__practiceImgUrls && window.__practiceImgUrls[idx] || [];
    const resultDiv = document.getElementById('practiceResult_' + idx);
    resultDiv.innerHTML = '<div class="loading" style="padding:8px;"><div class="spinner" style="width:20px;height:20px;"></div></div>';

    try {
      const res = await API.analyzePractice(
        qData.original_id,
        answer,
        qData.modified_content,
        qData.modified_correct_answer || '',
        window.__lastIsCorrect,
        images
      );
      resultDiv.innerHTML = `<div style="background:#f0f9ff; border:1px solid #bae6fd; padding:12px; border-radius:8px;">
        <strong>📖 问题解析</strong><br><br>
        <div style="font-size:14px; line-height:1.8;">
          ${(res.analysis || '').replace(/\n/g, '<br>')}
        </div>
      </div>`;
    } catch (e) {
      resultDiv.innerHTML = '<div style="color:#ef4446; padding:8px;">生成解析失败：' + e.message + '</div>';
    }
  };

  // ─── 从练习跳转到录入错题 ───
  window.__practiceGoAdd = function (idx) {
    const qs = window.__practiceQuestions || [];
    const qData = qs[idx];
    if (!qData) return;

    // 保存练习当前状态
    window.__practiceSavedState = {
      html: document.getElementById('content').innerHTML,
      questions: qs,
      imgUrls: JSON.parse(JSON.stringify(window.__practiceImgUrls || {})),
      scrollY: window.scrollY,
    };

    // 预填数据
    window.__practiceAddData = {
      content: qData.modified_content || '',
      correct_answer: qData.modified_correct_answer || '',
      wrong_answer: (document.getElementById('pta_' + idx) || {}).value || '',
      wrong_answer_images: (window.__practiceImgUrls && window.__practiceImgUrls[idx]) || [],
      subject: qData.subject || '',
    };

    navigate('add');
  };

  window.__practiceReturn = function () {
    // 如果还没有保存过状态（比如用户从 add 直接点返回），先保存当前页面 HTML
    if (!window.__practiceSavedState) {
      var qs = window.__practiceQuestions;
      if (qs && qs.length > 0) {
        window.__practiceSavedState = {
          html: null,     // 标记：让 renderers.practice 重新生成配置卡片并恢复题目列表
          questions: qs,
          imgUrls: JSON.parse(JSON.stringify(window.__practiceImgUrls || {})),
          scrollY: 0,
        };
      }
    }
    navigate('practice');
  };

  // ═══════════════════════════════════════════════
  //  页面 6: 统计
  // ═══════════════════════════════════════════════

  renderers.stats = async () => {
    try {
      const stats = await API.getStats();
      const forecast = await API.getReviewForecast();

      const html = `
        <h2 class="page-title">📈 学习统计</h2>
        <p class="page-subtitle">数据告诉你哪里进步了，哪里还要加把劲</p>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">📚</div>
            <div class="stat-value">${stats.total_questions}</div>
            <div class="stat-label">总错题</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">🔄</div>
            <div class="stat-value">${stats.total_reviews}</div>
            <div class="stat-label">总复习</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">🎯</div>
            <div class="stat-value">${stats.mastery_rate}%</div>
            <div class="stat-label">整体掌握率</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">📅</div>
            <div class="stat-value">${stats.due_reviews}</div>
            <div class="stat-label">待复习</div>
          </div>
        </div>

        <div class="chart-container">
          <h3 class="card-title">📂 各科错题分布</h3>
          ${renderBarChart(stats.subject_distribution, 'blue')}
        </div>

        <div class="chart-container">
          <h3 class="card-title">📊 难度分布</h3>
          ${renderBarChart(stats.difficulty_distribution, 'green')}
        </div>

        <div class="chart-container">
          <h3 class="card-title">🏆 各科掌握率</h3>
          <div class="bar-chart">
            ${(stats.subject_mastery || []).map(sm => `
              <div class="bar-wrapper">
                <div class="bar-value">${sm.rate}%</div>
                <div class="bar" style="height:${Math.max(4, sm.rate * 1.8)}px; background: linear-gradient(180deg, #34d399, #059669);"></div>
                <div class="bar-label">${escHtml(sm.subject)}<br><small>(${sm.total}题)</small></div>
              </div>
            `).join('')}
            ${(stats.subject_mastery || []).length === 0 ? '<div style="color:#94a3b8; text-align:center; width:100%; padding:20px;">还没有复习记录</div>' : ''}
          </div>
        </div>

        <div class="chart-container">
          <h3 class="card-title">📅 未来 30 天复习预测</h3>
          ${Object.keys(forecast).length > 0 ? renderBarChart(forecast, 'indigo') : '<div style="text-align:center; padding:20px; color:#94a3b8;">暂无数据</div>'}
        </div>

        <div class="chart-container">
          <h3 class="card-title">📋 最近 30 天复习质量</h3>
          ${renderReviewQualityChart(stats.recent_reviews)}
        </div>
      `;
      content().innerHTML = html;
    } catch (e) {
      content().innerHTML = `
        <div class="empty-state">
          <div class="icon">🔌</div>
          <h3>无法连接到后端</h3>
          <p>${e.message}</p>
        </div>
      `;
    }
  };

  // ═══════════════════════════════════════════════
  // ═══════════════════════════════════════════════
  //  页面: AI 模型配置
  // ═══════════════════════════════════════════════

  renderers.ai_model = async () => {
    let config = { model_type: 'openai', api_key: '', model_name: 'gpt-3.5-turbo', base_url: '' };
    let testStatus = { connected: false, message: '未测试' };
    try {
      const saved = await API.getAiConfig();
      if (saved.model_type) config = Object.assign({}, config, saved);
      testStatus = await API.testAiConnection();
    } catch(e) {}

    // 模型类型映射（用于显示友好名称）
    var MODEL_TYPE_MAP = {
      openai: { icon: '🟢', name: 'OpenAI' },
      deepseek: { icon: '🔴', name: 'DeepSeek' },
      custom: { icon: '⚙️', name: '自定义' },
    };

    var modelTypeInfo = MODEL_TYPE_MAP[config.model_type] || MODEL_TYPE_MAP.custom;

    // ======= 已连接 → 简约展示页 =======
    if (testStatus.connected) {
      var connectedHtml = [
        '<h2 class="page-title">🤖 AI 模型</h2>',
        '<div style="text-align:center;padding:60px 20px;">',
        '<div style="font-size:80px;line-height:1;">✅</div>',
        '<div style="font-size:24px;font-weight:600;margin:16px 0 4px;color:#16a34a;">已连接</div>',
        '<div style="color:#64748b;font-size:14px;margin-bottom:8px;">' + escHtml(config.model_name || '') + '</div>',
        '<div style="display:inline-block;background:#f1f5f9;padding:4px 14px;border-radius:12px;font-size:13px;color:#475569;">' + escHtml(modelTypeInfo.icon) + ' ' + escHtml(modelTypeInfo.name) + '</div>',
        '<div style="margin-top:32px;display:flex;gap:10px;justify-content:center;">',
        '<button class="btn btn-outline" id="btnManageConfig">⚙️ 管理配置</button>',
        '<button class="btn btn-danger" id="btnClearFromConnected">🗑️ 清除</button>',
        '</div></div>',
      ].join('');
      content().innerHTML = connectedHtml;

      $('#btnManageConfig').addEventListener('click', function() {
        renderFullAiConfigForm(config, testStatus);
      });
      $('#btnClearFromConnected').addEventListener('click', async function() {
        if (!confirm('确定要清除 AI 配置吗？')) return;
        try { await API.clearAiConfig(); toast('配置已清除', 'info'); renderers.ai_model(); }
        catch(e) { toast('清除失败: ' + e.message, 'error'); }
      });
      return;
    }

    // ======= 未连接 → 完整配置表单 =======
    renderFullAiConfigForm(config, testStatus);
  };

  /** 渲染完整 AI 配置表单 */
  function renderFullAiConfigForm(config, testStatus) {
    var connectedClass = testStatus.connected ? 'connected' : 'disconnected';
    var connectedIcon = testStatus.connected ? '✅' : '❌';

    var modelTypes = [
      { id: 'openai', icon: '🟢', name: 'OpenAI' },
      { id: 'deepseek', icon: '🔴', name: 'DeepSeek' },
      { id: 'custom', icon: '⚙️', name: '自定义' },
    ];

    var html = [
      '<h2 class="page-title">🤖 AI 模型配置</h2>',
      '<p class="page-subtitle">配置 AI 模型后，练习模式将使用 AI 生成高质量变形题</p>',
      '<div class="card">',
      '<div class="ai-status-card ' + connectedClass + '">',
      '<div class="status-icon">' + connectedIcon + '</div>',
      '<div><div class="status-text">' + (testStatus.connected ? '已连接' : '未连接') + '</div>',
      '<div class="status-detail">' + escHtml(testStatus.message) + '</div></div></div>',
      '<div class="form-group"><label>模型类型</label>',
      '<div class="model-type-grid" id="modelTypeGrid">',
      modelTypes.map(function(mt) {
        return '<div class="model-type-card ' + (config.model_type === mt.id ? 'selected' : '') + '" data-type="' + mt.id + '"><div class="type-icon">' + mt.icon + '</div><div class="type-name">' + mt.name + '</div></div>';
      }).join(''),
      '</div></div>',
      '<div class="form-group"><label>API Key</label>',
      '<div style="display:flex;gap:8px;"><input type="password" id="aiApiKey" style="flex:1;" value="' + escHtml(config.api_key || '') + '">',
      '<button class="btn btn-sm btn-secondary" id="btnToggleKey">👁️</button></div></div>',
      '<div class="form-row">',
      '<div class="form-group"><label>模型名称</label><input type="text" id="aiModelName" value="' + escHtml(config.model_name || '') + '">',
      '<div style="font-size:11px;color:#94a3b8;margin-top:2px;">OpenAI: gpt-4o / gpt-4o-mini<br>DeepSeek: deepseek-chat</div></div>',
      '<div class="form-group"><label>接口地址（可选）</label><input type="text" id="aiBaseUrl" value="' + escHtml(config.base_url || '') + '">',
      '<div style="font-size:11px;color:#94a3b8;margin-top:2px;">OpenAI: api.openai.com<br>DeepSeek: api.deepseek.com</div></div>',
      '</div>',
      '<div class="form-actions">',
      '<button class="btn btn-primary" id="btnTestConnection">🧪 测试连接</button>',
      '<button class="btn btn-success" id="btnSaveConfig">💾 保存配置</button>',
      '<button class="btn btn-danger" id="btnClearConfig">🗑️ 清除</button>',
      '</div></div>',
      '<div class="card"><h3 class="card-title">📋 配置说明</h3>',
      '<ul style="font-size:13px;color:#64748b;line-height:2;padding-left:20px;">',
      '<li><strong>OpenAI</strong> — 需要有效的 OpenAI API Key</li>',
      '<li><strong>DeepSeek</strong> — 国内可用，<a href="https://platform.deepseek.com" target="_blank">申请地址</a></li>',
      '<li><strong>自定义</strong> — 兼容 OpenAI 格式的 API</li>',
      '<li>配置后点击「测试连接」确认可用性</li>',
      '<li>知识库上传后，AI 会自动检索上下文（RAG）</li>',
      '</ul></div>',
    ].join('');

    content().innerHTML = html;

    // Model type selection
    $$('.model-type-card').forEach(function(card) {
      card.addEventListener('click', function() {
        $$('.model-type-card').forEach(function(c) { c.classList.remove('selected'); });
        card.classList.add('selected');
      });
    });

    // Toggle key visibility
    $('#btnToggleKey').addEventListener('click', function() {
      var input = $('#aiApiKey');
      input.type = input.type === 'password' ? 'text' : 'password';
    });

    // Test connection
    $('#btnTestConnection').addEventListener('click', async function() {
      var cfg = getAiFormConfig();
      this.textContent = '⏳ 测试中...';
      this.disabled = true;
      try {
        var result = await API.testAiConnectionWith(cfg);
        var sc = document.querySelector('.ai-status-card');
        if (result.connected) {
          sc.className = 'ai-status-card connected';
          sc.innerHTML = '<div class="status-icon">✅</div><div><div class="status-text">已连接</div><div class="status-detail">' + escHtml(result.message) + '</div></div>';
          toast('🎉 连接成功！', 'success');
        } else {
          sc.className = 'ai-status-card disconnected';
          sc.innerHTML = '<div class="status-icon">❌</div><div><div class="status-text">连接失败</div><div class="status-detail">' + escHtml(result.message) + '</div></div>';
          toast('连接失败: ' + result.message, 'error');
        }
      } catch(e) { toast('测试出错: ' + e.message, 'error'); }
      this.textContent = '🧪 测试连接';
      this.disabled = false;
    });

    // Save
    $('#btnSaveConfig').addEventListener('click', async function() {
      var cfg = getAiFormConfig();
      if (!cfg.api_key) { toast('请输入 API Key', 'error'); return; }
      try { await API.setAiConfig(cfg); toast('✅ 配置已保存', 'success'); }
      catch(e) { toast('保存失败: ' + e.message, 'error'); }
    });

    // Clear
    $('#btnClearConfig').addEventListener('click', async function() {
      if (!confirm('确定要清除 AI 配置吗？')) return;
      try { await API.clearAiConfig(); toast('配置已清除', 'info'); renderers.ai_model(); }
      catch(e) { toast('清除失败: ' + e.message, 'error'); }
    });

    function getAiFormConfig() {
      var selectedCard = document.querySelector('.model-type-card.selected');
      return {
        model_type: selectedCard ? selectedCard.dataset.type : 'openai',
        api_key: $('#aiApiKey').value.trim(),
        model_name: $('#aiModelName').value.trim(),
        base_url: $('#aiBaseUrl').value.trim(),
      };
    }
  };

  // ═══════════════════════════════════════════════
  //  页面: 知识库
  // ═══════════════════════════════════════════════

  renderers.knowledge_base = async () => {
    var files = [];
    var uploadQueue = [];   // 待上传文件队列
    try { await API.kbInit(); files = await API.kbListFiles(); } catch(e) {}

    var html = [
      '<h2 class="page-title">📚 知识库</h2>',
      '<p class="page-subtitle">上传学习资料，AI 生成变形题时会自动检索相关内容（RAG）</p>',
      '<div class="card">',
      '<div class="file-upload-area" id="fileUploadArea">',
      '<div class="upload-icon">📄</div>',
      '<div class="upload-text">点击或拖拽文件到此处</div>',
      '<div class="upload-hint">可批量选择 .txt .md .csv .pdf 文件</div>',
      '<input type="file" id="fileInput" accept=".txt,.md,.csv,.pdf" style="display:none;" multiple>',
      '</div>',
      // 待上传队列（初始为空）
      '<div id="kbUploadQueue" style="margin-top:8px;display:none;"></div>',
      '<button class="btn btn-primary" id="btnKbUpload" style="margin-top:8px;display:none;">📤 上传</button>',
      '</div>',
      '<div class="card"><h3 class="card-title">📂 已上传文件 (' + files.length + ')</h3><div id="kbFileList">',
    ].join('');

    if (files.length === 0) {
      html += '<div style="text-align:center;padding:20px;color:#94a3b8;">暂无文件，请上传学习资料</div>';
    } else {
      html += files.map(function(f) {
        return '<div class="file-list-item"><div class="file-icon">📄</div><div class="file-info"><div class="file-name">' + escHtml(f.filename) + '</div><div class="file-meta">' + f.chunk_count + ' 个片段</div></div><button class="btn btn-sm btn-danger" onclick="window.__kbDelete(' + f.id + ')">🗑️</button></div>';
      }).join('');
    }

    html += '</div></div>';
    html += '<div class="card"><h3 class="card-title">🔍 知识库检索测试</h3>';
    html += '<div style="display:flex;gap:8px;"><input type="text" id="kbSearchQuery" placeholder="输入关键词搜索..." style="flex:1;"><button class="btn btn-primary btn-sm" id="btnKbSearch">🔍 搜索</button></div>';
    html += '<div id="kbSearchResults" style="margin-top:12px;"></div></div>';

    content().innerHTML = html;

    // === 文件队列渲染 ===
    function renderQueue() {
      var queueEl = $('#kbUploadQueue');
      var btnEl = $('#btnKbUpload');
      if (uploadQueue.length === 0) {
        queueEl.style.display = 'none';
        btnEl.style.display = 'none';
        return;
      }
      queueEl.style.display = 'block';
      btnEl.style.display = 'inline-block';
      queueEl.innerHTML = uploadQueue.map(function(f, idx) {
        var size = (f.size / 1024).toFixed(1);
        return '<div class="file-list-item queue-item"><div class="file-icon">📄</div><div class="file-info"><div class="file-name">' + escHtml(f.name) + '</div><div class="file-meta">' + size + ' KB</div></div><button class="btn btn-sm btn-danger" data-queue-idx="' + idx + '">✕</button></div>';
      }).join('');
      // 删除队列中的某个文件
      queueEl.querySelectorAll('.queue-item .btn-danger').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var idx = parseInt(btn.dataset.queueIdx);
          uploadQueue.splice(idx, 1);
          renderQueue();
        });
      });
    }

    // === 文件选择（拖拽或点击）===
    var uploadArea = $('#fileUploadArea');
    var fileInput = $('#fileInput');
    uploadArea.addEventListener('click', function() { fileInput.click(); });
    uploadArea.addEventListener('dragover', function(e) { e.preventDefault(); uploadArea.classList.add('dragover'); });
    uploadArea.addEventListener('dragleave', function() { uploadArea.classList.remove('dragover'); });
    uploadArea.addEventListener('drop', function(e) {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
      if (e.dataTransfer.files.length) {
        for (var i = 0; i < e.dataTransfer.files.length; i++) {
          addToQueue(e.dataTransfer.files[i]);
        }
        renderQueue();
      }
    });
    fileInput.addEventListener('change', function() {
      if (fileInput.files.length) {
        for (var i = 0; i < fileInput.files.length; i++) {
          addToQueue(fileInput.files[i]);
        }
        renderQueue();
      }
      fileInput.value = '';  // 允许重复选同名文件
    });

    function addToQueue(file) {
      // 按文件名去重
      var exists = uploadQueue.some(function(f) { return f.name === file.name && f.size === file.size; });
      if (!exists) uploadQueue.push(file);
    }

    // === 提交上传 ===
    $('#btnKbUpload').addEventListener('click', async function() {
      var btn = this;
      btn.disabled = true;
      btn.textContent = '⏳ 上传中...';
      var total = uploadQueue.length;
      var done = 0;
      var failed = 0;

      for (var i = 0; i < uploadQueue.length; i++) {
        var file = uploadQueue[i];
        toast('正在上传 (' + (i + 1) + '/' + total + '): ' + file.name, 'info');
        try {
          await API.kbUpload(file);
          done++;
        } catch(e) {
          toast('上传失败: ' + file.name + ' - ' + e.message, 'error');
          failed++;
        }
      }

      uploadQueue = [];
      renderQueue();
      btn.disabled = false;
      btn.textContent = '📤 上传';
      toast('上传完成: ' + done + ' 成功, ' + failed + ' 失败', failed > 0 ? 'warning' : 'success');
      renderers.knowledge_base();  // 刷新页面
    });

    // Search
    $('#btnKbSearch').addEventListener('click', async function() {
      var query = $('#kbSearchQuery').value.trim();
      if (!query) { toast('请输入搜索关键词', 'warning'); return; }
      var results = $('#kbSearchResults');
      results.innerHTML = '<div class="loading" style="padding:12px;"><div class="spinner" style="width:20px;height:20px;"></div></div>';
      try {
        var data = await API.kbSearch(query);
        if (data.length === 0) {
          results.innerHTML = '<div style="text-align:center;padding:12px;color:#94a3b8;">未找到相关内容</div>';
        } else {
          results.innerHTML = data.map(function(r) {
            return '<div class="kb-search-result"><div class="result-source">📂 ' + escHtml(r.filename) + ' · 匹配度: ' + (r.score * 100).toFixed(1) + '%</div><div>' + escHtml(r.content) + '</div></div>';
          }).join('');
        }
      } catch(e) { results.innerHTML = '<div style="color:#ef4444;padding:12px;">搜索失败: ' + e.message + '</div>'; }
    });

    $('#kbSearchQuery').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') $('#btnKbSearch').click();
    });
  };

  window.__kbDelete = async function(fid) {
    if (!confirm('确定要删除该文件吗？')) return;
    try { await API.kbDeleteFile(fid); toast('已删除', 'success'); renderers.knowledge_base(); }
    catch(e) { toast('删除失败: ' + e.message, 'error'); }
  };

  //  Bootstrap
  // ═══════════════════════════════════════════════

  // 暴露导航供 onclick 使用
  window.__nav = navigate;

  // 侧边栏导航事件
  $$('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.page));
  });

  // 初始渲染
  async function init() {
    // 先同步高亮菜单，避免刷新时先跳再闪
    var target = location.hash.replace('#', '') || 'dashboard';
    if (!renderers[target]) target = 'dashboard';
    currentPage = target;
    $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === target));

    // 再异步检查后端和加载内容
    try {
      await API.health();
      await updateDueBadge();
    } catch {
      // 启动失败提示会在 dashboard 渲染时显示
    }
    renderers[target]();
  }

  init();

  window.addEventListener('hashchange', function () {
    var target = location.hash.replace('#', '') || 'dashboard';
    if (renderers[target]) navigate(target);
  });
})();


