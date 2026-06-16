(() => {
  'use strict';

  window.AppCore = window.AppCore || {};

  function formatDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso.replace(' ', 'T') + '+08:00');
    return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function diffDays(iso) {
    if (!iso) return 99;
    const now = new Date();
    const d = new Date(iso.replace(' ', 'T') + '+08:00');
    return Math.ceil((d - now) / 86400000);
  }

  window.AppCore.format = {
    formatDate,
    diffDays,
  };
})();
