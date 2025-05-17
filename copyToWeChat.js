import { showSuccess, showError } from './orca.js';

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
      showSuccess('内容已复制到剪贴板！（使用备用方法）');
    }
  } catch (error) {
    console.error('复制内容时出错:', error);
    showError('复制失败，请检查控制台错误信息。');
    throw error;
  }
}

export async function copyRawHtml() {
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
      await navigator.clipboard.writeText(inlinedHtml);
      showSuccess('HTML 代码已复制到剪贴板！');
    } catch (err) {
      // 如果 clipboard API 不可用，使用传统方法
      const textarea = document.createElement('textarea');
      textarea.value = inlinedHtml;
      textarea.style.position = 'fixed';  // 防止页面滚动
      textarea.style.opacity = '0';       // 隐藏元素
      document.body.appendChild(textarea);
      textarea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      
      if (successful) {
        showSuccess('HTML 代码已复制到剪贴板！（使用备用方法）');
      } else {
        throw new Error('复制失败');
      }
    }
  } catch (error) {
    console.error('复制 HTML 代码时出错:', error);
    showError('复制失败，请检查控制台错误信息。');
    throw error;
  }
}