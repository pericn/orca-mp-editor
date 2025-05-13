const fs = require('fs');
const { JSDOM } = require('jsdom');
const postcss = require('postcss');

// 读取 HTML 和 CSS 文件
const html = fs.readFileSync('Orca.html', 'utf8');
const css = fs.readFileSync('Orca.css', 'utf8');

// 使用 jsdom 解析 HTML
const dom = new JSDOM(html);
const document = dom.window.document;

// 解析 CSS 文件
const root = postcss.parse(css);

// SVG 标签名集合
const svgTags = ['svg', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'g', 'text', 'defs', 'use', 'symbol', 'clipPath', 'mask', 'pattern', 'marker', 'filter', 'feGaussianBlur', 'feOffset', 'feBlend', 'feColorMatrix', 'feComponentTransfer', 'feComposite', 'feConvolveMatrix', 'feDiffuseLighting', 'feDisplacementMap', 'feFlood', 'feFuncA', 'feFuncB', 'feFuncG', 'feFuncR', 'feImage', 'feMerge', 'feMergeNode', 'feMorphology', 'feSpecularLighting', 'feTile', 'feTurbulence'];

// 提取伪类内容
const pseudoElements = {};
root.walkRules((rule) => {
  if (rule.selector.includes('::before') || rule.selector.includes('::after')) {
    const baseSelector = rule.selector.replace(/::(before|after)/, '').trim();
    const pseudoType = rule.selector.includes('::before') ? 'before' : 'after';
    pseudoElements[baseSelector] = pseudoElements[baseSelector] || {};
    pseudoElements[baseSelector][pseudoType] = rule;
  }
});

// 处理 SVG 相关伪类
Object.keys(pseudoElements).forEach((selector) => {
  // 判断是否 SVG 标签
  const tag = selector.split(/[#. ]/)[0];
  if (svgTags.includes(tag)) {
    // 查找所有对应 SVG 元素
    document.querySelectorAll(selector).forEach((el) => {
      ['before', 'after'].forEach((type) => {
        const rule = pseudoElements[selector][type];
        if (rule) {
          // 提取所有样式属性（不包括 content）
          const styleStr = rule.nodes
            .filter((node) => node.type === 'decl' && node.prop !== 'content')
            .map((node) => `${node.prop}:${node.value};`)
            .join('');
          // 合并到 style 属性
          el.setAttribute('style', (el.getAttribute('style') || '') + styleStr);
        }
      });
    });
    // 移除已处理的 SVG 伪类，避免后续重复处理
    delete pseudoElements[selector];
  }
});

// 手动处理非 SVG 伪元素，将其内容插入到 HTML 中
const processPseudoElements = (element, selector) => {
  const pseudo = pseudoElements[selector];
  if (pseudo) {
    if (pseudo.before) {
      const beforeContent = pseudo.before.nodes.find((node) => node.prop === 'content')?.value.replace(/['"]/g, '');
      if (beforeContent && beforeContent !== 'none') {
        const beforeSpan = document.createElement('span');
        beforeSpan.style.cssText = pseudo.before.nodes
          .filter((node) => node.type === 'decl' && node.prop !== 'content')
          .map((node) => `${node.prop}:${node.value};`)
          .join('');
        beforeSpan.textContent = beforeContent;
        element.insertAdjacentElement('afterbegin', beforeSpan);
      }
    }
    if (pseudo.after) {
      const afterContent = pseudo.after.nodes.find((node) => node.prop === 'content')?.value.replace(/['"]/g, '');
      if (afterContent && afterContent !== 'none') {
        const afterSpan = document.createElement('span');
        afterSpan.style.cssText = pseudo.after.nodes
          .filter((node) => node.type === 'decl' && node.prop !== 'content')
          .map((node) => `${node.prop}:${node.value};`)
          .join('');
        afterSpan.textContent = afterContent;
        element.insertAdjacentElement('beforeend', afterSpan);
      }
    }
  }
};

// 只处理正文部分（假设正文容器为 .note-to-mp）
const mainContent = document.querySelector('.note-to-mp');
if (mainContent) {
  // 处理正文内所有元素的伪类
  mainContent.querySelectorAll('*').forEach((element) => {
    const selector =
      element.tagName.toLowerCase() +
      (element.id ? `#${element.id}` : '') +
      (element.className ? `.${element.className.split(' ').join('.')}` : '');
    processPseudoElements(element, selector);
  });

  // 将 CSS 样式内联到正文部分（如需保留 style，可加到 mainContent 内部）
  const styleElement = document.createElement('style');
  styleElement.textContent = css;
  mainContent.insertBefore(styleElement, mainContent.firstChild);

  // 输出正文部分 HTML
  fs.writeFileSync('Orca-inlined.html', mainContent.outerHTML, 'utf8');
  console.log('仅正文部分和伪元素已成功处理并输出到文件中！');
} else {
  console.error('未找到正文容器 .note-to-mp');
}