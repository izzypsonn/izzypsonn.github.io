#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const Parser = require('wikiparser-node');

const PAGES_DIR = path.join(__dirname, 'pages');
const DIST_DIR = path.join(__dirname, 'dist');
const TEMPLATE_FILE = path.join(__dirname, 'template.html');
const TEMPLATES_DIR = path.join(__dirname, 'templates');

// Ensure dist directory exists
if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

// Load local template files for static template expansion
if (fs.existsSync(TEMPLATES_DIR)) {
  Parser.configPaths = [path.join(__dirname, 'node_modules', 'wikiparser-node', 'config')];
  Parser.config = 'enwiki';
  Parser.templateDir = TEMPLATES_DIR;
  console.log(`Loading templates from ${TEMPLATES_DIR}`);
}

// Read template
const template = fs.readFileSync(TEMPLATE_FILE, 'utf8');

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, tag => {
    const chars = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return chars[tag] || tag;
  });
}

function renderPageHeading(title) {
  return `<h1 id="firstHeading" class="firstHeading mw-first-heading"><span class="mw-page-title-main">${escapeHtml(title)}</span></h1>`;
}

// Get all .wiki files from pages directory
const wikiFiles = fs.readdirSync(PAGES_DIR).filter(f => f.endsWith('.wiki'));

console.log(`Building ${wikiFiles.length} pages...`);

// Remove stale HTML files in dist that don't have a corresponding .wiki source
try {
  const existingDistHtml = fs.readdirSync(DIST_DIR).filter(f => f.endsWith('.html'));
  const expectedHtml = new Set(wikiFiles.map(f => path.basename(f, '.wiki') + '.html'));
  expectedHtml.add('index.html'); // keep index
  for (const f of existingDistHtml) {
    if (!expectedHtml.has(f)) {
      try {
        fs.unlinkSync(path.join(DIST_DIR, f));
        console.log(`Removed stale file: ${f}`);
      }
      catch (e) {
        console.warn(`Failed to remove ${f}: ${e.message}`);
      }
    }
  }
}
catch (e) {
  console.warn('Could not prune dist directory:', e.message);
}

let pageIndex = [];

wikiFiles.forEach(file => {
  const wikiContentRaw = fs.readFileSync(path.join(PAGES_DIR, file), 'utf8');
  let wikiContent = wikiContentRaw;
  // Support a top-line PAGETITLE template to set the page title without '=' markup.
  // Examples:
  //   {{PAGETITLE|My Title}}
  //   {{PAGETITLE|title=My Title}}
  let titleOverride;
  const pageTitleRe = /^\s*\{\{\s*PAGETITLE(?:\s*\|([^}]*))?\s*\}\}\s*(?:\r?\n)?/i;
  const ptMatch = wikiContent.match(pageTitleRe);
  if (ptMatch) {
    const arg = (ptMatch[1] || '').trim();
    if (arg) {
      const named = /^title\s*=\s*(.+)$/i.exec(arg);
      titleOverride = named ? named[1].trim() : arg.trim();
    }
    wikiContent = wikiContent.slice(ptMatch[0].length);
  }
  const pageName = path.basename(file, '.wiki');

  // Parse MediaWiki markup with the page name so local templates can resolve correctly
  const ast = Parser.parse(wikiContent, pageName);
  const html = ast.toHtml();

  // Titles must be provided via a top-line {{PAGETITLE|...}} tag. If absent, fall back to filename.
  // The PAGETITLE tag is removed above before parsing so it won't appear in the content.
  let title = pageName.replace(/[-_]/g, ' ');
  if (titleOverride) {
    title = titleOverride;
  }

  const pageHeading = renderPageHeading(title);
  const navHomeSelected = pageName === 'index' ? ' selected' : '';

  // Generate page HTML
  const pageHtml = template
    .replace('{{TITLE}}', title)
    .replace('{{PAGE_HEADING}}', pageHeading)
    .replace('{{CONTENT}}', html)
    .replace('{{NAV_HOME_SELECTED}}', navHomeSelected);
  
  // Write to dist
  const outputFile = path.join(DIST_DIR, `${pageName}.html`);
  fs.writeFileSync(outputFile, pageHtml);
  
  pageIndex.push({ name: pageName, title: title });
  console.log(`✓ Generated ${pageName}.html`);
});

// Build index page from wikitext file if present, otherwise fall back to a generated list
const INDEX_SOURCE = path.join(PAGES_DIR, 'index.wiki');
if (fs.existsSync(INDEX_SOURCE)) {
  let indexWikiRaw = fs.readFileSync(INDEX_SOURCE, 'utf8');
  let indexWiki = indexWikiRaw;
  // Support PAGETITLE at top of index.wiki
  let indexTitleOverride;
  const pageTitleRe = /^\s*\{\{\s*PAGETITLE(?:\s*\|([^}]*))?\s*\}\}\s*(?:\r?\n)?/i;
  const idxPtMatch = indexWiki.match(pageTitleRe);
  if (idxPtMatch) {
    const arg = (idxPtMatch[1] || '').trim();
    if (arg) {
      const named = /^title\s*=\s*(.+)$/i.exec(arg);
      indexTitleOverride = named ? named[1].trim() : arg.trim();
    }
    indexWiki = indexWiki.slice(idxPtMatch[0].length);
  }

  const indexAst = Parser.parse(indexWiki, 'index');
  const indexContentHtml = indexAst.toHtml();

  let indexTitle = indexTitleOverride ?? 'All Pages';
  const indexHeading = renderPageHeading(indexTitle);
  const indexPageHtml = template
    .replace('{{TITLE}}', indexTitle)
    .replace('{{PAGE_HEADING}}', indexHeading)
    .replace('{{CONTENT}}', indexContentHtml)
    .replace('{{NAV_HOME_SELECTED}}', ' selected');

  fs.writeFileSync(path.join(DIST_DIR, 'index.html'), indexPageHtml);
  console.log('✓ Generated index.html from pages/index.wiki');
} else {
  const indexContent = `<ul>\n${pageIndex.map(p => `  <li><a href="${p.name}.html">${p.title}</a></li>`).join('\n')}\n</ul>`;

  const indexHtml = template
    .replace('{{TITLE}}', 'All Pages')
    .replace('{{PAGE_HEADING}}', renderPageHeading('All Pages'))
    .replace('{{CONTENT}}', `<div class="mw-content-ltr mw-parser-output">${indexContent}</div>`)
    .replace('{{NAV_HOME_SELECTED}}', ' selected');

  fs.writeFileSync(path.join(DIST_DIR, 'index.html'), indexHtml);
  console.log('✓ Generated index.html (fallback list)');
}

console.log(`\nBuild complete! ${wikiFiles.length} pages created in dist/`);
