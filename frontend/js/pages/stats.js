(() => {
  'use strict';

  window.AppFeatureModules = window.AppFeatureModules || {};

  window.AppFeatureModules.registerStatsPage = function registerStatsPage(ctx) {
    const { renderers, API, content, escHtml, renderBarChart, renderReviewQualityChart } = ctx;

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
  };
})();
