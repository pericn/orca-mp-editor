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

// 加载 Markdown 文件并渲染
async function loadMarkdown(content) {
  try {
    showLoading('正在加载文档...');
    
    // 移除 YAML front matter
    content = content.replace(/^---[\s\S]*?---/, '').trim();

    // 提取标题
    const titleMatch = content.match(/^#\s+(.*)$/m);
    const title = titleMatch ? titleMatch[1].trim() : '未命名文档';

    // 移除标题
    if (titleMatch) {
      content = content.replace(/^#\s+.*$/m, '').trim();
    }

    // 渲染 Markdown
    let renderedContent = md.render(content);
    
    // 处理 h2 标签中的换行
    renderedContent = renderedContent.replace(/<h2(.*?)>(.*?)<\/h2>/g, (match, attrs, content) => {
      const processedContent = content.replace(/&lt;br&gt;/g, '<br>');
      return `<h2${attrs}>${processedContent}</h2>`;
    });

    // 更新标题
    const titleElement = document.querySelector('#content h1');
    if (titleElement) {
      titleElement.textContent = title;
    }

    // 更新内容
    const contentDiv = document.querySelector('#content main.note-to-mp');
    if (contentDiv) {
      contentDiv.innerHTML = renderedContent;
    }
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
  const toast = document.createElement('div');
  toast.className = 'toast error';
  toast.innerHTML = `
    <div class="status-dot"></div>
    <div class="message">${message}</div>
  `;
  document.body.appendChild(toast);
  
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        document.body.removeChild(toast);
      }
    }, 300);
  }, 3000);
}

export function showSuccess(message) {
  const toast = document.createElement('div');
  toast.className = 'toast success';
  toast.innerHTML = `
    <div class="status-dot"></div>
    <div class="message">${message}</div>
  `;
  document.body.appendChild(toast);
  
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
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

// 文档库路径存储键名
const DOCS_FOLDER_KEY = 'orca_docs_folder';

// 保存文件夹句柄
async function saveDocsFolder(dirHandle) {
  try {
    // 请求持久化权限
    const permissionStatus = await dirHandle.requestPermission({ mode: 'read' });
    if (permissionStatus === 'granted') {
      // 保存文件夹句柄
      window._docsFolderHandle = dirHandle;
      // 保存文件夹名称到 localStorage
      localStorage.setItem(DOCS_FOLDER_KEY, dirHandle.name);
      return true;
    }
    return false;
  } catch (error) {
    console.error('保存文档库位置失败:', error);
    return false;
  }
}

// 获取保存的文件夹句柄
function getDocsFolder() {
  return window._docsFolderHandle;
}

// 加载默认欢迎页面
async function loadWelcomePage() {
  try {
    const response = await fetch('/assets/docs/welcome.md');
    if (response.ok) {
      const content = await response.text();
      loadMarkdown(content);
    } else {
      throw new Error('Failed to load welcome page');
    }
  } catch (error) {
    console.error('加载欢迎页面失败:', error);
    showError('加载欢迎页面失败');
  }
}

// 选择文档库位置
async function selectDocsFolder() {
  try {
    // 使用 showDirectoryPicker API 让用户选择文件夹
    const dirHandle = await window.showDirectoryPicker({
      mode: 'read',
      startIn: 'documents'
    });
    
    // 保存文件夹句柄
    const saved = await saveDocsFolder(dirHandle);
    if (saved) {
      // 显示成功提示
      showSuccess('文档库位置已更新');
      // 重新加载文件树
      await loadMarkdownFiles();
    } else {
      showError('保存文档库位置失败，请重试');
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      // 用户取消了选择，不需要显示错误
      return;
    }
    console.error('选择文档库位置失败:', error);
    showError('选择文档库位置失败，请重试');
  }
}

// 修改 loadMarkdownFiles 函数，使用保存的文档库路径
async function loadMarkdownFiles() {
  const dirHandle = getDocsFolder();
  if (!dirHandle) {
    // 如果没有选择文档库，静默返回，不显示错误
    return;
  }
  
  try {
    // 清空文件树
    const fileTree = document.getElementById('fileTree');
    fileTree.innerHTML = '';
    
    // 递归读取文件夹内容
    await readDirectory(dirHandle, fileTree);
  } catch (error) {
    console.error('加载文件失败:', error);
    showError('加载文件失败，请重试');
  }
}

// 递归读取目录内容
async function readDirectory(dirHandle, parentElement) {
  try {
    const ul = document.createElement('ul');
    parentElement.appendChild(ul);

    // 获取所有条目并排序
    const entries = [];
    for await (const entry of dirHandle.values()) {
      entries.push(entry);
    }
    
    // 先按类型排序（文件夹在前），再按名称排序
    entries.sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    for (const entry of entries) {
      const li = document.createElement('li');
      
      if (entry.kind === 'file' && entry.name.endsWith('.md')) {
        // 文件节点
        const span = document.createElement('span');
        span.innerHTML = '<img src="/assets/ui/icons/nav/markdown.svg" class="tree-icon" alt="markdown">' + entry.name;
        span.style.cursor = 'pointer';
        span.onclick = async () => {
          try {
            const file = await entry.getFile();
            const content = await file.text();
            loadMarkdown(content);
          } catch (error) {
            console.error('读取文件失败:', error);
            showError('读取文件失败，请重试');
          }
        };
        li.appendChild(span);
      } else if (entry.kind === 'directory') {
        // 文件夹节点
        const span = document.createElement('span');
        span.innerHTML = '<img src="/assets/ui/icons/nav/folder-arrow.svg" class="tree-icon" alt="folder">' + entry.name;
        span.style.cursor = 'pointer';
        
        // 创建子目录的容器
        const subUl = document.createElement('ul');
        subUl.style.display = 'none';
        
        // 标记是否已加载子目录
        let isLoaded = false;
        
        // 点击文件夹时展开/折叠
        span.onclick = async (event) => {
          event.stopPropagation();
          
          const isHidden = subUl.style.display === 'none';
          
          // 如果是展开操作且未加载过子目录
          if (isHidden && !isLoaded) {
            try {
              const subDirHandle = await dirHandle.getDirectoryHandle(entry.name);
              // 加载子目录内容到 subUl
              await readDirectory(subDirHandle, subUl);
              isLoaded = true;
            } catch (error) {
              console.error('读取子目录失败:', error);
              showError('读取子目录失败，请重试');
              return;
            }
          }
          
          // 切换显示状态
          if (isHidden) {
            subUl.style.display = 'block';
            const icon = span.querySelector('.tree-icon');
            if (icon) {
              icon.style.transform = 'rotate(90deg)';
            }
          } else {
            subUl.style.display = 'none';
            const icon = span.querySelector('.tree-icon');
            if (icon) {
              icon.style.transform = 'rotate(0deg)';
            }
          }
        };
        
        li.appendChild(span);
        li.appendChild(subUl);
      }
      
      ul.appendChild(li);
    }
  } catch (error) {
    console.error('读取目录失败:', error);
    showError('读取目录失败，请重试');
  }
}

// 初始化事件监听器
document.addEventListener('DOMContentLoaded', async () => {
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

  // 选择文档库位置按钮（菜单中的）
  const selectDocsFolderBtn = document.getElementById('select-docs-folder');
  if (selectDocsFolderBtn) {
    selectDocsFolderBtn.addEventListener('click', selectDocsFolder);
  }

  // 选择文档库位置按钮（引导按钮）
  const selectDocsFolderGuideBtn = document.getElementById('select-docs-folder-btn');
  if (selectDocsFolderGuideBtn) {
    selectDocsFolderGuideBtn.addEventListener('click', () => {
      console.log('选择本地文档库按钮被点击');
      selectDocsFolder();
    });
  }
  
  // 检查是否有保存的文档库位置
  const savedFolderName = localStorage.getItem(DOCS_FOLDER_KEY);
  if (savedFolderName) {
    try {
      // 尝试恢复上次的文档库位置
      const dirHandle = await window.showDirectoryPicker({
        mode: 'read',
        startIn: 'documents'
      });
      
      if (dirHandle.name === savedFolderName) {
        window._docsFolderHandle = dirHandle;
        await loadMarkdownFiles();
        // 隐藏引导按钮
        const noDocsFolder = document.getElementById('no-docs-folder');
        if (noDocsFolder) {
          noDocsFolder.style.display = 'none';
        }
      } else {
        // 如果用户选择了不同的文件夹，显示引导按钮
        const noDocsFolder = document.getElementById('no-docs-folder');
        if (noDocsFolder) {
          noDocsFolder.style.display = 'flex';
        }
        await loadWelcomePage();
      }
    } catch (error) {
      // 静默处理错误，不显示错误提示
      console.error('恢复文档库位置失败:', error);
      // 显示引导按钮
      const noDocsFolder = document.getElementById('no-docs-folder');
      if (noDocsFolder) {
        noDocsFolder.style.display = 'flex';
      }
      await loadWelcomePage();
    }
  } else {
    // 如果没有保存的位置，直接显示欢迎页面
    const noDocsFolder = document.getElementById('no-docs-folder');
    if (noDocsFolder) {
      noDocsFolder.style.display = 'flex';
    }
    await loadWelcomePage();
  }
});

// 初始化