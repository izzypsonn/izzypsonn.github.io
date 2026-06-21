#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const Parser = require('wikiparser-node');

const PAGES_DIR = path.join(__dirname, 'pages');
const DIST_DIR = path.join(__dirname, 'dist');
const TEMPLATE_FILE = path.join(__dirname, 'template.html');

// Ensure dist directory exists
if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

// Read template
const template = fs.readFileSync(TEMPLATE_FILE, 'utf8');

// Get all .wiki files from pages directory
const wikiFiles = fs.readdirSync(PAGES_DIR).filter(f => f.endsWith('.wiki'));

console.log(`Building ${wikiFiles.length} pages...`);

let pageIndex = [];

wikiFiles.forEach(file => {
  const wikiContent = fs.readFileSync(path.join(PAGES_DIR, file), 'utf8');
  const pageName = path.basename(file, '.wiki');
  
  // Parse MediaWiki markup
  const ast = Parser.parse(wikiContent);
  const html = ast.toHtml();
  
  // Extract title (first h1 or first line if prefixed with =)
  let title = pageName.replace(/[-_]/g, ' ');
  const titleMatch = wikiContent.match(/^=+\s*(.+?)\s*=+/m);
  if (titleMatch) {
    title = titleMatch[1];
  }
  
  // Generate page HTML
  const pageHtml = template
    .replace('{{TITLE}}', title)
    .replace('{{CONTENT}}', html);
  
  // Write to dist
  const outputFile = path.join(DIST_DIR, `${pageName}.html`);
  fs.writeFileSync(outputFile, pageHtml);
  
  pageIndex.push({ name: pageName, title: title });
  console.log(`✓ Generated ${pageName}.html`);
});

// Generate index page with links
const indexContent = `<ul>
${pageIndex.map(p => `  <li><a href="${p.name}.html">${p.title}</a></li>`).join('\n')}
</ul>`;

const indexHtml = template
  .replace('{{TITLE}}', 'All Pages')
  .replace('{{CONTENT}}', `<div class="mw-content-ltr mw-parser-output">${indexContent}</div>`);

fs.writeFileSync(path.join(DIST_DIR, 'index.html'), indexHtml);
console.log('✓ Generated index.html');

console.log(`\nBuild complete! ${wikiFiles.length} pages created in dist/`);
