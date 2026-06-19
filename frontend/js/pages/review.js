(() => {
  'use strict';

  window.AppFeatureModules = window.AppFeatureModules || {};

  window.AppFeatureModules.registerReviewPage = function registerReviewPage(ctx) {
    const {
      renderers,
      API,
      content,
      $,
      escHtml,
      difficultyTag,
      renderTextWithImages,
      renderFieldImages,
      renderContent,
      renderMath,
      toast,
      updateDueBadge,
    } = ctx;

    renderers.review = async () => {
      // 获取所有科目
      const subjects = await API.getSubjects();

      // 渲染页面标题与科目筛选栏
      function renderFilterBar(selectedSubjectId) {
        return `
          <div class="review-filter-bar">
            <span class="review-filter-label">📚 筛选科目：</span>
            <div class="review-filter-chips">
              <button class="chip ${!selectedSubjectId ? 'chip-active' : ''}" data-subject-id="">
                全部
              </button>
              ${subjects.map(s => `
                <button class="chip ${selectedSubjectId == s.id ? 'chip-active' : ''}" data-subject-id="${s.id}">
                  ${escHtml(s.name)}
                </button>
              `).join('')}
            </div>
          </div>
        `;
      }

      async function loadReview(subjectId) {
        const due = await API.getDueReviews(10, subjectId || undefined);
        content().innerHTML = `
          <h2 class="page-title">🔄 复习模式</h2>
          <p class="page-subtitle">基于遗忘曲线的智能复习，巩固薄弱环节</p>
          ${renderFilterBar(subjectId)}
          <div class="review-container" id="reviewContainer"></div>
        `;

        // 绑定筛选按钮事件
        document.querySelectorAll('.review-filter-chips .chip').forEach(btn => {
          btn.addEventListener('click', () => {
            const sid = btn.getAttribute('data-subject-id');
            loadReview(sid ? parseInt(sid) : null);
          });
        });

        if (due.length === 0) {
          $('#reviewContainer').innerHTML = `
            <div class="empty-state">
              <div class="icon">🎉</div>
              <h3>今日无待复习题目</h3>
              <p>${subjectId ? '该科目暂无待复习题目。' : '太棒了！或者去录入一些错题吧。'}</p>
              <button class="btn btn-primary" onclick="window.__nav('add')" style="margin-top:12px;">✏️ 录入错题</button>
            </div>
          `;
          updateDueBadge();
          return;
        }

        let queue = [...due];
        let currentIdx = 0;

        function renderCurrent() {
          if (currentIdx >= queue.length) {
            $('#reviewContainer').innerHTML = `
              <div class="review-card">
                <div style="font-size:48px; margin-bottom:16px;">🎉</div>
                <h3>复习完成！</h3>
                <p style="color:#64748b; margin:12px 0;">本次共复习 ${queue.length} 道题</p>
                <button class="btn btn-primary" onclick="window.__nav('review')">🔄 继续复习</button>
              </div>
            `;
            updateDueBadge();
            return;
          }

          const q = queue[currentIdx];
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
                <div class="question-text">${renderContent(q.content)}${renderFieldImages('content', q.images)}</div>
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
          $('#btnSkipReview').addEventListener('click', () => {
            currentIdx++;
            renderCurrent();
          });
        }

        function revealAnswer(q) {
          const area = $('#reviewResultArea');
          const actions = $('#reviewActions');

          area.innerHTML = `
            <div class="review-result-card">
              <div class="review-answer-compare wrong" style="margin-bottom:12px;">
                <strong>✅ 正确答案：</strong><br>${renderContent(q.correct_answer)}${renderFieldImages('correct_answer', q.images)}
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

          renderMath(area);

          actions.innerHTML = `
            <button class="btn btn-success" onclick="window.__submitReview(${q.id}, 'correct', ${currentIdx})">✅ 正确</button>
            <button class="btn btn-warning" onclick="window.__submitReview(${q.id}, 'partial', ${currentIdx})">⚠️ 部分正确</button>
            <button class="btn btn-danger" onclick="window.__submitReview(${q.id}, 'wrong', ${currentIdx})">❌ 错误</button>
          `;

          updateDueBadge();
        }

        window.__submitReview = async (qid, result) => {
          try {
            await API.submitReview(qid, result);
            toast(
              result === 'correct' ? '🎉 很棒！' : result === 'partial' ? '继续加油！' : '💪 下次一定对！',
              result === 'correct' ? 'success' : result === 'partial' ? 'warning' : 'error'
            );
          } catch (e) {
            toast('保存失败', 'error');
          }
          currentIdx++;
          renderCurrent();
        };

        renderCurrent();
      }

      // 初始加载（不筛选）
      await loadReview(null);
    };
  };
})();
