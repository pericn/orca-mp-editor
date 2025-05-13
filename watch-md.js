const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const { exec } = require('child_process');
const MarkdownIt = require('markdown-it');
const markdownItMark = require('markdown-it-mark'); // 高亮插件

const md = new MarkdownIt();
md.use(markdownItMark);

// 自定义图片渲染规则，添加 figcaption
md.renderer.rules.image = (tokens, idx) => {
  const token = tokens[idx];
  const src = token.attrGet('src');
  const alt = token.content || '';
  const figcaption = alt ? `<figcaption>${alt}</figcaption>` : '';
  return `<figure><img src="${src}" alt="${alt}">${figcaption}</figure>`;
};

const inputFile = path.join(__dirname, '我是谁.md');
const outputFile = path.join(__dirname, 'Orca.html');
const cssFile = path.join(__dirname, 'Orca.css');
const inlineScript = path.join(__dirname, 'inline-orca.js');

// Markdown 转 HTML 并写入 Orca.html
const convertMarkdownToHTML = () => {
  try {
    let markdown = fs.readFileSync(inputFile, 'utf-8');
    markdown = markdown.replace(/^---[\s\S]*?---/, '').trim();
    const titleMatch = markdown.match(/^#\s+(.*)$/m);
    const title = titleMatch ? titleMatch[1].trim() : '示范文章';
    const markdownWithoutTitle = markdown.replace(/^#\s+.*$/m, '').trim();
    let renderedContent = md.render(markdownWithoutTitle);
    renderedContent = renderedContent.replace(/<h2(.*?)>(.*?)<\/h2>/g, (match, attrs, content) => {
      const processedContent = content.replace(/&lt;br&gt;/g, '<br>');
      return `<h2${attrs}>${processedContent}</h2>`;
    });
    let htmlContent = fs.readFileSync(outputFile, 'utf-8');
    htmlContent = htmlContent.replace(/<h1>.*<\/h1>/, `<h1>${title}</h1>`);
    htmlContent = htmlContent.replace(
      /<main class="note-to-mp">[\s\S]*?<\/main>/,
      `<main class="note-to-mp">${renderedContent}</main>`
    );
    fs.writeFileSync(outputFile, htmlContent, 'utf-8');
    console.log(`Updated: ${outputFile}`);
  } catch (error) {
    console.error('Error updating HTML:', error);
  }
};

// 执行 inline-orca.js
const runInlineOrca = () => {
  exec(`node "${inlineScript}"`, (err, stdout, stderr) => {
    if (err) {
      console.error('inline-orca.js error:', stderr);
    } else {
      console.log('inline-orca.js finished.');
    }
  });
};

// 统一处理流程
const processAll = () => {
  convertMarkdownToHTML();
  runInlineOrca();
};

// 初次执行
processAll();

// 监听 Markdown 和 CSS 文件
chokidar.watch([inputFile, cssFile]).on('change', (filePath) => {
  console.log(`${path.basename(filePath)} changed. Updating...`);
  processAll();
});