(() => {
  'use strict';

  window.AppFeatureModules = window.AppFeatureModules || {};

  window.AppFeatureModules.registerAiModelPage = function registerAiModelPage(ctx) {
    const { renderers, API, content, $, $$, escHtml, toast } = ctx;

    renderers.ai_model = async () => {
      let config = { model_type: 'openai', api_key: '', model_name: 'gpt-3.5-turbo', base_url: '' };
      let testStatus = { connected: false, message: '未测试' };
      try {
        const saved = await API.getAiConfig();
        if (saved.model_type) config = Object.assign({}, config, saved);
        testStatus = await API.testAiConnection();
      } catch (e) {}

      var MODEL_TYPE_MAP = {
        openai: { icon: '🟢', name: 'OpenAI' },
        deepseek: { icon: '🔴', name: 'DeepSeek' },
        custom: { icon: '⚙️', name: '自定义' },
      };

      var modelTypeInfo = MODEL_TYPE_MAP[config.model_type] || MODEL_TYPE_MAP.custom;

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

        $('#btnManageConfig').addEventListener('click', function () {
          renderFullAiConfigForm(config, testStatus);
        });
        $('#btnClearFromConnected').addEventListener('click', async function () {
          if (!confirm('确定要清除 AI 配置吗？')) return;
          try {
            await API.clearAiConfig();
            toast('配置已清除', 'info');
            renderers.ai_model();
          } catch (e) {
            toast('清除失败: ' + e.message, 'error');
          }
        });
        return;
      }

      renderFullAiConfigForm(config, testStatus);
    };

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
        modelTypes.map(function (mt) {
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

      $$('.model-type-card').forEach(function (card) {
        card.addEventListener('click', function () {
          $$('.model-type-card').forEach(function (c) {
            c.classList.remove('selected');
          });
          card.classList.add('selected');
        });
      });

      $('#btnToggleKey').addEventListener('click', function () {
        var input = $('#aiApiKey');
        input.type = input.type === 'password' ? 'text' : 'password';
      });

      $('#btnTestConnection').addEventListener('click', async function () {
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
        } catch (e) {
          toast('测试出错: ' + e.message, 'error');
        }
        this.textContent = '🧪 测试连接';
        this.disabled = false;
      });

      $('#btnSaveConfig').addEventListener('click', async function () {
        var cfg = getAiFormConfig();
        if (!cfg.api_key) {
          toast('请输入 API Key', 'error');
          return;
        }
        try {
          await API.setAiConfig(cfg);
          toast('✅ 配置已保存', 'success');
        } catch (e) {
          toast('保存失败: ' + e.message, 'error');
        }
      });

      $('#btnClearConfig').addEventListener('click', async function () {
        if (!confirm('确定要清除 AI 配置吗？')) return;
        try {
          await API.clearAiConfig();
          toast('配置已清除', 'info');
          renderers.ai_model();
        } catch (e) {
          toast('清除失败: ' + e.message, 'error');
        }
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
    }
  };
})();
