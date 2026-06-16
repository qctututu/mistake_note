(() => {
  'use strict';

  window.AppCore = window.AppCore || {};

  function renderBarChart(data, color, escHtml) {
    const vals = Object.values(data);
    const max = Math.max(...vals, 1);
    const colors = {
      indigo: 'linear-gradient(180deg, #818cf8, #4f46e5)',
      blue: 'linear-gradient(180deg, #38bdf8, #0ea5e9)',
      green: 'linear-gradient(180deg, #34d399, #10b981)',
    };
    const g = colors[color || 'primary'] || colors.indigo;
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

  window.AppCore.charts = {
    renderBarChart,
    renderReviewQualityChart,
  };
})();
