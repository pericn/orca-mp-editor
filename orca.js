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

// 加载 Markdown 文件并渲染（前端渲染版）
async function loadMarkdown(content) {
  try {
    showLoading('正在加载文档...');
    // 移除 YAML front matter
    const cleanContent = content.replace(/^---[\s\S]*?---/, '').trim();
    // 提取标题
    const titleMatch = cleanContent.match(/^#\s+(.*)$/m);
    const title = titleMatch ? titleMatch[1].trim() : '未命名文档';
    // 移除标题
    const contentWithoutTitle = titleMatch
      ? cleanContent.replace(/^#\s+.*$/m, '').trim()
      : cleanContent;
    // 渲染 Markdown
    let renderedContent = md.render(contentWithoutTitle);
    // 处理 h2 标签中的换行
    renderedContent = renderedContent.replace(/<h2(.*?)>(.*?)<\/h2>/g, (match, attrs, content) => {
      const processedContent = content.replace(/&lt;br&gt;/g, '<br>');
      return `<h2${attrs}>${processedContent}</h2>`;
    });
    // 更新标题
    const titleElement = document.querySelector('.article-header h1');
    if (titleElement) {
      titleElement.textContent = title;
    }
    // 更新内容
    const contentDiv = document.querySelector('.note-to-mp');
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

// 节流 resize 事件
let resizeTimeout = null;
function throttledHandleMobileView() {
  if (resizeTimeout) clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(handleMobileView, 100);
}

// 侧边栏切换函数
export function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const logoImg = document.querySelector('img[alt="Orca Logo"]');
  const sidebarBtn = document.querySelector('.sidebar-btn');
  const sidebarBtnIcon = sidebarBtn ? sidebarBtn.querySelector('img') : null;
  const content = document.getElementById('content');

  if (content) {
    content.style.transition = 'margin 0.2s cubic-bezier(.4,0,.2,1)';
    content.style.marginInline = 'auto';
  }

  if (sidebar) {
    const isCollapsed = sidebar.classList.contains('sidebar-collapsed');
    sidebar.style.transition = 'transform 0.2s cubic-bezier(.4,0,.2,1)';
    if (isCollapsed) {
      // 展开 sidebar，恢复为 flex 子项
      sidebar.style.position = 'static';
      sidebar.style.left = '';
      sidebar.style.top = '';
      sidebar.style.height = '';
      sidebar.style.width = '320px';
      sidebar.style.zIndex = '';
      sidebar.style.transform = 'translateX(0)';
      sidebar.classList.remove('sidebar-collapsed');
    } else {
      // 收起 sidebar，脱离文档流
      sidebar.style.position = 'absolute';
      sidebar.style.left = '0';
      sidebar.style.top = '0';
      sidebar.style.height = '100%';
      sidebar.style.width = '320px';
      sidebar.style.zIndex = '20';
      sidebar.style.transform = 'translateX(-100%)';
      sidebar.classList.add('sidebar-collapsed');
    }

    // 按钮旋转
    if (sidebarBtnIcon) {
      sidebarBtnIcon.style.transition = 'transform 0.2s cubic-bezier(.4,0,.2,1)';
      sidebarBtnIcon.style.transform = !isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)';
    }

    if (sidebarBtn) {
      // 根据折叠状态调整hover偏移方向和提示文本
      sidebarBtn.style.transition = 'right 0.2s cubic-bezier(.4,0,.2,1)';
      if (!isCollapsed) {
        sidebarBtn.classList.remove('hover:right-[-8px]');
        sidebarBtn.classList.add('hover:right-[-32px]');
        const tooltip = sidebarBtn.querySelector('.group-hover\\:opacity-100');
        if (tooltip) {
          tooltip.textContent = '展开侧边栏';
        }
      } else {
        sidebarBtn.classList.remove('hover:right-[-32px]');
        sidebarBtn.classList.add('hover:right-[-8px]');
        const tooltip = sidebarBtn.querySelector('.group-hover\\:opacity-100');
        if (tooltip) {
          tooltip.textContent = '收起侧边栏';
        }
      }

    }

    // logo 缩放
    if (logoImg) {
      logoImg.style.transition = 'transform 0.2s cubic-bezier(.4,0,.2,1)';
      logoImg.style.transformOrigin = 'left top';
      logoImg.style.transform = !isCollapsed ? 'scale(0.75)' : 'scale(1)';
    }
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

// 保存文件夹句柄
async function saveDocsFolder(dirHandle) {
  try {
    // 请求持久化权限
    const permissionStatus = await dirHandle.requestPermission({ mode: 'read' });
    if (permissionStatus === 'granted') {
      // 保存文件夹句柄
      window._docsFolderHandle = dirHandle;
      return true;
    }
    return false;
  } catch (error) {
    console.error('保存文档库位置失败:', error);
    return false;
  }
}

// 检查是否有保存的文档库位置
async function checkAndRestoreDocsFolder() {
  try {
    // 显示加载提示
    showLoading('正在加载文档库...');

    // 检查是否有保存的文件夹句柄
    const dirHandle = window._docsFolderHandle;
    if (dirHandle) {
      try {
        // 验证权限
        const permissionStatus = await dirHandle.verifyPermission({ mode: 'read' });
        if (permissionStatus === 'granted') {
          await loadMarkdownFiles();
          hideWelcomePage();
          showSuccess('文档库已加载');
          return;
        }
      } catch (error) {
        console.log('验证权限时出错:', error);
      }
    }

    // 如果没有有效的句柄，显示欢迎页面
    showWelcomePage();
  } catch (error) {
    console.error('加载文档库失败:', error);
    showError('加载文档库失败，请重新选择');
    showWelcomePage();
  } finally {
    hideLoading();
  }
}

// 处理有效的目录句柄
async function handleValidDirectory(dirHandle) {
  try {
    // 验证权限
    const permissionStatus = await dirHandle.verifyPermission({ mode: 'read' });
    if (permissionStatus === 'granted') {
      window._docsFolderHandle = dirHandle;
      await loadMarkdownFiles();
      hideWelcomePage();
      showSuccess('文档库已加载');
    } else {
      throw new Error('没有足够的权限访问文档库');
    }
  } catch (error) {
    console.error('验证目录权限失败:', error);
    showError('无法访问文档库，请重新选择');
    showWelcomePage();
  }
}

// 清除文档库缓存
function clearDocsFolderCache() {
  window._docsFolderHandle = null;
}

// 显示欢迎页面
function showWelcomePage() {
  const noDocsFolder = document.getElementById('no-docs-folder');
  if (noDocsFolder) {
    noDocsFolder.style.display = 'flex';
  }
  loadWelcomePage();
}

// 选择文档库位置
async function selectDocsFolder() {
  try {
    console.log('开始选择文档库位置');
    // 使用 showDirectoryPicker API 让用户选择文件夹
    const dirHandle = await window.showDirectoryPicker({
      mode: 'read',
      startIn: 'documents'
    });

    console.log('用户选择的文件夹:', dirHandle.name);

    // 保存文件夹句柄
    const saved = await saveDocsFolder(dirHandle);
    if (saved) {
      // 显示成功提示
      showSuccess('文档库已加载');
      // 重新加载文件树
      await loadMarkdownFiles();
      hideWelcomePage();
    } else {
      showError('无法访问文档库，请重试');
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      // 用户取消了选择，不需要显示错误
      console.log('用户取消了选择');
      return;
    }
    console.error('选择文档库位置失败:', error);
    showError('选择文档库位置失败，请重试');
  }
}

// 修改 loadMarkdownFiles 函数，加载成功后隐藏选择文件夹按钮和提示
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

    // 加载成功后隐藏选择文件夹按钮和提示
    const selectBtn = document.getElementById('select-docs-folder-btn');
    if (selectBtn) selectBtn.style.display = 'none';
    const hint = document.querySelector('#sidebar-content > div');
    if (hint) hint.style.display = 'none';
  } catch (error) {
    console.error('加载文件失败:', error);
    showError('加载文件失败，请重试');
  }
}

// 递归读取目录内容
async function readDirectory(dirHandle, parentElement, relativePath = '') {
  try {
    console.log('读取目录:', {
      name: dirHandle.name,
      isRoot: relativePath === '',
      path: await getDirectoryPath(dirHandle)
    });

    const ul = document.createElement('ul');
    parentElement.appendChild(ul);

    // 获取所有条目并排序
    const entries = [];
    for await (const entry of dirHandle.values()) {
      // 处理文件名中的前导空格
      const displayName = entry.name.trim();
      const isHidden = displayName.startsWith('.');
      const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

      console.log('发现条目:', {
        originalName: entry.name,
        displayName: displayName,
        kind: entry.kind,
        isHidden: isHidden,
        path: await getEntryPath(entry)
      });

      // 只跳过隐藏文件，显示所有文件夹
      if (entry.kind === 'file' && isHidden) {
        console.log('跳过隐藏文件:', entry.name);
        continue;
      }
      entries.push(entry);
    }

    console.log('处理后的条目列表:', entries.map(e => ({
      originalName: e.name,
      displayName: e.name.trim(),
      kind: e.kind
    })));

    // 先按类型排序（文件夹在前），再按名称排序（忽略前导空格）
    entries.sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === 'directory' ? -1 : 1;
      }
      return a.name.trim().localeCompare(b.name.trim());
    });

    // 如果是根目录且只有一个文件夹，直接显示其内容
    if (relativePath === '' && entries.length === 1 && entries[0].kind === 'directory') {
      console.log('根目录只有一个文件夹，直接显示其内容:', entries[0].name.trim());
      const subDirHandle = await dirHandle.getDirectoryHandle(entries[0].name);
      await readDirectory(subDirHandle, parentElement, entries[0].name);
      return;
    }

    for (const entry of entries) {
      const li = document.createElement('li');
      const displayName = entry.name.trim();

      // 只显示真实存在的 Markdown 文件，过滤掉模板文件（如 {{YYMMDD}}.md）
      if (entry.kind === 'file' && entry.name.endsWith('.md') && !entry.name.includes('{{')) {
        // 文件节点
        const span = document.createElement('span');
        span.innerHTML = '<img src="/assets/ui/icons/nav/markdown.svg" class="tree-icon" alt="markdown">' + displayName;
        span.style.cursor = 'pointer';
        span.onclick = async () => {
          try {
            const file = await entry.getFile();
            const content = await file.text();
            loadMarkdown(content); // 直接传内容
          } catch (error) {
            console.error('读取文件失败:', error);
            showError('读取文件失败，请重试');
          }
        };
        li.appendChild(span);
        ul.appendChild(li);
      } else if (entry.kind === 'directory') {
        // 文件夹节点
        const span = document.createElement('span');
        span.innerHTML = '<img src="/assets/ui/icons/nav/folder-arrow.svg" class="tree-icon" alt="folder">' + displayName;
        span.style.cursor = 'pointer';

        // 创建子目录的容器
        const subUl = document.createElement('ul');
        subUl.style.display = 'none';

        // 点击文件夹时展开/折叠
        span.onclick = async (event) => {
          event.stopPropagation();

          const isHidden = subUl.style.display === 'none';

          // 如果是展开操作
          if (isHidden) {
            try {
              // 如果子目录还没有加载过，则加载它
              if (subUl.children.length === 0) {
                console.log('加载子目录:', displayName);
                const subDirHandle = await dirHandle.getDirectoryHandle(entry.name);
                await readDirectory(subDirHandle, subUl, entryRelativePath);
              }
              subUl.style.display = 'block';
              const icon = span.querySelector('.tree-icon');
              if (icon) {
                icon.style.transform = 'rotate(90deg)';
              }
            } catch (error) {
              console.error('读取子目录失败:', error);
              showError('读取子目录失败，请重试');
              return;
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

// 获取目录的完整路径
async function getDirectoryPath(dirHandle) {
  try {
    const path = [];
    let current = dirHandle;

    while (current) {
      path.unshift(current.name);
      current = await current.getParent();
    }

    return path.join('/');
  } catch (error) {
    return dirHandle.name;
  }
}

// 获取条目的完整路径
async function getEntryPath(entry) {
  try {
    const parent = await entry.getParent();
    const parentPath = await getDirectoryPath(parent);
    return `${parentPath}/${entry.name}`;
  } catch (error) {
    return entry.name;
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
      // 直接使用内容，而不是作为路径
      loadMarkdown(content);
    } else {
      throw new Error('Failed to load welcome page');
    }
  } catch (error) {
    console.error('加载欢迎页面失败:', error);
    showError('加载欢迎页面失败');
  }
}

// 隐藏欢迎页面
function hideWelcomePage() {
  const noDocsFolder = document.getElementById('no-docs-folder');
  if (noDocsFolder) {
    noDocsFolder.style.display = 'none';
  }
}

// Menu functionality
document.addEventListener('DOMContentLoaded', () => {
  // Toggle sidebar
  const sidebarBtn = document.querySelector('.sidebar-btn');
  const sidebar = document.getElementById('sidebar');
  const content = document.getElementById('content');

  sidebarBtn.addEventListener('click', toggleSidebar);

  // 绑定菜单按钮事件
  document.getElementById('refresh-btn').onclick = () => location.reload();
  document.getElementById('copy-to-wechat-btn').onclick = async () => {
    try {
      await copyContentToClipboardWithStyle();
      showSuccess('已复制到公众号样式');
    } catch (e) {
      showError('复制失败');
    }
  };
  document.getElementById('copy-html-btn').onclick = async () => {
    try {
      await copyRawHtml();
      showSuccess('已复制 HTML');
    } catch (e) {
      showError('复制失败');
    }
  };
  document.getElementById('select-docs-folder-menu-btn').onclick = selectDocsFolder;

  // 绑定选择文件夹按钮事件
  const selectFolderBtn = document.getElementById('select-docs-folder-btn');
  if (selectFolderBtn) {
    selectFolderBtn.addEventListener('click', async () => {
      try {
        showLoading('正在选择文档库...');
        await selectDocsFolder();
      } catch (error) {
        console.error('选择文档库失败:', error);
        showError('选择文档库失败，请重试');
      } finally {
        hideLoading();
      }
    });
  }

  // Handle mobile view
  const handleMobileView = () => {
    const sidebar = document.getElementById('sidebar');
    const content = document.getElementById('content');
    const logo = document.querySelector('img[alt="Orca Logo"]');

    if (sidebar && content) {
      if (window.innerWidth <= 768) {
        sidebar.classList.add('hidden');
        logo.style.transformOrigin = 'left top';
        logo.style.transform = 'scale(0.65)';
        logo.style.top = '0px';
        logo.style.left = '0px';
        logo.style.transition = 'transform 0.2s cubic-bezier(.4,0,.2,1)';
      } else {
        sidebar.classList.remove('hidden');
        content.style.marginInline = 'auto';
        logo.style.transform = 'scale(1)';
        logo.style.top = '13px';
        logo.style.left = '27px';
        logo.style.transition = 'transform 0.2s cubic-bezier(.4,0,.2,1)';
      }
    }
  };

  // Initial mobile view check
  handleMobileView();

  // Listen for window resize (节流)
  window.addEventListener('resize', throttledHandleMobileView);

  // 初始化加载
  checkAndRestoreDocsFolder();
});

// 初始化