const express = require('express');
const fs = require('fs');
const path = require('path');
const juice = require('juice');
const postcss = require('postcss');
const customProperties = require('postcss-custom-properties');
const { JSDOM } = require('jsdom');

const app = express();
const articlesDir = path.join(__dirname, 'articles');

// 获取 Markdown 文件目录树
function getMarkdownFiles(dir) {
  const files = fs.readdirSync(dir);
  return files
    .filter(file => !file.startsWith('.')) // 过滤隐藏文件夹
    .map(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        return { name: file, type: 'directory', children: getMarkdownFiles(fullPath) };
      } else if (file.endsWith('.md')) {
        return { name: file, type: 'file', path: fullPath };
      }
    })
    .filter(Boolean);
}

// 提供目录结构的 API
app.get('/api/articles', (req, res) => {
  const tree = getMarkdownFiles(articlesDir);
  res.json(tree);
});

// 提供 Markdown 文件内容的 API
app.get('/api/article', (req, res) => {
  const filePath = req.query.path;
  if (!filePath || !filePath.endsWith('.md')) {
    return res.status(400).send('Invalid file path');
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  res.send(content);
});

// 新增：处理样式内联的 API
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
        const bgMatch = style.match(/background-image:\s*url\(["']?([^)"']+)["']?\)/i);
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
    console.error('Error processing styles:', error);
    res.status(500).json({ error: 'Failed to process styles' });
  }
});

// 提供静态文件服务
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'orca.html'));
});

const PORT = 3730;
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});