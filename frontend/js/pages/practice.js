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
      renderContent,
      toast,
      showModal,
      closeModal,
      navigate,
      renderMath,
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

      const hasRestore = window.__practiceRestoreQuestions || window.__practiceSavedState;
      // 如果是恢复状态，保持原有生成题列表展示
      if (hasRestore) {
        const html = `
          <h2 class="page-title">🎯 练习模式</h2>
          <p class="page-subtitle">AI 生成变形题，训练真正的理解能力</p>
          <div id="practiceList"></div>
        `;
        content().innerHTML = html;
        if (window.__practiceRestoreQuestions) {
          var restoreQs = window.__practiceRestoreQuestions;
          window.__practiceRestoreQuestions = null;
          window.__practiceRestoreImgUrls = null;
          window.__practiceQuestions = restoreQs;
          window.__practiceImgUrls = window.__practiceRestoreImgUrls || {};
          var listEl = $('#practiceList');
          if (listEl && restoreQs.length > 0) {
            renderPracticeList(listEl, restoreQs);
          }
        }
        return;
      }

      // ─── 主界面：先按科目列出错题，逐题生成 ───
      const html = `
        <h2 class="page-title">🎯 练习模式</h2>
        <p class="page-subtitle">选择科目，从错题列表中逐道生成变形题</p>

        <div class="card">
          <div class="form-row">
            <div class="form-group">
              <label>科目</label>
              <select id="practiceSubject">
                <option value="">— 全部科目 —</option>
                ${renderSubjectOptions(subjects)}
              </select>
            </div>
          </div>
          <button class="btn btn-primary btn-block" id="btnListQuestions">📋 列出错题</button>
        </div>

        <div id="practiceSourceList"></div>
        <div id="practiceGeneratedSection"></div>
      `;
      content().innerHTML = html;

      // ─── 列出错题 ───
      $('#btnListQuestions').addEventListener('click', async () => {
        const subjectId = $('#practiceSubject').value || undefined;
        const listEl = $('#practiceSourceList');
        listEl.innerHTML = '<div class="loading"><div class="spinner"></div><p>加载错题列表...</p></div>';

        try {
          const res = await API.listQuestions({ subject_id: subjectId, page_size: 9999 });
          const questions = res.data || [];
          if (questions.length === 0) {
            listEl.innerHTML = '<div class="empty-state"><div class="icon">📭</div><h3>暂无错题</h3><p>请先录入一些错题</p></div>';
            return;
          }
          renderSourceQuestionList(listEl, questions);
        } catch (e) {
          listEl.innerHTML = `<div class="empty-state"><div class="icon">❌</div><h3>加载失败</h3><p>${e.message}</p></div>`;
        }
      });
    };

    // ─── 渲染错题源列表（简略内容 + 查看详情按钮） ───
    function renderSourceQuestionList(container, questions) {
      container.innerHTML = questions.map(function(q) {
        // 从 images JSON 中提取该题的图片缩略图
        var imgHtml = '';
        var allUrls = [];
        try {
          var imgs = JSON.parse(q.images || '{}');
          allUrls = imgs.content || [];
          if (allUrls.length > 0) {
            imgHtml = '<div style="display:flex; gap:4px; margin:6px 0; flex-wrap:wrap;">' +
              allUrls.slice(0, 3).map(function(url) {
                return '<img src="' + url + '" class="source-thumb" data-fullsrc="' + url + '" style="max-height:50px; max-width:70px; border-radius:4px; border:1px solid var(--border); object-fit:cover; cursor:pointer;">';
              }).join('') +
              (allUrls.length > 3 ? '<span style="font-size:12px; color:#94a3b8; line-height:50px;">+更多</span>' : '') +
              '</div>';
          }
        } catch(e) {}

        var hasImages = allUrls.length > 0;
        var hasText = q.content && q.content.trim() && q.content.trim() !== ' ';

        return '<div class="practice-source-card" data-qid="' + q.id + '">' +
          '<div style="display:flex; justify-content:space-between; align-items:flex-start;">' +
            '<div>' +
              '<div class="q-subject" style="margin-bottom:2px;">' +
                escHtml(q.subject_name || '') +
                ' · 难度 ' + (q.difficulty || '?') +
                (q.knowledge_points ? ' · ' + escHtml(q.knowledge_points) : '') +
              '</div>' +
              '<div style="font-size:13px; color:#94a3b8;">' +
                (hasText ? escHtml((q.content.trim().length > 80 ? q.content.trim().slice(0, 80) + '…' : q.content.trim())) : '') +
                (!hasText && hasImages ? '📷 图片题目' : '') +
                (!hasText && !hasImages ? '（题目内容为空）' : '') +
              '</div>' +
            '</div>' +
            '<button class="btn btn-sm btn-secondary btn-view-detail" style="white-space:nowrap; flex-shrink:0; margin-left:12px;">👁 查看详情</button>' +
          '</div>' +
          imgHtml +
          '<div class="practice-gen-controls">' +
            '<label style="font-size:13px; color:#64748b; margin-right:6px;">生成</label>' +
            '<select class="gen-count" style="width:70px; padding:4px 6px; border:1px solid var(--border); border-radius:6px; font-size:13px;">' +
              '<option value="1">1 题</option>' +
              '<option value="3" selected>3 题</option>' +
              '<option value="5">5 题</option>' +
            '</select>' +
            '<button class="btn btn-sm btn-primary btn-gen-variant" style="margin-left:8px;">🤖 生成变形题</button>' +
          '</div>' +
          '<div class="practice-gen-results" style="margin-top:10px;"></div>' +
        '</div>';
      }).join('');

      // 绑定「查看详情」按钮
      container.querySelectorAll('.btn-view-detail').forEach(function(btn, idx) {
        btn.addEventListener('click', function() {
          var q = questions[idx];
          showQuestionDetail(q);
        });
      });

      // 绑定图片双击查看原图
      container.querySelectorAll('.source-thumb').forEach(function(img) {
        img.addEventListener('dblclick', function() {
          var src = img.dataset.fullsrc || img.src;
          showModal('查看原图',
            '<div style="text-align:center"><img src="' + src + '" style="max-width:100%;max-height:80vh;border-radius:8px;"></div>',
            [{ text: '关闭', cls: 'btn-secondary', onclick: closeModal }]
          );
        });
      });

      // 绑定每个生成按钮
      container.querySelectorAll('.btn-gen-variant').forEach(function(btn) {
        btn.addEventListener('click', async function() {
          var card = btn.closest('.practice-source-card');
          var qid = parseInt(card.dataset.qid);
          var count = parseInt(card.querySelector('.gen-count').value);
          var resultsDiv = card.querySelector('.practice-gen-results');

          resultsDiv.innerHTML = '<div class="loading" style="padding:12px;"><div class="spinner" style="width:24px;height:24px;"></div><p style="font-size:13px; margin-top:6px;">🤖 AI 正在生成变形题...</p></div>';
          btn.disabled = true;

          try {
            var genQuestions = await API.generateFromQuestion(qid, count);
            if (!genQuestions || genQuestions.length === 0) {
              resultsDiv.innerHTML = '<div style="color:#ef4444; font-size:13px; padding:8px;">生成失败，请重试</div>';
              return;
            }
            renderGeneratedResults(resultsDiv, genQuestions, qid);
          } catch (e) {
            resultsDiv.innerHTML = '<div style="color:#ef4444; font-size:13px; padding:8px;">生成失败: ' + e.message + '</div>';
          } finally {
            btn.disabled = false;
          }
        });
      });
    }

    // ─── 查看错题详情弹窗 ───
    function showQuestionDetail(q) {
      function buildField(label, text, images, fieldName) {
        var parts = [];
        if (text && text.trim() && text.trim() !== ' ') {
          parts.push(escHtml(text.trim()));
        }
        if (images && images.length > 0) {
          images.forEach(function(url) {
            parts.push('<img src="' + url + '" style="max-width:100%; max-height:300px; border-radius:8px; margin:4px 0; border:1px solid var(--border); display:block;">');
          });
        }
        if (parts.length === 0) return '';
        return '<div style="margin-bottom:14px;">' +
          '<strong style="color:#334155;">' + label + '</strong>' +
          '<div style="margin-top:4px; font-size:14px; line-height:1.7;">' + parts.join('\n') + '</div></div>';
      }

      var imgs = {};
      try { imgs = JSON.parse(q.images || '{}'); } catch(e) {}

      var bodyHtml = '<div style="max-height:65vh; overflow-y:auto;">' +
        '<div style="margin-bottom:12px; display:flex; gap:8px; flex-wrap:wrap;">' +
          '<span class="tag tag-difficulty-' + (q.difficulty || 3) + '">⭐ ' + (q.difficulty || '?') + '</span>' +
          (q.knowledge_points ? q.knowledge_points.split(',').map(function(k) { return '<span class="tag">' + escHtml(k.trim()) + '</span>'; }).join('') : '') +
          (q.source ? '<span class="tag">📎 ' + escHtml(q.source) + '</span>' : '') +
        '</div>' +
        buildField('📝 题目内容', q.content, imgs.content, 'content') +
        buildField('✅ 正确答案', q.correct_answer, imgs.correct_answer, 'correct_answer') +
        buildField('❌ 你的错误答案', q.wrong_answer, imgs.wrong_answer, 'wrong_answer') +
        (q.analysis ? '<div style="margin-bottom:14px;"><strong style="color:#334155;">💡 错因分析</strong><div style="margin-top:4px; font-size:14px; line-height:1.7;">' + escHtml(q.analysis) + '</div></div>' : '') +
        '<div style="font-size:12px; color:#94a3b8; border-top:1px solid var(--border); padding-top:8px;">创建时间: ' + escHtml(q.created_at || '') + '</div>' +
      '</div>';

      showModal('📘 ' + escHtml(q.subject_name || '') + ' 错题详情', bodyHtml, [
        { text: '关闭', cls: 'btn-secondary', onclick: closeModal }
      ]);
    }

    // ─── 渲染某道题的生成结果 ───
    function renderGeneratedResults(container, questions, originalQid) {
      var genMethod = questions.some(function(q) { return q.strategies_used && q.strategies_used.indexOf('AI 生成') !== -1; }) ? 'AI' : '规则引擎';
      window.__practiceQuestions = (window.__practiceQuestions || []).concat(questions);
      window.__practiceImgUrls = window.__practiceImgUrls || {};

      var offset = window.__practiceQuestions.length - questions.length;
      container.innerHTML = questions.map(function(q, i) {
        var globalIdx = offset + i;
        window.__practiceImgUrls[globalIdx] = window.__practiceImgUrls[globalIdx] || [];
        if (q.error) {
          return '<div class="practice-card" style="border-left-color:#ef4444; padding:12px;">' +
            '<div style="color:#ef4444;">❌ 生成失败: ' + escHtml(q.error) + '</div></div>';
        }
        return '<div class="practice-card">' +
          (q.hint ? '<div class="practice-hint">💡 ' + escHtml(q.hint) + '</div>' : '') +
          (q.changed_aspects ? '<div style="font-size:12px; color:#0ea5e5; background:#f0f9ff; padding:6px 12px; border-radius:6px; margin-bottom:12px;">🔄 改动说明: ' + escHtml(q.changed_aspects) + '</div>' : '') +
          '<div class="q-subject">' + escHtml(q.subject) + ' · 变形题</div>' +
          (q.knowledge_points ? '<div style="margin-bottom:8px;">' + q.knowledge_points.split(',').map(function(k) { return '<span class="tag">' + escHtml(k.trim()) + '</span>'; }).join('') + '</div>' : '') +
          '<div class="q-content" style="font-size:16px;">' + renderContent(q.modified_content) + '</div>' +

          '<div id="practiceAnswer_' + globalIdx + '" style="margin-top:12px;">' +
            '<textarea id="pta_' + globalIdx + '" placeholder="写出你的答案……" rows="3" style="width:100%; padding:10px 14px; border:1.5px solid var(--border); border-radius:8px; font-size:14px; resize:vertical;"></textarea>' +
            '<div style="margin-top:4px;">' +
              '<span class="img-upload-btn" data-target="practice_' + globalIdx + '" title="上传图片答案">🖼 上传图片答案</span>' +
              '<div class="img-preview" id="preview_practice_' + globalIdx + '"></div>' +
            '</div>' +
          '</div>' +

          '<div style="display:flex; gap:8px; margin-top:12px;">' +
            '<button class="btn btn-sm btn-primary" onclick="window.__checkPractice(' + globalIdx + ', this)">📝 核对答案</button>' +
            '<button class="btn btn-sm btn-secondary" id="btnAnalysis_' + globalIdx + '" disabled style="opacity:0.5; cursor:not-allowed;">📖 问题解析</button>' +
          '</div>' +
          '<div id="practiceResult_' + globalIdx + '" style="margin-top:12px;"></div>' +
          '<div class="original-ref">📎 使用 ' + genMethod + ' · 原题 ID: ' + (q.original_id || originalQid) + '</div>' +
        '</div>';
      }).join('');

      // 绑定图片上传
      questions.forEach(function(q, i) {
        if (q.error) return;
        var globalIdx = offset + i;
        bindPracticeImageUpload(globalIdx);
      });

      // 渲染 LaTeX 公式 & 滚动到结果区域
      renderMath(container);
      setTimeout(function() {
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }

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
          <div class="q-content" style="font-size:16px;">${renderContent(q.modified_content)}</div>

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
