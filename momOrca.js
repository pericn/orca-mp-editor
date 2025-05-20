const express = require('express');
const fs = require('fs');
const path = require('path');
const juice = require('juice');
const postcss = require('postcss');
const customProperties = require('postcss-custom-properties');
const { JSDOM } = require('jsdom');
const MarkdownIt = require('markdown-it');
const markdownItMark = require('markdown-it-mark');

const app = express();
const PORT = 3730;

// 初始化 markdown-it
const md = new MarkdownIt();
md.use(markdownItMark);

// 自定义图片渲染规则
md.renderer.rules.image = (tokens, idx) => {
  const token = tokens[idx];
  const src = token.attrGet('src');
  const alt = token.content || '';
  const figcaption = alt ? `<figcaption>${alt}</figcaption>` : '';
  return `<figure><img src="${src}" alt="${alt}" onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'24\\' height=\\'24\\' viewBox=\\'0 0 24 24\\'%3E%3Cpath fill=\\'%23ccc\\' d=\\'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.9 13.98l2.1 2.53 3.1-3.99c.2-.26.6-.26.8.01l3.51 4.68a.5.5 0 0 1-.4.8H6.02c-.42 0-.65-.48-.39-.81L8.12 14c.19-.26.57-.27.78-.02z\'/%3E%3C/svg%3E'">${figcaption}</figure>`;
};

// 静态资源服务
app.use(express.static(__dirname));

const ROOT_CONFIG = path.join(__dirname, 'docs_root.json');
function saveDocsRoot(rootPath) {
  fs.writeFileSync(ROOT_CONFIG, JSON.stringify({ root: rootPath }), 'utf-8');
}
function getDocsRoot() {
  if (fs.existsSync(ROOT_CONFIG)) {
    return JSON.parse(fs.readFileSync(ROOT_CONFIG, 'utf-8')).root;
  }
  return null;
}

app.use(express.json());

// 设置文档库根目录
app.post('/api/set-root', (req, res) => {
  const { rootPath } = req.body;
  if (!rootPath || typeof rootPath !== 'string') {
    return res.status(400).json({ error: 'Invalid rootPath' });
  }
  saveDocsRoot(rootPath);
  res.json({ success: true });
});

// 处理样式内联的 API
app.post('/api/inline-styles', express.json(), async (req, res) => {
  try {
    const { html, css } = req.body;
    if (!html || !css) {
      return res.status(400).json({ error: 'Missing HTML or CSS content' });
    }

    // 1. 展开 CSS 变量
    const result = await postcss([
      customProperties({ preserve: false })
    ]).process(css, { from: undefined });
    const flatCss = result.css;

    // 2. juice inline，保留伪类
    let inlined = juice.inlineContent(html, flatCss, {
      preserveImportant: true,
      applyStyleTags: false,
      removeStyleTags: true,
      preserveMediaQueries: true,
      preserveFontFaces: true,
      inlinePseudoElements: true,
      preserveKeyFrames: true,
      webResources: { images: false }
    });

    // 3. 用 jsdom 处理 SVG 伪类
    const dom = new JSDOM(inlined);
    const document = dom.window.document;

    // 4. 修复 h2::before 的 content 只剩一位数字的问题，并将 ::after 的 span 转为 img
    Array.from(document.querySelectorAll('h2')).forEach(h2 => {
      const spans = h2.querySelectorAll('span');
      // 补齐数字
      if (spans[0] && /^\d$/.test(spans[0].textContent.trim())) {
        spans[0].textContent = spans[0].textContent.trim().padStart(2, '0');
      }
      // 查找带 background-image 的 span
      spans.forEach(span => {
        const style = span.getAttribute('style') || '';
        const bgMatch = style.match(/background-image:\s*url\(["']?([^)"]+)["']?\)/i);
        if (bgMatch) {
          // 提取原 style，去除所有 background 相关属性
          const newStyle = style
            .split(';')
            .map(s => s.trim())
            .filter(s => s && !/^background(-image|-size|-position|-repeat)?\s*:/.test(s))
            .join(';');
          // 创建 img 元素
          const img = document.createElement('img');
          img.setAttribute('src', bgMatch[1]);
          img.setAttribute('style', newStyle);
          img.setAttribute('alt', 'h2-bg');

          // 替换 span 为 img
          span.replaceWith(img);
        }
      });
    });

    // 输出最终 HTML
    const resultHtml = dom.serialize();
    res.json({ html: resultHtml });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process styles' });
  }
});

// 首页
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'orca.html'));
});

app.listen(PORT);