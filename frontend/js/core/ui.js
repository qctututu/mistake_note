(() => {
  'use strict';

  window.AppCore = window.AppCore || {};

  const $ = (s, p) => (p || document).querySelector(s);
  const $$ = (s, p) => [...(p || document).querySelectorAll(s)];
  const content = () => $('#content');

  function toast(msg, type = 'info') {
    const container = $('#toastContainer');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(100%)';
      el.style.transition = '0.3s';
    }, 2500);
    setTimeout(() => el.remove(), 3000);
  }

  function escHtml(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function renderTextWithImages(text) {
    return (text || '').replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="inline-image">');
  }

  function extractImageUrls(text) {
    var urls = [];
    text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function (_, alt, url) {
      urls.push(url);
    });
    return urls;
  }

  function renderFieldImages(field, imagesJson) {
    if (!imagesJson) return '';
    try {
      var imgs = JSON.parse(imagesJson);
      var urls = imgs[field] || [];
      if (urls.length === 0) return '';
      return urls.map(function (url) {
        return '<img src="' + url + '" class="field-image" loading="lazy">';
      }).join('');
    } catch (e) {
      return '';
    }
  }

  function setupImageUpload(textareaName) {
    return '<span class="img-upload-btn" data-target="' + textareaName + '" title="上传图片">\uD83D\uDDBC</span>';
  }

  function difficultyTag(diff) {
    const labels = { 1: '⭐ 简单', 2: '⭐⭐ 较易', 3: '⭐⭐⭐ 中等', 4: '⭐⭐⭐⭐ 较难', 5: '⭐⭐⭐⭐⭐ 困难' };
    return `<span class="tag tag-difficulty-${diff}">${labels[diff] || '中等'}</span>`;
  }

  function starRating(value, name = 'difficulty') {
    let html = '<div class="star-rating">';
    for (let i = 1; i <= 5; i++) {
      html += `<span class="star ${i <= value ? 'active' : ''}" data-value="${i}" data-name="${name}">★</span>`;
    }
    html += '</div>';
    return html;
  }

  function showModal(title, bodyHtml, footerBtns) {
    const overlay = $('#modalOverlay');
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = bodyHtml;
    const footer = $('#modalFooter');
    footer.innerHTML = '';
    if (footerBtns) {
      footerBtns.forEach(btn => {
        const el = document.createElement('button');
        el.className = `btn ${btn.cls || 'btn-secondary'}`;
        el.textContent = btn.text;
        if (btn.onclick) el.onclick = btn.onclick;
        footer.appendChild(el);
      });
    }
    overlay.classList.remove('hidden');
    return overlay;
  }

  function closeModal() {
    $('#modalOverlay').classList.add('hidden');
  }

  function initModalHandlers() {
    document.addEventListener('click', (e) => {
      if (e.target.id === 'modalOverlay') closeModal();
    });
    if ($('#modalCloseBtn')) {
      $('#modalCloseBtn').addEventListener('click', closeModal);
    }
  }

  window.AppCore.ui = {
    $,
    $$,
    content,
    toast,
    escHtml,
    renderTextWithImages,
    extractImageUrls,
    renderFieldImages,
    setupImageUpload,
    difficultyTag,
    starRating,
    showModal,
    closeModal,
    initModalHandlers,
  };
})();
