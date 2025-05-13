const fs = require('fs');
const postcss = require('postcss');

const css = fs.readFileSync('./orca.css', 'utf8');
const root = postcss.parse(css);

const pseudoProps = new Set();

root.walkRules(rule => {
  if (rule.selector.includes('::before') || rule.selector.includes('::after')) {
    rule.walkDecls(decl => {
      pseudoProps.add(decl.prop);
    });
  }
});

console.log(Array.from(pseudoProps));