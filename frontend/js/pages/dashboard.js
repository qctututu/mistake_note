(() => {
  'use strict';

  window.AppFeatureModules = window.AppFeatureModules || {};

  window.AppFeatureModules.registerDashboardPage = function registerDashboardPage(ctx) {
    const { renderers, API, content, escHtml, renderBarChart, renderReviewQualityChart } = ctx;

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
  };
})();
