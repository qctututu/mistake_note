(() => {
  'use strict';

  window.AppCore = window.AppCore || {};

  function createNavigator(renderers, ui) {
    let currentPage = 'dashboard';

    function navigate(page) {
      if (currentPage === page) return;
      currentPage = page;
      ui.$$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
      location.hash = '#' + page;
      if (renderers[page]) renderers[page]();
      else ui.content().innerHTML = '<div class="empty-state"><div class="icon">🚧</div><h3>页面建设中</h3></div>';
      // 渲染 LaTeX 公式
      setTimeout(function () { ui.renderMath(ui.content()); }, 50);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function setCurrent(page) {
      currentPage = page;
    }

    return { navigate, setCurrent };
  }

  function registerFeatureModules(ctx, names) {
    names.forEach(function (name) {
      const fn = window.AppFeatureModules && window.AppFeatureModules[name];
      if (typeof fn === 'function') fn(ctx);
    });
  }

  function bindSidebarNavigation(ui, navigate) {
    ui.$$('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.dataset.page));
    });
  }

  async function initFromHash(opts) {
    const targetRaw = location.hash.replace('#', '') || 'dashboard';
    const target = opts.renderers[targetRaw] ? targetRaw : 'dashboard';
    opts.setCurrent(target);
    opts.ui.$$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === target));

    try {
      await opts.health();
      await opts.updateDueBadge();
    } catch {
      // dashboard handles backend unavailable state
    }
    opts.renderers[target]();
    setTimeout(function () { opts.ui.renderMath(opts.ui.content()); }, 50);
  }

  function handleHashChange(renderers, navigate) {
    var target = location.hash.replace('#', '') || 'dashboard';
    if (renderers[target]) navigate(target);
  }

  window.AppCore.runtime = {
    createNavigator,
    registerFeatureModules,
    bindSidebarNavigation,
    initFromHash,
    handleHashChange,
  };
})();
