#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const Parser = require('wikiparser-node');

const PAGES_DIR = path.join(__dirname, 'pages');
const DIST_DIR = path.join(__dirname, 'dist');
const WIKI_DIR = path.join(DIST_DIR, 'wiki');
const TEMPLATE_FILE = path.join(__dirname, 'template.html');
const STYLE_SOURCE = path.join(__dirname, 'style.css');
const TEMPLATES_DIR = path.join(__dirname, 'templates');

// Load configuration
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const config = packageJson.wikiConfig || {};
const REDIRECT_LANDING = config.redirectLanding || '/wiki/index.html';

// Ensure dist directories exist
if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}
if (!fs.existsSync(WIKI_DIR)) {
  fs.mkdirSync(WIKI_DIR, { recursive: true });
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

function processInterwikiLinks(html) {
  // Convert interwiki prefixes to external URLs
  // Replace /wiki/W%3A* (w: prefix encoded) with Wikipedia links
  // Also clean up the link text to remove the w: prefix
  const originalHtml = html;
  // Match both with and without .html extension, plus the link text
  html = html.replace(/<a\s+href="\/wiki\/W%3A([^"]+?)(?:\.html)?"\s+title="[^"]*">(?:w:)?([^<]*)<\/a>/gi, (match, article, linkText) => {
    const decoded = decodeURIComponent(article);
    const wikiUrl = `https://en.wikipedia.org/wiki/${decoded}`;
    // Clean up the article name for display (replace underscores with spaces)
    const displayText = linkText;
    return `<a href="${wikiUrl}" title="${displayText}">${linkText}</a>`;
  });
  return html;
}

function processFile(html) {
  const originalHtml = html;
  html = html.replace(/<img[^>]*src="\/wiki\/Special%3ARedirect%2Ffile%2F([^\.]+)\.jpg/gi, (match, file) => {
    const fileUrl = `../media/${file}.jpg`.toLowerCase();
    return `<img alt="" src="${fileUrl}`;
  });
  html = html.replace(/<a[^>]*class="mw-file-description">(.*?)<\/a>/gi, (match, inside) => {
    return inside; // Remove the file description link entirely
  });
  return html;
}

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

// Remove stale HTML files in wiki that don't have a corresponding .wiki source
try {
  const existingWikiHtml = fs.readdirSync(WIKI_DIR).filter(f => f.endsWith('.html'));
  const expectedHtml = new Set(wikiFiles.map(f => path.basename(f, '.wiki') + '.html'));
  for (const f of existingWikiHtml) {
    if (!expectedHtml.has(f)) {
      try {
        fs.unlinkSync(path.join(WIKI_DIR, f));
        console.log(`Removed stale file: wiki/${f}`);
      }
      catch (e) {
        console.warn(`Failed to remove wiki/${f}: ${e.message}`);
      }
    }
  }
}
catch (e) {
  console.warn('Could not prune wiki directory:', e.message);
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
  const navHomeSelected = pageName === 'Izzy_Sonnabend' ? ' selected' : '';

  // Generate page HTML with wiki paths
  let pageHtml = template
    .replace('{{TITLE}}', title)
    .replace('{{PAGE_HEADING}}', pageHeading)
    .replace('{{CONTENT}}', html)
    .replace('{{NAV_HOME_SELECTED}}', navHomeSelected);
  
  // Process interwiki links
  pageHtml = processInterwikiLinks(pageHtml);

  // Process file links
  pageHtml = processFile(pageHtml);
  
  // Update wikilinks to point to /wiki/ subdirectory with .html extension
  // Handle links that already have .html
  pageHtml = pageHtml.replace(/href="\/wiki\/([^"]+)\.html"/g, 'href="/wiki/$1.html"');
  // Handle wikilinks without .html extension
  pageHtml = pageHtml.replace(/href="\/wiki\/([^"]+)"(?!\.html)/g, 'href="/wiki/$1.html"');
  
  // Handle relative page links that need /wiki/ prefix
  pageHtml = pageHtml.replace(/href="([^/:"][^"]*)"/g, (match, link) => {
    if (link.startsWith('http') || link.startsWith('//') || link.startsWith('#')) {
      return match; // skip external links and anchors
    }
    if (!link.includes('.')) {
      return `href="/wiki/${link}.html"`;
    }
    return match;
  });
  
  // Write to wiki subdirectory
  const outputFile = path.join(WIKI_DIR, `${pageName}.html`);
  fs.writeFileSync(outputFile, pageHtml);
  
  pageIndex.push({ name: pageName, title: title });
  console.log(`✓ Generated wiki/${pageName}.html`);
});


if (fs.existsSync(STYLE_SOURCE)) {
  fs.copyFileSync(STYLE_SOURCE, path.join(DIST_DIR, 'style.css'));
  console.log('✓ Copied style.css to dist/');
} else {
  console.warn('style.css not found in project root; skipping CSS copy.');
}

// Create root redirect index.html
const redirectHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0; url=${REDIRECT_LANDING}">
  <title>Redirecting...</title>
</head>
<body>
  <p>Redirecting to <a href="${REDIRECT_LANDING}">wiki page</a>...</p>
</body>
</html>`;

fs.writeFileSync(path.join(DIST_DIR, 'index.html'), redirectHtml);
console.log(`✓ Created root redirect to ${REDIRECT_LANDING}`);

console.log(`\nBuild complete! ${wikiFiles.length} pages created in dist/wiki/`);
