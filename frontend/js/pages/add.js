(() => {
  'use strict';

  window.AppFeatureModules = window.AppFeatureModules || {};

  window.AppFeatureModules.registerAddPage = function registerAddPage(ctx) {
    const {
      renderers,
      API,
      loadSubjects,
      renderSubjectOptions,
      starRating,
      setupImageUpload,
      showModal,
      closeModal,
      content,
      $,
      toast,
      updateDueBadge,
      navigate,
    } = ctx;

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
              <textarea name="content" id="ta_content" rows="4" placeholder="输入题目内容……"></textarea>
              <div class="img-preview" id="preview_content"></div>
            </div>

            <div class="form-group">
              <label>正确答案 <span class="required">*</span> ${setupImageUpload('correct_answer', 'preview_correct')}</label>
              <textarea name="correct_answer" id="ta_correct_answer" rows="3" placeholder="标准答案或正确解法"></textarea>
              <div class="img-preview" id="preview_correct_answer"></div>
            </div>

            <div class="form-group">
              <label>你的错误答案 ${setupImageUpload('wrong_answer', 'preview_wrong')}</label>
              <textarea name="wrong_answer" id="ta_wrong_answer" rows="2" placeholder="当时你写了什么？"></textarea>
              <div class="img-preview" id="preview_wrong_answer"></div>
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

      var _imgUrls = { content: [], correct_answer: [], wrong_answer: [] };
      var _pendingFiles = { content: [], correct_answer: [], wrong_answer: [] };

      function readFileAsDataURL(file) {
        return new Promise(function (resolve) {
          var reader = new FileReader();
          reader.onload = function (e) { resolve(e.target.result); };
          reader.readAsDataURL(file);
        });
      }

      function addLocalImage(textareaName, file) {
        if (file.size > 10 * 1024 * 1024) {
          toast('图片不能超过 10MB', 'error');
          return;
        }
        var preview = document.getElementById('preview_' + textareaName);
        readFileAsDataURL(file).then(function (dataUrl) {
          _pendingFiles[textareaName].push(file);
          _imgUrls[textareaName].push(dataUrl);
          renderThumbnails(textareaName, preview);
        });
      }

      function bindImageUpload(textareaName) {
        var btn = document.querySelector('.img-upload-btn[data-target="' + textareaName + '"]');
        var input = document.getElementById('imgInput_' + textareaName);
        var preview = document.getElementById('preview_' + textareaName);
        if (!btn || !input || !preview) return;

        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          input.click();
        });

        input.addEventListener('change', function () {
          var file = input.files[0];
          if (!file) return;
          addLocalImage(textareaName, file);
          input.value = '';
        });
      }

      function setupPasteImage(textareaName) {
        var ta = document.getElementById('ta_' + textareaName);
        if (!ta) return;
        ta.addEventListener('paste', function (e) {
          var items = e.clipboardData && e.clipboardData.items;
          if (!items) return;
          var imageItem = null;
          for (var i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image/') === 0) {
              imageItem = items[i];
              break;
            }
          }
          if (!imageItem) return;

          e.preventDefault();
          var file = imageItem.getAsFile();
          if (!file) return;
          file = new File([file], 'clipboard_' + Date.now() + '.png', { type: file.type });
          addLocalImage(textareaName, file);
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
            _pendingFiles[field].splice(idx, 1);
            renderThumbnails(field, preview);
          });
        });
        preview.querySelectorAll('.img-thumb').forEach(function (el) {
          el.addEventListener('dblclick', function () {
            showModal('查看原图',
              '<div style="text-align:center"><img src="' + el.src + '" style="max-width:100%;max-height:80vh;border-radius:8px;"></div>',
              [{ text: '关闭', cls: 'btn-secondary', onclick: closeModal }]
            );
          });
        });
      }

      bindImageUpload('content');
      bindImageUpload('correct_answer');
      bindImageUpload('wrong_answer');

      setupPasteImage('content');
      setupPasteImage('correct_answer');
      setupPasteImage('wrong_answer');

      if (window.__practiceAddData) {
        var pData = window.__practiceAddData;
        var taContent = document.getElementById('ta_content');
        var taCorrect = document.getElementById('ta_correct_answer');
        var taWrong = document.getElementById('ta_wrong_answer');
        if (taContent) taContent.value = pData.content || '';
        if (taCorrect) taCorrect.value = pData.correct_answer || '';
        if (taWrong) taWrong.value = pData.wrong_answer || '';

        if (pData.subject) {
          var subjSelect = document.querySelector('#addForm select[name="subject_id"]');
          if (subjSelect) {
            var matched = subjects.find(function(s) { return s.name === pData.subject; });
            if (matched) {
              subjSelect.value = matched.id;
            }
          }
        }

        if (pData.wrong_answer_images && pData.wrong_answer_images.length > 0) {
          _imgUrls.wrong_answer = pData.wrong_answer_images.slice();
          var pw = document.getElementById('preview_wrong_answer');
          if (pw) renderThumbnails('wrong_answer', pw);
        }

        window.__practiceAddData = null;
      }

      $('#addForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);

        // 如果内容为空但有图片，自动填充半角空格，同时保留 images 元数据
        var contentVal = fd.get('content') || '';
        var correctVal = fd.get('correct_answer') || '';
        if (!contentVal.trim() && _imgUrls.content.length > 0) {
          fd.set('content', ' ');
        }
        if (!correctVal.trim() && _imgUrls.correct_answer.length > 0) {
          fd.set('correct_answer', ' ');
        }

        var subjectId = parseInt(fd.get('subject_id') || 0);
        var difficulty = parseInt(fd.get('difficulty') || 3);

        if (!subjectId) {
          toast('请选择科目', 'error');
          return;
        }
        if (!fd.get('content').trim() && _imgUrls.content.length === 0) {
          toast('请输入题目内容或上传图片', 'error');
          return;
        }
        if (!fd.get('correct_answer').trim() && _imgUrls.correct_answer.length === 0) {
          toast('请输入正确答案或上传图片', 'error');
          return;
        }

        // 重置表单中已有字段，用正确处理后的值覆盖
        fd.set('subject_id', subjectId);
        fd.set('difficulty', difficulty);

        // 将待上传的图片文件附加到 FormData
        var totalImages = 0;
        ['content', 'correct_answer', 'wrong_answer'].forEach(function (field) {
          (_pendingFiles[field] || []).forEach(function (file, idx) {
            fd.append('image_' + field + '_' + idx, file);
            totalImages++;
          });
        });

        try {
          // 有图片用 FormData 提交，无图片用 JSON 提交
          if (totalImages > 0) {
            await API.addQuestionWithImages(fd);
          } else {
            var plainData = {};
            fd.forEach(function (v, k) { plainData[k] = v; });
            plainData.subject_id = parseInt(plainData.subject_id);
            plainData.difficulty = parseInt(plainData.difficulty || 3);
            plainData.images = JSON.stringify(_imgUrls);
            await API.addQuestion(plainData);
          }

          toast('✅ 错题已保存！', 'success');
          e.target.reset();
          _imgUrls = { content: [], correct_answer: [], wrong_answer: [] };
          _pendingFiles = { content: [], correct_answer: [], wrong_answer: [] };
          $('#difficultyStars').querySelectorAll('.star').forEach((s, i) => s.classList.toggle('active', i < 3));
          $('#addForm [name="difficulty"]').value = 3;
          document.querySelectorAll('.img-preview').forEach(function(el) { el.innerHTML = ''; });
          updateDueBadge();

          if (window.__practiceSavedState) {
            window.__practiceSavedState = null;
            navigate('practice');
          }
        } catch (err) {
          toast('保存失败：' + err.message, 'error');
        }
      });
    };
  };
})();
