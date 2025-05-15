const md = new markdownit(); // 使用 markdown-it 初始化
md.use(markdownitMark); // 启用高亮插件

// 自定义图片渲染规则，添加 figcaption
md.renderer.rules.image = (tokens, idx) => {
  const token = tokens[idx];
  const src = token.attrGet('src');
  const alt = token.content || '';
  const figcaption = alt ? `<figcaption>${alt}</figcaption>` : '';
  return `<figure><img src="${src}" alt="${alt}">${figcaption}</figure>`;
};

// 获取 Markdown 文件目录树
function getMarkdownFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getMarkdownFiles(fullPath, fileList);
    } else if (file.endsWith('.md')) {
      fileList.push(fullPath);
    }
  });
  return fileList;
}

// 渲染目录树
async function renderFileTree() {
  try {
    const response = await fetch('/api/articles');
    const tree = await response.json();
    const fileTree = document.getElementById('fileTree');
    fileTree.innerHTML = '';

function createTreeNode(node) {
  const li = document.createElement('li');
  const span = document.createElement('span');
  span.textContent = node.name;

  // 添加图标
  if (node.type === 'file') {
    span.style.cursor = 'pointer';
    span.innerHTML = '📄 ' + node.name; // 文件图标
    span.onclick = () => loadMarkdown(node.path);
    li.appendChild(span); // 文件直接插入 <span>
  } else if (node.type === 'directory') {
    span.innerHTML = '📂 ' + node.name; // 目录图标
    span.style.cursor = 'pointer';
    span.onclick = () => {
      const ul = li.querySelector('ul');
      if (ul) {
        ul.style.display = ul.style.display === 'none' ? 'block' : 'none';
      }
    };

    const ul = document.createElement('ul');
    ul.style.display = 'none'; // 默认折叠

    // 检查并生成子节点
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => ul.appendChild(createTreeNode(child)));
    } else {
      const emptyMessage = document.createElement('li');
      emptyMessage.textContent = '（空文件夹）';
      ul.appendChild(emptyMessage);
    }

    li.appendChild(span); // 确保文件夹的 <span> 在子节点之前
    li.appendChild(ul); // 确保子节点被正确插入到文件夹的 <li> 内
  }

  return li;
}

    tree.forEach(node => fileTree.appendChild(createTreeNode(node)));
  } catch (error) {
    console.error('Error rendering file tree:', error);
  }
}

// 加载 Markdown 文件并渲染
async function loadMarkdown(filePath) {
  try {
    // 获取文件名作为备用标题
    const fileName = filePath.split('/').pop().replace('.md', '');

    // 请求 Markdown 文件内容
    const response = await fetch(`/api/article?path=${encodeURIComponent(filePath)}`);
    if (!response.ok) {
      throw new Error(`Failed to load file: ${filePath}`);
    }
    let markdown = await response.text();

    // 移除 YAML Front Matter
    markdown = markdown.replace(/^---[\s\S]*?---/, '').trim();

    // 提取 h1 标题（如果存在）
    const titleMatch = markdown.match(/^#\s+(.*)$/m);
    const title = titleMatch ? titleMatch[1].trim() : fileName;

    // 如果有 h1 标题，移除它
    if (titleMatch) {
      markdown = markdown.replace(/^#\s+.*$/m, '').trim();
    }

    // 渲染 Markdown 内容
    let renderedContent = md.render(markdown);

    // 自定义处理：取消 h2 标签内的 <br> 转义符
    renderedContent = renderedContent.replace(/<h2(.*?)>(.*?)<\/h2>/g, (match, attrs, content) => {
      const processedContent = content.replace(/&lt;br&gt;/g, '<br>');
      return `<h2${attrs}>${processedContent}</h2>`;
    });

    // 设置标题
    const titleElement = document.querySelector('#content h1');
    if (titleElement) {
      titleElement.textContent = title;
    }

    // 渲染内容
    const contentDiv = document.querySelector('#content main.note-to-mp');
    contentDiv.innerHTML = renderedContent;
  } catch (error) {
    console.error('Error loading Markdown file:', error);
  }

  //内联 CSS 并复制

  async function copyContentToClipboardWithStyle(selector = '.note-to-mp') {
  try {
    // 获取正文元素
    const contentElement = document.querySelector(selector);
    if (!contentElement) {
      throw new Error(`Selector "${selector}" not found.`);
    }

    // 获取页面中的 CSS 样式
    const stylesheets = Array.from(document.styleSheets)
      .filter(sheet => sheet.href) // 只处理外部样式表
      .map(sheet => fetch(sheet.href).then(res => res.text()));

    // 等待所有样式表加载完成
    const cssArray = await Promise.all(stylesheets);
    const combinedCss = cssArray.join('\n');

    // 使用 jsdom 和 juice 内联 CSS
    const { JSDOM } = await import('jsdom');
    const juice = (await import('juice')).default;

    const dom = new JSDOM(contentElement.outerHTML);
    const document = dom.window.document;

    // 内联 CSS
    const inlinedHtml = juice.inlineContent(document.body.innerHTML, combinedCss, {
      preserveImportant: true,
      applyStyleTags: false,
      removeStyleTags: true,
      preserveMediaQueries: true,
      preserveFontFaces: true,
      inlinePseudoElements: true,
      preserveKeyFrames: true,
      webResources: { images: false }
    });

    // 将内联后的 HTML 写入剪贴板
    await navigator.clipboard.writeText(inlinedHtml);
    alert('内容已复制到剪贴板！');
  } catch (error) {
    console.error('Error copying content:', error);
    alert('复制失败，请检查控制台错误信息。');
  }
}
}

// 初始化
renderFileTree();