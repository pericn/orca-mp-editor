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

// Loading 状态管理
export function showLoading(message = '加载中...') {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.textContent = message;
    loading.style.display = 'block';
  }
}

export function hideLoading() {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.style.display = 'none';
  }
} 