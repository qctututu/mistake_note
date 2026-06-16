(() => {
  'use strict';

  window.AppFeatureModules = window.AppFeatureModules || {};

  window.AppFeatureModules.registerPracticePage = function registerPracticePage(ctx) {
    const {
      renderers,
      API,
      checkAiConfigured,
      loadSubjects,
      renderSubjectOptions,
      content,
      $,
      escHtml,
      toast,
      showModal,
      closeModal,
      navigate,
    } = ctx;

    renderers.practice = async () => {
      if (window.__practiceSavedState) {
        var saved = window.__practiceSavedState;
        window.__practiceSavedState = null;
        window.__practiceQuestions = saved.questions;
        window.__practiceImgUrls = saved.imgUrls || {};
        if (saved.html) {
          document.getElementById('content').innerHTML = saved.html;
          if (saved.scrollY) {
            setTimeout(function () {
              window.scrollTo(0, saved.scrollY);
            }, 50);
          }
          return;
        }
        window.__practiceRestoreQuestions = saved.questions;
        window.__practiceRestoreImgUrls = saved.imgUrls;
      }

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
              <span class="img-upload-btn" data-target="practice_${i}" title="上传图片答案">🖼 上传图片答案</span>
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
      `;
      }).join('');
      container.innerHTML = html;

      window.__practiceQuestions = questions;

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
      if (urls.length === 0) {
        preview.innerHTML = '';
        return;
      }
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

    window.__checkPractice = async (idx) => {
      const qs = window.__practiceQuestions || [];
      const qData = qs[idx];
      if (!qData) return;
      const ta = document.getElementById('pta_' + idx);
      const answer = ta ? ta.value.trim() : '';
      const images = (window.__practiceImgUrls && window.__practiceImgUrls[idx]) || [];
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

          var addBtnRow = document.getElementById('practiceAddBtn_' + idx);
          if (!addBtnRow) {
            addBtnRow = document.createElement('div');
            addBtnRow.id = 'practiceAddBtn_' + idx;
            addBtnRow.style.cssText = 'margin-top:8px;';
            resultDiv.after(addBtnRow);
          }
          addBtnRow.innerHTML = '<button class="btn btn-sm btn-warning" onclick="window.__practiceGoAdd(' + idx + ')">✏️ 录入错题</button>';
        }

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
      const images = (window.__practiceImgUrls && window.__practiceImgUrls[idx]) || [];
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

    window.__practiceGoAdd = function (idx) {
      const qs = window.__practiceQuestions || [];
      const qData = qs[idx];
      if (!qData) return;

      window.__practiceSavedState = {
        html: document.getElementById('content').innerHTML,
        questions: qs,
        imgUrls: JSON.parse(JSON.stringify(window.__practiceImgUrls || {})),
        scrollY: window.scrollY,
      };

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
      if (!window.__practiceSavedState) {
        var qs = window.__practiceQuestions;
        if (qs && qs.length > 0) {
          window.__practiceSavedState = {
            html: null,
            questions: qs,
            imgUrls: JSON.parse(JSON.stringify(window.__practiceImgUrls || {})),
            scrollY: 0,
          };
        }
      }
      navigate('practice');
    };
  };
})();
