import { copyContentToClipboardWithStyle } from './copyToWeChat.js';

// 初始化 markdown-it
let md;
try {
  md = new markdownit();
  md.use(markdownitMark);
} catch (error) {
  console.error('初始化 Markdown 解析器失败:', error);
  showError('初始化编辑器失败，请刷新页面重试');
}

// 自定义图片渲染规则，添加 figcaption
md.renderer.rules.image = (tokens, idx) => {
  try {
    const token = tokens[idx];
    const src = token.attrGet('src');
    const alt = token.content || '';
    const figcaption = alt ? `<figcaption>${alt}</figcaption>` : '';
    return `<figure><img src="${src}" alt="${alt}" onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'24\\' height=\\'24\\' viewBox=\\'0 0 24 24\\'%3E%3Cpath fill=\\'%23ccc\\' d=\\'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.9 13.98l2.1 2.53 3.1-3.99c.2-.26.6-.26.8.01l3.51 4.68a.5.5 0 0 1-.4.8H6.02c-.42 0-.65-.48-.39-.81L8.12 14c.19-.26.57-.27.78-.02z\'/%3E%3C/svg%3E'">${figcaption}</figure>`;
  } catch (error) {
    console.error('渲染图片时出错:', error);
    return `<div class="error-placeholder">图片加载失败</div>`;
  }
};

// 创建树节点
function createTreeNode(node) {
  try {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = node.name;

    if (node.type === 'file') {
      span.style.cursor = 'pointer';
      span.innerHTML = '<img src="/assets/ui/icons/nav/markdown.svg" class="tree-icon" alt="markdown">' + node.name;
      span.onclick = () => loadMarkdown(node.path);
      li.appendChild(span);
    } else if (node.type === 'directory') {
      span.innerHTML = '<img src="/assets/ui/icons/nav/folder-arrow.svg" class="tree-icon" alt="folder">' + node.name;
      span.style.cursor = 'pointer';
      span.onclick = () => {
        try {
          const ul = li.querySelector('ul');
          if (ul) {
            const isHidden = ul.style.display === 'none';
            ul.style.display = isHidden ? 'block' : 'none';
            const icon = span.querySelector('.tree-icon');
            if (icon) {
              icon.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
            }
          }
        } catch (error) {
          console.error('切换目录显示状态时出错:', error);
        }
      };

      const ul = document.createElement('ul');
      ul.style.display = 'none';

      if (node.children && node.children.length > 0) {
        node.children
          .sort((a, b) => {
            // 目录排在文件前面
            if (a.type !== b.type) {
              return a.type === 'directory' ? -1 : 1;
            }
            // 同类型按名称排序
            return a.name.localeCompare(b.name);
          })
          .forEach(child => ul.appendChild(createTreeNode(child)));
      } else {
        const emptyMessage = document.createElement('li');
        emptyMessage.textContent = '（空文件夹）';
        emptyMessage.className = 'empty-folder';
        ul.appendChild(emptyMessage);
      }

      li.appendChild(span);
      li.appendChild(ul);
    }

    return li;
  } catch (error) {
    console.error('创建树节点时出错:', error);
    const errorNode = document.createElement('li');
    errorNode.className = 'error-node';
    errorNode.textContent = '加载失败';
    return errorNode;
  }
}

// 渲染目录树
async function renderFileTree() {
  try {
    showLoading('正在加载文件列表...');
    const response = await fetch('/api/articles');
    const tree = await response.json();
    const fileTree = document.getElementById('fileTree');
    fileTree.innerHTML = '';

    // 如果只有一个文件夹，直接展开其内容
    if (tree.length === 1 && tree[0].type === 'directory') {
      const singleFolder = tree[0];
      singleFolder.children
        .sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        })
        .forEach(child => fileTree.appendChild(createTreeNode(child)));
    } else {
      tree.forEach(node => fileTree.appendChild(createTreeNode(node)));
    }
  } catch (error) {
    console.error('渲染文件树时出错:', error);
    showError('加载文件列表失败，请刷新页面重试');
  } finally {
    hideLoading();
  }
}

// 加载 Markdown 文件并渲染
async function loadMarkdown(filePath) {
  try {
    showLoading('正在加载文档...');
    const fileName = filePath.split('/').pop().replace('.md', '');
    const response = await fetch(`/api/article?path=${encodeURIComponent(filePath)}`);
    
    if (!response.ok) {
      throw new Error(`加载文件失败: ${filePath}`);
    }
    
    let markdown = await response.text();
    markdown = markdown.replace(/^---[\s\S]*?---/, '').trim();

    const titleMatch = markdown.match(/^#\s+(.*)$/m);
    const title = titleMatch ? titleMatch[1].trim() : fileName;

    if (titleMatch) {
      markdown = markdown.replace(/^#\s+.*$/m, '').trim();
    }

    let renderedContent = md.render(markdown);
    renderedContent = renderedContent.replace(/<h2(.*?)>(.*?)<\/h2>/g, (match, attrs, content) => {
      const processedContent = content.replace(/&lt;br&gt;/g, '<br>');
      return `<h2${attrs}>${processedContent}</h2>`;
    });

    const titleElement = document.querySelector('#content h1');
    if (titleElement) {
      titleElement.textContent = title;
    }

    const contentDiv = document.querySelector('#content main.note-to-mp');
    contentDiv.innerHTML = renderedContent;
  } catch (error) {
    console.error('加载 Markdown 文件时出错:', error);
    showError('加载文档失败，请重试');
  } finally {
    hideLoading();
  }
}

// 侧边栏切换函数
export function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const content = document.getElementById('content');
  if (sidebar && content) {
    sidebar.classList.toggle('hidden');
    content.classList.toggle('expanded');
  }
}

// UI 状态管理
export function showLoading(message = '加载中...') {
  const loading = document.getElementById('loading') || createLoadingElement();
  loading.textContent = message;
  loading.style.display = 'block';
}

export function hideLoading() {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.style.display = 'none';
  }
}

export function showError(message) {
  console.log('Showing error toast:', message);
  const toast = document.createElement('div');
  toast.className = 'toast error';
  toast.innerHTML = `
    <div class="status-dot"></div>
    <div class="message">${message}</div>
  `;
  document.body.appendChild(toast);
  console.log('Toast element created:', toast);
  
  // 强制重排以启动动画
  requestAnimationFrame(() => {
    console.log('Adding show class to toast');
    toast.classList.add('show');
  });
  
  setTimeout(() => {
    console.log('Removing show class from toast');
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        console.log('Removing toast element from DOM');
        document.body.removeChild(toast);
      }
    }, 300);
  }, 3000);
}

export function showSuccess(message) {
  console.log('Showing success toast:', message);
  const toast = document.createElement('div');
  toast.className = 'toast success';
  toast.innerHTML = `
    <div class="status-dot"></div>
    <div class="message">${message}</div>
  `;
  document.body.appendChild(toast);
  console.log('Toast element created:', toast);
  
  // 强制重排以启动动画
  requestAnimationFrame(() => {
    console.log('Adding show class to toast');
    toast.classList.add('show');
  });
  
  setTimeout(() => {
    console.log('Removing show class from toast');
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        console.log('Removing toast element from DOM');
        document.body.removeChild(toast);
      }
    }, 300);
  }, 3000);
}

function createLoadingElement() {
  const loading = document.createElement('div');
  loading.id = 'loading';
  loading.className = 'loading-indicator';
  document.body.appendChild(loading);
  return loading;
}

// 初始化事件监听器
document.addEventListener('DOMContentLoaded', () => {
  // 侧边栏切换按钮
  const toggleSidebarBtn = document.querySelector('.toggle-sidebar-btn');
  const sidebar = document.getElementById('sidebar');
  const content = document.getElementById('content');
  
  if (toggleSidebarBtn && sidebar && content) {
    toggleSidebarBtn.addEventListener('click', () => {
      sidebar.classList.toggle('hidden');
      content.classList.toggle('expanded');
    });
  }

  // 刷新按钮
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      location.reload();
    });
  }
});

// 初始化
renderFileTree();