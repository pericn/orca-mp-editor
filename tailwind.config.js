/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./orca.html",
    "./*.js",
    "./assets/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 这里可以添加你的自定义颜色
        primary: {
          50: 'var(--color-primary-50)',
          100: 'var(--color-primary-100)',
          200: 'var(--color-primary-200)',
          300: 'var(--color-primary-300)',
          400: 'var(--color-primary-400)',
          500: 'var(--color-primary-500)',
          600: 'var(--color-primary-600)',
          700: 'var(--color-primary-700)',
          800: 'var(--color-primary-800)',
          900: 'var(--color-primary-900)',
        },
      },
      fontFamily: {
        // 这里可以添加你的自定义字体
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      spacing: {
        // 这里可以添加你的自定义间距
      },
      borderRadius: {
        // 这里可以添加你的自定义圆角
      },
    },
  },
  plugins: [],
} 