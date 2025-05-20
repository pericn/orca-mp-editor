import { copyContentToClipboardWithStyle } from './copyToWeChat.js';
import { showSuccess, showError, showLoading, hideLoading } from './utils.js';

// 初始化 markdown-it
let md;
try {
  md = new markdownit();
  md.use(markdownitMark);
} catch (error) {
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
    return `<div class="error-placeholder">图片加载失败</div>`;
  }
};

// 更新父级容器的高度
function updateParentHeights(element) {
  let current = element;
  while (current) {
    const parentWrapper = current.closest('div[class*="overflow-hidden"]');
    if (!parentWrapper || !parentWrapper.querySelector('ul')) break;
    
    // 立即更新父级容器高度
    const ul = parentWrapper.querySelector('ul');
    parentWrapper.style.height = `auto`;
    
    current = parentWrapper.parentElement;
  }
}

// 更新文件树容器高度
function updateFileTreeHeight() {
  const fileTree = document.getElementById('fileTree');
  const treeContainer = fileTree.querySelector('div.overflow-y-auto');
  if (treeContainer) {
    const rootUl = treeContainer.querySelector('ul');
    if (rootUl) {
      treeContainer.style.height = `auto`;
    }
  }
}

// 创建树节点
function createTreeNode(node) {
  try {
    const li = document.createElement('li');
    li.className = 'my-1';
    const span = document.createElement('span');
    span.className = 'flex items-center text-sm font-bold text-[#445564] py-1 cursor-pointer hover:bg-[#f5f7fa] group';

    if (node.type === 'file') {
      span.innerHTML = `
        <img src="/assets/icons/filetreeArrow.svg" style="width:3px;height:3px;" class="mr-2 flex-shrink-0" alt="file">
        <span>${node.name}</span>
      `;
      span.onclick = () => loadMarkdown(node.path);
      li.appendChild(span);
    } else if (node.type === 'directory') {
      span.dataset.state = 'collapsed';
      span.innerHTML = `
        <img src="/assets/icons/filetreeArrow.svg" style="width:10px;height:10px;" class="mr-2 flex-shrink-0 transition-transform duration-400 ease-[cubic-bezier(0.4,0,0.2,1)] group-data-[state=expanded]:rotate-90" alt="folder">
        <span>${node.name}</span>
      `;
      
      // 创建内容容器
      const wrapper = document.createElement('div');
      wrapper.className = 'grid transition-[grid-template-rows] duration-400 ease-[cubic-bezier(0.4,0,0.2,1)]';
      wrapper.dataset.state = 'collapsed';
      wrapper.style.gridTemplateRows = '0fr';

      const inner = document.createElement('div');
      inner.className = 'overflow-hidden';
      wrapper.appendChild(inner);

      const subUl = document.createElement('ul');
      subUl.className = 'list-none p-0 m-0 ml-3';
      inner.appendChild(subUl);

      span.onclick = async (event) => {
        try {
          event.stopPropagation();
          const isCollapsed = span.dataset.state === 'collapsed';
          
          if (isCollapsed) {
            // 如果子目录还没有加载，先加载内容
            if (subUl.children.length === 0) {
              if (node.children && node.children.length > 0) {
                node.children
                  .sort((a, b) => {
                    if (a.type !== b.type) {
                      return a.type === 'directory' ? -1 : 1;
                    }
                    return a.name.localeCompare(b.name);
                  })
                  .forEach(child => subUl.appendChild(createTreeNode(child)));
              } else {
                const emptyMessage = document.createElement('li');
                emptyMessage.textContent = '（空文件夹）';
                emptyMessage.className = 'italic text-[#9ca3af] text-sm py-1 px-2';
                subUl.appendChild(emptyMessage);
              }
            }
            
            // 展开动画
            span.dataset.state = 'expanded';
            wrapper.dataset.state = 'expanded';
            wrapper.style.gridTemplateRows = '1fr';
          } else {
            // 收起动画
            span.dataset.state = 'collapsed';
            wrapper.dataset.state = 'collapsed';
            wrapper.style.gridTemplateRows = '0fr';
          }
        } catch (error) {
        }
      };

      li.appendChild(span);
      li.appendChild(wrapper);
    }

    return li;
  } catch (error) {
    const errorNode = document.createElement('li');
    errorNode.className = 'error-node';
    errorNode.textContent = '加载失败';
    return errorNode;
  }
}

// 加载 Markdown 文件并渲染
export async function loadMarkdown(content, filename = '') {
  try {
    showLoading('正在加载文档...');
    
    let markdownContent = content;
    
    // 如果传入的是字符串路径，则从该路径加载内容
    if (typeof content === 'string' && content.startsWith('/')) {
      // 如果是欢迎页面，使用 fetch
      if (content === '/assets/docs/welcome.md') {
        const response = await fetch(content);
        if (!response.ok) {
          throw new Error(`加载文件失败: ${response.status}`);
        }
        markdownContent = await response.text();
      }
    }
    
    // 确保 markdown-it 实例已正确初始化
    if (!md) {
      md = new markdownit();
      md.use(markdownitMark);
    }
    
    // 移除 YAML front matter
    const cleanContent = markdownContent.replace(/^---[\s\S]*?---/, '').trim();
    
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
    showError('加载文档失败，请重试');
    
    // 如果加载失败，显示默认内容
    const contentDiv = document.querySelector('.note-to-mp');
    if (contentDiv) {
      contentDiv.innerHTML = `
        <h1>加载失败</h1>
        <p>文档加载失败，请重试。</p>
        <p>错误信息：${error.message}</p>
      `;
    }
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
  const sidebarBtn = document.getElementById('sidebar-btn');
  const logo = document.getElementById('logo');
  const workspace = document.getElementById('workspace');

  if (!sidebar || !sidebarBtn || !logo || !workspace) {
    return;
  }

  const isCollapsed = sidebar.dataset.state === 'collapsed';
  
  // 使用 requestAnimationFrame 确保动画流畅
  requestAnimationFrame(() => {
    if (isCollapsed) {
      // 展开侧边栏
      sidebar.dataset.state = 'expanded';
      sidebarBtn.dataset.state = 'expanded';
      logo.classList.remove('scale-75');
      logo.classList.remove('top-[6px]');
      logo.classList.add('top-[13px]');
    } else {
      // 收起侧边栏
      sidebar.dataset.state = 'collapsed';
      sidebarBtn.dataset.state = 'collapsed';
      logo.classList.add('scale-75');
      logo.classList.add('top-[6px]');
      logo.classList.remove('top-[13px]');
    }
  });

  // 保存侧边栏状态到 localStorage
  localStorage.setItem('sidebarCollapsed', !isCollapsed);
}

// 初始化侧边栏状态
export function initSidebarState() {
  const sidebar = document.getElementById('sidebar');
  const sidebarBtn = document.getElementById('sidebar-btn');
  const logo = document.getElementById('logo');
  const workspace = document.getElementById('workspace');

  if (!sidebar || !sidebarBtn || !logo || !workspace) {
    return;
  }

  // 从 localStorage 读取状态
  const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
  
  // 设置初始状态
  requestAnimationFrame(() => {
    if (isCollapsed) {
      sidebar.dataset.state = 'collapsed';
      sidebarBtn.dataset.state = 'collapsed';
      logo.classList.add('scale-75');
    } else {
      sidebar.dataset.state = 'expanded';
      sidebarBtn.dataset.state = 'expanded';
      logo.classList.remove('scale-75');
    }
  });
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
    return false;
  }
}

// 检查是否有保存的文档库位置
export async function checkAndRestoreDocsFolder() {
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
      }
    }

    // 如果没有有效的句柄，显示欢迎页面
    showWelcomePage();
  } catch (error) {
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
    showError('无法访问文档库，请重新选择');
    showWelcomePage();
  }
}

// 清除文档库缓存
function clearDocsFolderCache() {
  window._docsFolderHandle = null;
}

// 显示欢迎页面
export function showWelcomePage() {
  const fileTree = document.getElementById('fileTree');
  const noDocsFolder = document.getElementById('no-docs-folder');
  const selectBtn = document.getElementById('select-docs-folder-btn');
  const sidebarContent = document.getElementById('sidebar-content');

  if (fileTree) {
    fileTree.classList.add('hidden');
    fileTree.classList.remove('flex', 'flex-col', 'w-full');
  }
  if (noDocsFolder) {
    noDocsFolder.style.display = 'block';
  }
  if (selectBtn) {
    selectBtn.style.display = 'flex';
  }
  if (sidebarContent) {
    sidebarContent.classList.add('justify-end');
  }
  
  // 使用统一的 loadMarkdown 函数加载欢迎页面
  loadMarkdown('/assets/docs/welcome.md', 'welcome.md');
}

// 选择文档库位置
export async function selectDocsFolder() {
  try {
    // 检查浏览器是否支持 showDirectoryPicker API
    if ('showDirectoryPicker' in window) {
      // Chrome 等支持 showDirectoryPicker 的浏览器
      const dirHandle = await window.showDirectoryPicker({
        mode: 'read',
        startIn: 'documents'
      });
      
      // 保存文件夹句柄
      const saved = await saveDocsFolder(dirHandle);
      if (saved) {
        showSuccess('文档库已加载');
        await loadMarkdownFiles();
        hideWelcomePage();
      } else {
        showError('无法访问文档库，请重试');
      }
    } else {
      // Safari 等不支持 showDirectoryPicker 的浏览器
      showError('抱歉，您的浏览器暂不支持文件夹选择功能，建议使用 Chrome 浏览器。');
      
      // 可以考虑添加一个提示，引导用户使用 Chrome
      const contentDiv = document.querySelector('.note-to-mp');
      if (contentDiv) {
        contentDiv.innerHTML = `
          <div class="browser-compatibility-notice" style="padding: 20px; background: #fff5f5; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #e53e3e; margin-bottom: 10px;">浏览器兼容性提示</h2>
            <p>当前功能需要使用支持文件系统访问 API 的浏览器。</p>
            <p style="margin-top: 10px;">推荐使用以下浏览器：</p>
            <ul style="margin-top: 10px; padding-left: 20px;">
              <li>Chrome 86 或更高版本</li>
              <li>Edge 86 或更高版本</li>
              <li>Opera 72 或更高版本</li>
            </ul>
            <p style="margin-top: 10px;">
              <a href="https://www.google.com/chrome/" target="_blank" style="color: #3182ce; text-decoration: underline;">
                下载 Chrome 浏览器
              </a>
            </p>
          </div>
        `;
      }
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      return;
    }
    showError('选择文档库位置失败，请重试');
  }
}

// 修改 loadMarkdownFiles 函数，加载成功后隐藏选择文件夹按钮和提示
export async function loadMarkdownFiles() {
  const dirHandle = getDocsFolder();
  if (!dirHandle) {
    return;
  }

  try {
    const fileTree = document.getElementById('fileTree');
    const noDocsFolder = document.getElementById('no-docs-folder');
    const selectBtn = document.getElementById('select-docs-folder-btn');
    const sidebarContent = document.getElementById('sidebar-content');

    // 隐藏欢迎内容，显示文件树
    if (noDocsFolder) noDocsFolder.style.display = 'none';
    if (selectBtn) selectBtn.style.display = 'none';
    if (fileTree) {
      fileTree.classList.remove('hidden');
      fileTree.classList.add('flex', 'flex-col', 'w-full');
      sidebarContent.classList.remove('justify-end');
    }

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
  } catch (error) {
    showError('加载文件失败，请重试');
  }
}

// 递归检查目录是否包含 markdown 文件
async function hasMarkdownInDirectory(dirHandle) {
  try {
    for await (const entry of dirHandle.values()) {
      // 跳过隐藏文件
      if (entry.name.startsWith('.')) {
        continue;
      }

      if (entry.kind === 'file') {
        // 检查是否为有效的 markdown 文件
        if (entry.name.endsWith('.md') && !entry.name.includes('{{')) {
          return true;
        }
      } else if (entry.kind === 'directory') {
        // 递归检查子目录
        const hasMarkdown = await hasMarkdownInDirectory(entry);
        if (hasMarkdown) {
          return true;
        }
      }
    }
    return false;
  } catch (error) {
    return false;
  }
}

// 递归读取目录内容
async function readDirectory(dirHandle, parentElement, relativePath = '') {
  try {
    const ul = document.createElement('ul');
    ul.classList.add('list-none', 'p-0', 'm-0');
    parentElement.appendChild(ul);

    const entries = [];
    for await (const entry of dirHandle.values()) {
      const displayName = entry.name.trim();
      const isHidden = displayName.startsWith('.');
      
      // 跳过隐藏文件
      if (isHidden) {
        continue;
      }

      // 如果是文件夹，检查是否包含 md 文件（包括子目录）
      if (entry.kind === 'directory') {
        const containsMarkdown = await hasMarkdownInDirectory(entry);
        if (!containsMarkdown) {
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

    for (const entry of entries) {
      const li = document.createElement('li');
      li.classList.add('my-1');
      const displayName = entry.name.trim();

      if (entry.kind === 'file' && entry.name.endsWith('.md') && !entry.name.includes('{{')) {
        const span = document.createElement('span');
        span.className = 'flex items-center text-sm font-bold text-[#445564] py-1 cursor-pointer hover:bg-[#f5f7fa] group';
        // 移除 .md 后缀
        const displayNameWithoutExt = displayName.replace(/\.md$/, '');
        span.innerHTML = `
          <img src="/assets/icons/filetreeArrow.svg" style="width:3px;height:3px;" class="mr-2 flex-shrink-0" alt="file">
          <span>${displayNameWithoutExt}</span>
        `;
        span.onclick = async () => {
          try {
            const file = await entry.getFile();
            const content = await file.text();
            loadMarkdown(content, displayName);
          } catch (error) {
            showError('读取文件失败，请重试');
          }
        };
        li.appendChild(span);
        ul.appendChild(li);
      } else if (entry.kind === 'directory') {
        const span = document.createElement('span');
        span.dataset.state = 'collapsed';
        span.className = 'flex items-center text-sm font-bold text-[#445564] py-1 cursor-pointer hover:bg-[#f5f7fa] group';
        span.innerHTML = `
          <img src="/assets/icons/filetreeArrow.svg" style="width:10px;height:10px;" class="mr-2 flex-shrink-0 transition-transform duration-400 ease-[cubic-bezier(0.4,0,0.2,1)] group-data-[state=expanded]:rotate-90" alt="folder">
          <span>${displayName}</span>
        `;

              // 创建内容容器
      const wrapper = document.createElement('div');
      wrapper.className = 'grid transition-[grid-template-rows] duration-400 ease-[cubic-bezier(0.4,0,0.2,1)]';
      wrapper.dataset.state = 'collapsed';
      wrapper.style.gridTemplateRows = '0fr';

        const inner = document.createElement('div');
        inner.className = 'overflow-hidden';
        wrapper.appendChild(inner);

        const subUl = document.createElement('ul');
        subUl.className = 'list-none p-0 m-0 ml-3';
        inner.appendChild(subUl);

        span.onclick = async (event) => {
          event.stopPropagation();
          const isCollapsed = span.dataset.state === 'collapsed';

          if (isCollapsed) {
            try {
              if (subUl.children.length === 0) {
                const subDirHandle = await dirHandle.getDirectoryHandle(entry.name);
                const newRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
                await readDirectory(subDirHandle, subUl, newRelativePath);
              }
              
                          // 展开动画
            span.dataset.state = 'expanded';
            wrapper.dataset.state = 'expanded';
            wrapper.style.gridTemplateRows = '1fr';
            } catch (error) {
              showError('读取子目录失败，请重试');
              return;
            }
          } else {
            // 收起动画
            span.dataset.state = 'collapsed';
            wrapper.dataset.state = 'collapsed';
            wrapper.style.gridTemplateRows = '0fr';
          }
        };

        li.appendChild(span);
        li.appendChild(wrapper);
        ul.appendChild(li);
      }
    }
  } catch (error) {
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

// 隐藏欢迎页面
function hideWelcomePage() {
  const noDocsFolder = document.getElementById('no-docs-folder');
  const selectBtn = document.getElementById('select-docs-folder-btn');
  if (noDocsFolder) {
    noDocsFolder.style.display = 'none';
  }
  if (selectBtn) {
    selectBtn.style.display = 'none';
  }
}

// Menu functionality
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 初始化侧边栏状态
    initSidebarState();
    
    // 确保 markdown-it 已加载
    if (typeof markdownit === 'undefined') {
      throw new Error('markdown-it 未正确加载');
    }
    
    // Toggle sidebar
    const sidebarBtn = document.getElementById('sidebar-btn');
    if (sidebarBtn) {
      sidebarBtn.addEventListener('click', toggleSidebar);
    }

    // 绑定菜单按钮事件
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.onclick = () => location.reload();
    }

    const copyToWechatBtn = document.getElementById('copy-to-wechat-btn');
    if (copyToWechatBtn) {
      copyToWechatBtn.onclick = async () => {
        try {
          await copyContentToClipboardWithStyle();
        } catch (e) {
          showError('复制失败');
        }
      };
    }

    const copyHtmlBtn = document.getElementById('copy-html-btn');
    if (copyHtmlBtn) {
      copyHtmlBtn.onclick = async () => {
        try {
          if (!window.copyRawHtml) {
            throw new Error('复制功能未正确加载');
          }
          await window.copyRawHtml();
          showSuccess('已复制 HTML');
        } catch (e) {
          showError(`复制失败: ${e.message || '未知错误'}`);
        }
      };
    }

    // 初始化加载
    checkAndRestoreDocsFolder();
  } catch (error) {
    showError('初始化应用失败，请刷新页面重试');
  }
});
