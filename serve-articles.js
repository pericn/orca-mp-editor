const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const articlesDir = path.join(__dirname, 'articles');

// 获取 Markdown 文件目录树
function getMarkdownFiles(dir) {
  const files = fs.readdirSync(dir);
  return files
    .filter(file => !file.startsWith('.')) // 过滤隐藏文件夹
    .map(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        return { name: file, type: 'directory', children: getMarkdownFiles(fullPath) };
      } else if (file.endsWith('.md')) {
        return { name: file, type: 'file', path: fullPath };
      }
    })
    .filter(Boolean);
}

// 提供目录结构的 API
app.get('/api/articles', (req, res) => {
  const tree = getMarkdownFiles(articlesDir);
  res.json(tree);
});

// 提供 Markdown 文件内容的 API
app.get('/api/article', (req, res) => {
  const filePath = req.query.path;
  if (!filePath || !filePath.endsWith('.md')) {
    return res.status(400).send('Invalid file path');
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  res.send(content);
});

// 提供静态文件服务
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'orca.html'));
});

const PORT = 3730;
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});