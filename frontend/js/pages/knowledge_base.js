(() => {
  'use strict';

  window.AppFeatureModules = window.AppFeatureModules || {};

  window.AppFeatureModules.registerKnowledgeBasePage = function registerKnowledgeBasePage(ctx) {
    const { renderers, API, content, $, escHtml, toast } = ctx;

    renderers.knowledge_base = async () => {
      var files = [];
      var uploadQueue = [];
      try {
        await API.kbInit();
        files = await API.kbListFiles();
      } catch (e) {}

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
        '<div id="kbUploadQueue" style="margin-top:8px;display:none;"></div>',
        '<button class="btn btn-primary" id="btnKbUpload" style="margin-top:8px;display:none;">📤 上传</button>',
        '</div>',
        '<div class="card"><h3 class="card-title">📂 已上传文件 (' + files.length + ')</h3><div id="kbFileList">',
      ].join('');

      if (files.length === 0) {
        html += '<div style="text-align:center;padding:20px;color:#94a3b8;">暂无文件，请上传学习资料</div>';
      } else {
        html += files.map(function (f) {
          return '<div class="file-list-item"><div class="file-icon">📄</div><div class="file-info"><div class="file-name">' + escHtml(f.filename) + '</div><div class="file-meta">' + f.chunk_count + ' 个片段</div></div><button class="btn btn-sm btn-danger" onclick="window.__kbDelete(' + f.id + ')">🗑️</button></div>';
        }).join('');
      }

      html += '</div></div>';
      html += '<div class="card"><h3 class="card-title">🔍 知识库检索测试</h3>';
      html += '<div style="display:flex;gap:8px;"><input type="text" id="kbSearchQuery" placeholder="输入关键词搜索..." style="flex:1;"><button class="btn btn-primary btn-sm" id="btnKbSearch">🔍 搜索</button></div>';
      html += '<div id="kbSearchResults" style="margin-top:12px;"></div></div>';

      content().innerHTML = html;

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
        queueEl.innerHTML = uploadQueue.map(function (f, idx) {
          var size = (f.size / 1024).toFixed(1);
          return '<div class="file-list-item queue-item"><div class="file-icon">📄</div><div class="file-info"><div class="file-name">' + escHtml(f.name) + '</div><div class="file-meta">' + size + ' KB</div></div><button class="btn btn-sm btn-danger" data-queue-idx="' + idx + '">✕</button></div>';
        }).join('');
        queueEl.querySelectorAll('.queue-item .btn-danger').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var idx = parseInt(btn.dataset.queueIdx);
            uploadQueue.splice(idx, 1);
            renderQueue();
          });
        });
      }

      var uploadArea = $('#fileUploadArea');
      var fileInput = $('#fileInput');
      uploadArea.addEventListener('click', function () {
        fileInput.click();
      });
      uploadArea.addEventListener('dragover', function (e) {
        e.preventDefault();
        uploadArea.classList.add('dragover');
      });
      uploadArea.addEventListener('dragleave', function () {
        uploadArea.classList.remove('dragover');
      });
      uploadArea.addEventListener('drop', function (e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
          for (var i = 0; i < e.dataTransfer.files.length; i++) {
            addToQueue(e.dataTransfer.files[i]);
          }
          renderQueue();
        }
      });
      fileInput.addEventListener('change', function () {
        if (fileInput.files.length) {
          for (var i = 0; i < fileInput.files.length; i++) {
            addToQueue(fileInput.files[i]);
          }
          renderQueue();
        }
        fileInput.value = '';
      });

      function addToQueue(file) {
        var exists = uploadQueue.some(function (f) {
          return f.name === file.name && f.size === file.size;
        });
        if (!exists) uploadQueue.push(file);
      }

      $('#btnKbUpload').addEventListener('click', async function () {
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
          } catch (e) {
            toast('上传失败: ' + file.name + ' - ' + e.message, 'error');
            failed++;
          }
        }

        uploadQueue = [];
        renderQueue();
        btn.disabled = false;
        btn.textContent = '📤 上传';
        toast('上传完成: ' + done + ' 成功, ' + failed + ' 失败', failed > 0 ? 'warning' : 'success');
        renderers.knowledge_base();
      });

      $('#btnKbSearch').addEventListener('click', async function () {
        var query = $('#kbSearchQuery').value.trim();
        if (!query) {
          toast('请输入搜索关键词', 'warning');
          return;
        }
        var results = $('#kbSearchResults');
        results.innerHTML = '<div class="loading" style="padding:12px;"><div class="spinner" style="width:20px;height:20px;"></div></div>';
        try {
          var data = await API.kbSearch(query);
          if (data.length === 0) {
            results.innerHTML = '<div style="text-align:center;padding:12px;color:#94a3b8;">未找到相关内容</div>';
          } else {
            results.innerHTML = data.map(function (r) {
              return '<div class="kb-search-result"><div class="result-source">📂 ' + escHtml(r.filename) + ' · 匹配度: ' + (r.score * 100).toFixed(1) + '%</div><div>' + escHtml(r.content) + '</div></div>';
            }).join('');
          }
        } catch (e) {
          results.innerHTML = '<div style="color:#ef4444;padding:12px;">搜索失败: ' + e.message + '</div>';
        }
      });

      $('#kbSearchQuery').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') $('#btnKbSearch').click();
      });
    };

    window.__kbDelete = async function (fid) {
      if (!confirm('确定要删除该文件吗？')) return;
      try {
        await API.kbDeleteFile(fid);
        toast('已删除', 'success');
        renderers.knowledge_base();
      } catch (e) {
        toast('删除失败: ' + e.message, 'error');
      }
    };
  };
})();
