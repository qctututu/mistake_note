(() => {
  'use strict';

  window.AppFeatureModules = window.AppFeatureModules || {};

  window.AppFeatureModules.registerBrowsePage = function registerBrowsePage(ctx) {
    const {
      renderers,
      API,
      loadSubjects,
      renderSubjectOptions,
      formatDate,
      renderContent,
      renderTextWithImages,
      renderFieldImages,
      difficultyTag,
      diffDays,
      setupImageUpload,
      starRating,
      content,
      $,
      escHtml,
      toast,
      updateDueBadge,
    } = ctx;

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
      window.__browseState = state;

      async function loadBrowse() {
        const el = $('#browseList');
        try {
          const res = await API.listQuestions({
            page: state.page,
            page_size: state.pageSize,
            subject_id: state.subjectId || undefined,
            search: state.search || undefined,
            sort_by: state.sortBy,
            sort_order: state.sortOrder,
          });
          renderBrowseList(el, res, state);
          renderPagination(res, state);
        } catch (e) {
          el.innerHTML = `<div class="empty-state"><div class="icon">❌</div><h3>加载失败</h3><p>${e.message}</p></div>`;
        }
      }

      $('#btnFilter').addEventListener('click', () => {
        state.subjectId = $('#filterSubject').value;
        state.search = $('#filterSearch').value;
        state.sortBy = $('#filterSort').value;
        state.page = 1;
        loadBrowse();
      });

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
          <div class="q-content">${renderContent(q.content)}${renderFieldImages('content', q.images)}</div>
          ${q.wrong_answer ? `<div class="q-wrong">❌ 你的错误答案：${renderContent(q.wrong_answer)}${renderFieldImages('wrong_answer', q.images)}</div>` : ''}
          <div class="q-answer">✅ 正确答案：${renderContent(q.correct_answer)}${renderFieldImages('correct_answer', q.images)}</div>
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
      if (res.total_pages <= 1) {
        el.innerHTML = '';
        return;
      }
      let html = '';
      html += `<button ${state.page <= 1 ? 'disabled' : ''} onclick="window.__browsePage(${state.page - 1})">‹ 上一页</button>`;
      for (let p = Math.max(1, state.page - 2); p <= Math.min(res.total_pages, state.page + 2); p++) {
        html += p === state.page ? `<span class="current-page">${p}</span>` : `<button onclick="window.__browsePage(${p})">${p}</button>`;
      }
      html += `<button ${state.page >= res.total_pages ? 'disabled' : ''} onclick="window.__browsePage(${state.page + 1})">下一页 ›</button>`;
      el.innerHTML = html;
    }

    window.__browsePage = (p) => {
      const state = window.__browseState || { page: 1, pageSize: 10 };
      state.page = p;
      window.__browseState = state;
      const asyncLoad = async () => {
        const el = $('#browseList');
        try {
          const res = await API.listQuestions({
            page: state.page,
            page_size: state.pageSize,
            subject_id: state.subjectId || undefined,
            search: state.search || undefined,
            sort_by: state.sortBy,
            sort_order: state.sortOrder,
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

        var _editImgUrls = { edit_content: [], edit_correct_answer: [], edit_wrong_answer: [] };
        try {
          var existingImgs = JSON.parse(q.images || '{}');
          _editImgUrls.edit_content = existingImgs.content || [];
          _editImgUrls.edit_correct_answer = existingImgs.correct_answer || [];
          _editImgUrls.edit_wrong_answer = existingImgs.wrong_answer || [];
          ['edit_content', 'edit_correct_answer', 'edit_wrong_answer'].forEach(function(f) {
            var preview = document.getElementById('preview_' + f);
            if (preview) renderEditThumbnails(f, preview);
          });
        } catch (e) {}

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
            if (file.size > 10 * 1024 * 1024) {
              toast('图片不能超过 10MB', 'error');
              input.value = '';
              return;
            }
            try {
              input.disabled = true;
              btn.style.opacity = '0.5';
              var result = await API.uploadImage(file);
              _editImgUrls[textareaName].push(result.url);
              renderEditThumbnails(textareaName, preview);
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

        function renderEditThumbnails(field, preview) {
          var urls = _editImgUrls[field] || [];
          if (urls.length === 0) {
            preview.innerHTML = '';
            return;
          }
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
          data.images = JSON.stringify({
            content: _editImgUrls.edit_content,
            correct_answer: _editImgUrls.edit_correct_answer,
            wrong_answer: _editImgUrls.edit_wrong_answer,
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
  };
})();
