import { showSuccess, showError } from './utils.js';

export async function copyContentToClipboardWithStyle() {
  try {
    // 获取文章内容
    const main = document.querySelector('main.note-to-mp');
    if (!main) {
      throw new Error('未找到文章内容区域');
    }

    // 获取样式表内容
    const styleSheets = Array.from(document.styleSheets)
      .filter(sheet => sheet.href && sheet.href.includes('orca.css'))
      .map(sheet => fetch(sheet.href).then(res => res.text()));
    
    const cssContent = await Promise.all(styleSheets);

    // 调用后端 API 进行样式内联
    const response = await fetch('/api/inline-styles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        html: main.outerHTML,
        css: cssContent.join('\n')
      })
    });

    if (!response.ok) {
      throw new Error('样式内联处理失败');
    }

    const { html: inlinedHtml } = await response.json();

    // 复制到剪贴板
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([inlinedHtml], { type: 'text/html' }),
          'text/plain': new Blob([main.innerText], { type: 'text/plain' })
        })
      ]);
      showSuccess('内容已复制到剪贴板，可以粘贴到公众号编辑器中！');
    } catch (err) {
      // 如果 clipboard API 不可用，使用传统方法
      const textarea = document.createElement('textarea');
      textarea.value = inlinedHtml;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showSuccess('内容已复制到剪贴板，可以粘贴到公众号编辑器中！');
    }
  } catch (error) {
    throw error;
  }
}

export async function copyRawHtml() {
  try {
    const main = document.querySelector('.note-to-mp');
    
    if (!main) {
      throw new Error('找不到内容区域');
    }
    
    const content = main.innerHTML;
    
    // 尝试复制
    try {
      // 方法1: 剪贴板API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(content);
        return true;
      }
      
      // 方法2: execCommand
      const textarea = document.createElement('textarea');
      textarea.value = content;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      
      try {
        textarea.select();
        const success = document.execCommand('copy');
        if (!success) {
          throw new Error('execCommand 复制失败');
        }
        return true;
      } finally {
        document.body.removeChild(textarea);
      }
    } catch (copyError) {
      throw new Error(`复制失败: ${copyError.message}`);
    }
  } catch (error) {
    throw error;
  }
}

// 添加自检函数
export function verifyCopyFunction() {
  return typeof copyRawHtml === 'function';
}