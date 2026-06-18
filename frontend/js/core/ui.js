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

  /** 安全的 SVG 标签白名单 */
  var SVG_ALLOWED_TAGS = {
    svg: true, g: true, path: true, circle: true, rect: true,
    line: true, polygon: true, polyline: true, ellipse: true,
    text: true, tspan: true, defs: true, linearGradient: true,
    radialGradient: true, stop: true, marker: true, filter: true,
    feGaussianBlur: true, use: true, image: true, clipPath: true,
    mask: true, pattern: true, desc: true, title: true, style: true,
    a: true, foreignObject: true,
  };

  function sanitizeSvg(svg) {
    var temp = document.createElement('div');
    temp.innerHTML = svg;
    // 移除 script 标签和 on* 事件属性
    var all = temp.querySelectorAll('*');
    all.forEach(function(el) {
      if (el.tagName === 'SCRIPT') { el.remove(); return; }
      if (!SVG_ALLOWED_TAGS[el.tagName.toLowerCase()]) { el.remove(); return; }
      Array.from(el.attributes).forEach(function(attr) {
        if (attr.name.startsWith('on') || attr.name === 'href' || attr.name === 'xlink:href') {
          el.removeAttribute(attr.name);
        }
      });
    });
    return temp.innerHTML;
  }

  /** 渲染题目内容：转义文本 + 保留 SVG + 保留 markdown 图片 */
  function renderContent(text) {
    if (!text) return '';
    // 提取并保护 SVG 块
    var svgBlocks = [];
    var processed = text.replace(/<svg[\s\S]*?<\/svg>/gi, function(match) {
      var idx = svgBlocks.length;
      svgBlocks.push(sanitizeSvg(match));
      return '%%SVG_' + idx + '%%';
    });
    // 转义非 SVG 部分
    var escaped = escHtml(processed);
    // 将 SVG 块安全插回
    var result = escaped.replace(/%%SVG_(\d+)%%/g, function(_, idx) {
      return svgBlocks[parseInt(idx)] || '';
    });
    // 转换 markdown 图片
    result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="inline-image" loading="lazy">');
    return result;
  }

  function renderMath(container) {
    if (typeof renderMathInElement === 'function') {
      try {
        renderMathInElement(container, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
          ],
          throwOnError: false,
        });
      } catch (e) {
        // KaTeX 渲染异常不影响页面功能
      }
    }
  }

  window.AppCore.ui = {
    $,
    $$,
    content,
    toast,
    escHtml,
    renderContent,
    renderTextWithImages,
    extractImageUrls,
    renderFieldImages,
    setupImageUpload,
    difficultyTag,
    starRating,
    showModal,
    closeModal,
    initModalHandlers,
    renderMath,
  };
})();
