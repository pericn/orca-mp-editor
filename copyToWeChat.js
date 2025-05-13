export async function copyContentToClipboardWithStyle() {
  // 读取已内联的 HTML
  const res = await fetch('orca-inlined.html');
  const html = await res.text();

  // 创建临时容器
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  // 提取所有 style 标签
  const styles = Array.from(tempDiv.querySelectorAll('style')).map(style => style.outerHTML).join('\n');
  // 只提取 main.note-to-mp 的内容（包含 main 标签本身）
  const main = tempDiv.querySelector('main.note-to-mp');
  if (!main) {
    alert('未找到用户内容区域');
    return;
  }

  // 拼接 style 和 main
  const htmlToCopy = styles + '\n' + main.outerHTML;

  // 复制
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([htmlToCopy], { type: 'text/html' }),
        'text/plain': new Blob([main.innerText], { type: 'text/plain' })
      })
    ]);
    alert('内容已复制到剪贴板，可以粘贴到公众号编辑器中！');
  } catch (err) {
    alert('复制失败，请手动复制内容。');
    console.error(err);
  }
  // 清理
  tempDiv.remove();
}