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
async function loadMarkdown(content, filename = '') {
  try {
    showLoading('正在加载文档...');
    // 移除 YAML front matter
    const cleanContent = content.replace(/^---[\s\S]*?---/, '').trim();
    // 提取标题
    const titleMatch = cleanContent.match(/^#\s+(.*)$/m);
    let title = titleMatch ? titleMatch[1].trim() : '';
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
    // 如果没有 h1，用文件名（去掉 .md）作为标题
    if (!title && filename) {
      title = filename.replace(/\.md$/, '');
    }
    if (!title) {
      title = '未命名文档';
    }
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

// Toast 队列管理
let toastQueue = [];
let isShowingToast = false;
let lastToastMessage = '';
let lastToastTime = 0;

function showNextToast() {
  if (toastQueue.length === 0 || isShowingToast) {
    return;
  }

  isShowingToast = true;
  const { message, type } = toastQueue.shift();
  const toast = document.createElement('div');
  
  // 根据类型设置样式
  const bgColor = 'bg-[#FBF3E0]';
  const textColor = 'text-[#445564]';
  const fontStyle = 'font-extrabold text-[16px] leading-[1.2] tracking-[-0.05em]';
  const dotColor = type === 'error' ? 'bg-red-500' : 'bg-green-500';
  const dot = `<span class="inline-block w-[5px] h-[5px] rounded-full mr-2 ${dotColor}"></span>`;

  toast.className = `fixed top-16 right-4 ${bgColor} ${textColor} ${fontStyle} px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 transform -translate-y-full opacity-0 transition-all duration-200 ease-in-out z-50`;
  toast.innerHTML = `${dot}<span>${message}</span>`;
  
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  });

  setTimeout(() => {
    toast.style.transform = 'translateY(-100%)';
    toast.style.opacity = '0';
    setTimeout(() => {
      document.body.removeChild(toast);
      isShowingToast = false;
      showNextToast();
    }, 200);
  }, 3000);
}

function shouldShowToast(message) {
  const now = Date.now();
  // 如果消息相同且时间间隔小于 1 秒，则不显示
  if (message === lastToastMessage && now - lastToastTime < 1000) {
    return false;
  }
  lastToastMessage = message;
  lastToastTime = now;
  return true;
}

export function showError(message) {
  if (shouldShowToast(message)) {
    toastQueue.push({ message, type: 'error' });
    showNextToast();
  }
}

export function showSuccess(message) {
  if (shouldShowToast(message)) {
    toastQueue.push({ message, type: 'success' });
    showNextToast();
  }
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
    return;
  }

  try {
    const fileTree = document.getElementById('fileTree');
    fileTree.innerHTML = '';

    // 添加当前文件夹名称（固定在顶部）
    const folderName = document.createElement('div');
    folderName.className = 'text-[22px] font-black leading-[120%] tracking-[-0.05em] text-[#445564] mb-4 pl-4';
    folderName.textContent = dirHandle.name;
    fileTree.appendChild(folderName);

    // 创建文件树容器（可滚动区域）
    const treeContainer = document.createElement('div');
    treeContainer.className = 'overflow-y-auto max-h-[calc(100vh-180px)]';
    fileTree.appendChild(treeContainer);

    await readDirectory(dirHandle, treeContainer);

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
    const ul = document.createElement('ul');
    ul.className = 'list-none p-0 m-0';
    parentElement.appendChild(ul);

    const entries = [];
    for await (const entry of dirHandle.values()) {
      const displayName = entry.name.trim();
      const isHidden = displayName.startsWith('.');
      
      // 跳过隐藏文件和空文件夹
      if (isHidden) {
        continue;
      }

      // 如果是文件夹，检查是否为空或是否包含 md 文件
      if (entry.kind === 'directory') {
        let hasMdFile = false;
        for await (const subEntry of entry.values()) {
          if (subEntry.kind === 'file' && subEntry.name.endsWith('.md') && !subEntry.name.includes('{{')) {
            hasMdFile = true;
            break;
          }
        }
        if (!hasMdFile) {
          continue;
        }
      }

      entries.push(entry);
    }

    entries.sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === 'directory' ? -1 : 1;
      }
      return a.name.trim().localeCompare(b.name.trim());
    });

    if (relativePath === '' && entries.length === 1 && entries[0].kind === 'directory') {
      const subDirHandle = await dirHandle.getDirectoryHandle(entries[0].name);
      await readDirectory(subDirHandle, parentElement, entries[0].name);
      return;
    }

    for (const entry of entries) {
      const li = document.createElement('li');
      li.className = 'my-1';
      const displayName = entry.name.trim();

      if (entry.kind === 'file' && entry.name.endsWith('.md') && !entry.name.includes('{{')) {
        const span = document.createElement('span');
        span.className = 'flex items-center text-sm font-bold text-[#445564] py-1 cursor-pointer hover:bg-[#f5f7fa]';
        // 移除 .md 后缀
        const displayNameWithoutExt = displayName.replace(/\.md$/, '');
        span.innerHTML = `
          <img src="/assets/ui/icons/nav/folder-arrow.svg" class="w-[3px] h-auto mr-2 flex-shrink-0" alt="markdown">
          <span>${displayNameWithoutExt}</span>
        `;
        span.onclick = async () => {
          try {
            const file = await entry.getFile();
            const content = await file.text();
            loadMarkdown(content, displayName);
          } catch (error) {
            console.error('读取文件失败:', error);
            showError('读取文件失败，请重试');
          }
        };
        li.appendChild(span);
        ul.appendChild(li);
      } else if (entry.kind === 'directory') {
        const span = document.createElement('span');
        span.className = 'flex items-center text-sm font-bold text-[#445564] py-1 cursor-pointer hover:bg-[#f5f7fa]';
        span.innerHTML = `
          <img src="/assets/ui/icons/nav/folder-arrow.svg" class="w-[10px] h-auto mr-2 flex-shrink-0 transition-transform duration-200" alt="folder">
          <span>${displayName}</span>
        `;

        const subUl = document.createElement('ul');
        subUl.className = 'list-none p-0 m-0 ml-3 hidden';

        span.onclick = async (event) => {
          event.stopPropagation();
          const isHidden = subUl.classList.contains('hidden');

          if (isHidden) {
            try {
              if (subUl.children.length === 0) {
                const subDirHandle = await dirHandle.getDirectoryHandle(entry.name);
                const newRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
                await readDirectory(subDirHandle, subUl, newRelativePath);
              }
              subUl.classList.remove('hidden');
              const icon = span.querySelector('img');
              if (icon) {
                icon.style.transform = 'rotate(90deg)';
              }
            } catch (error) {
              console.error('读取子目录失败:', error);
              showError('读取子目录失败，请重试');
              return;
            }
          } else {
            subUl.classList.add('hidden');
            const icon = span.querySelector('img');
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
// 初始化