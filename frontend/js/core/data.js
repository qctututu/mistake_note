(() => {
  'use strict';

  window.AppCore = window.AppCore || {};

  async function checkAiConfigured(API) {
    try {
      const status = await API.getAiStatus();
      return status.configured;
    } catch {
      return false;
    }
  }

  async function loadSubjects(API) {
    try {
      return await API.getSubjects();
    } catch {
      return [];
    }
  }

  function renderSubjectOptions(subjects, selectedId, escHtml) {
    return subjects.map(s =>
      `<option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>${escHtml(s.name)}</option>`
    ).join('');
  }

  async function updateDueBadge(API, $) {
    try {
      const due = await API.getDueReviews(1);
      const count = due.length;
      const badge = $('#dueBadge');
      if (badge) {
        badge.innerHTML = count > 0 ? `📅 ${count} 题待复习` : '📅 今日无复习';
        badge.style.background = count > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.2)';
      }
    } catch {
      // ignore
    }
  }

  window.AppCore.data = {
    checkAiConfigured,
    loadSubjects,
    renderSubjectOptions,
    updateDueBadge,
  };
})();
