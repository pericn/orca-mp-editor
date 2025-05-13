const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const MarkdownIt = require('markdown-it');
const markdownItMark = require('markdown-it-mark'); // 引入高亮插件

const md = new MarkdownIt();
md.use(markdownItMark); // 使用高亮插件

// 自定义图片渲染规则，添加 figcaption
md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const src = token.attrGet('src'); // 获取图片的 src 属性
  const alt = token.content || ''; // 获取图片的 alt 属性

  // 如果 alt 存在，则生成 figcaption，否则不生成
  const figcaption = alt ? `<figcaption>${alt}</figcaption>` : '';

  return `
    <figure>
      <img src="${src}" alt="${alt}">
      ${figcaption}
    </figure>
  `;
};

const inputFile = path.join(__dirname, '我是谁.md');
const outputFile = path.join(__dirname, 'Orca.html');
const cssFile = 'Orca.css'; // 引用的 CSS 文件

// 将 Markdown 转换为 HTML 的函数
const convertMarkdownToHTML = () => {
  try {
    // 读取 Markdown 文件内容
    let markdown = fs.readFileSync(inputFile, 'utf-8');

    // 移除前两个分割线及其之间的内容
    markdown = markdown.replace(/^---[\s\S]*?---/, '').trim();

    // 提取 Markdown 文件中的第一个 h1 作为文章标题
    const titleMatch = markdown.match(/^#\s+(.*)$/m); // 匹配第一个 h1 标签
    const title = titleMatch ? titleMatch[1].trim() : '示范文章';

    // 移除第一个 h1 标签内容
    const markdownWithoutTitle = markdown.replace(/^#\s+.*$/m, '').trim();

    // 渲染 Markdown 内容为 HTML
    let renderedContent = md.render(markdownWithoutTitle);

    // 确保 <br> 标签正确生效
    renderedContent = renderedContent.replace(/<h2(.*?)>(.*?)<\/h2>/g, (match, attrs, content) => {
      const processedContent = content.replace(/&lt;br&gt;/g, '<br>'); // 确保 <br> 标签正确渲染
      return `<h2${attrs}>${processedContent}</h2>`;
    });

    // 读取现有的 Orca.html 文件
    let htmlContent = fs.readFileSync(outputFile, 'utf-8');

    // 替换文章标题
    htmlContent = htmlContent.replace(/<h1>.*<\/h1>/, `<h1>${title}</h1>`);

    // 替换用户创建内容
    htmlContent = htmlContent.replace(
      /<main class="note-to-mp">[\s\S]*?<\/main>/,
      `<main class="note-to-mp">${renderedContent}</main>`
    );

    // 写回更新后的 HTML 文件
    fs.writeFileSync(outputFile, htmlContent, 'utf-8');
    console.log(`Updated: ${outputFile}`);
  } catch (error) {
    console.error('Error updating HTML:', error);
  }
};

// 初次转换
convertMarkdownToHTML();

// 监听 Markdown 文件的变化
chokidar.watch(inputFile).on('change', () => {
  console.log('Markdown file changed. Updating HTML...');
  convertMarkdownToHTML();
});