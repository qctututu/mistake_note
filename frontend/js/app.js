(() => {
  'use strict';

  const renderers = {};
  const { ui, format, charts, data, runtime } = window.AppCore;

  ui.initModalHandlers();

  const navigator = runtime.createNavigator(renderers, ui);
  const moduleContext = {
    renderers,
    API,
    ...ui,
    ...format,
    checkAiConfigured: () => data.checkAiConfigured(API),
    loadSubjects: () => data.loadSubjects(API),
    renderSubjectOptions: (subjects, selectedId) => data.renderSubjectOptions(subjects, selectedId, ui.escHtml),
    renderBarChart: (chartData, color) => charts.renderBarChart(chartData, color, ui.escHtml),
    renderReviewQualityChart: charts.renderReviewQualityChart,
    updateDueBadge: () => data.updateDueBadge(API, ui.$),
    navigate: navigator.navigate,
  };

  runtime.registerFeatureModules(moduleContext, [
    'registerDashboardPage',
    'registerAddPage',
    'registerBrowsePage',
    'registerReviewPage',
    'registerStatsPage',
    'registerPracticePage',
    'registerAiModelPage',
    'registerKnowledgeBasePage',
  ]);

  window.__nav = navigator.navigate;
  runtime.bindSidebarNavigation(ui, navigator.navigate);

  runtime.initFromHash({
    renderers,
    setCurrent: navigator.setCurrent,
    ui,
    health: () => API.health(),
    updateDueBadge: moduleContext.updateDueBadge,
  });

  window.addEventListener('hashchange', () => runtime.handleHashChange(renderers, navigator.navigate));
})();
