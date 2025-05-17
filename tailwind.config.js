/** @type {import('tailwindcss').Config} */
module.exports = {
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
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
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