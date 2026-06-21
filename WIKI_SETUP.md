# Personal Wikipedia-Style Wiki

A static website builder that converts MediaWiki markup to HTML.

## Setup

### 1. Install Dependencies
```bash
npm install
```

This installs `mediawiki-parser` which converts Wikipedia markup to HTML.

### 2. Create and Edit Pages

All pages are stored as `.wiki` files in the `pages/` directory:

```
pages/
├── home.wiki
├── about.wiki
└── projects.wiki
```

### 3. Build the Site

```bash
npm run build
```

This:
- Reads all `.wiki` files from `pages/`
- Converts MediaWiki markup to HTML
- Generates HTML files in `dist/`
- Creates an index page with links to all pages

### 4. Deployment

Commit the `dist/` folder to your GitHub Pages repository. The static HTML files are ready to serve.

---

## MediaWiki Markup Reference

### Headings
```wiki
= Level 1 =
== Level 2 ==
=== Level 3 ===
```

### Formatting
```wiki
'''bold'''
''italic''
'''''bold italic'''''
```

### Lists
```wiki
* Bullet item
** Nested bullet

# Numbered item
## Nested numbered
```

### Links
```wiki
[[Internal Page Name]]
[[Internal Page|Display Text]]
[[https://example.com External Link]]
```

### Code
```wiki
<code>inline code</code>

<pre>
block of code
line 2
</pre>
```

### Sections
The first `= Title =` becomes the page title.

### Example Page
```wiki
= My Page Title =

This is the introduction paragraph.

== Section 1 ==
Content here.

== Section 2 ==
* Point 1
* Point 2
** Nested point
```

---

## Workflow

1. **Edit**: Open a `.wiki` file in `pages/` and write/edit content using MediaWiki markup
2. **Build**: Run `npm run build`
3. **Preview**: Open `dist/index.html` in a browser locally
4. **Deploy**: Push the `dist/` folder to your GitHub Pages repository

---

## File Structure

```
.
├── pages/              # Source wiki files (.wiki)
│   ├── home.wiki
│   ├── about.wiki
│   └── projects.wiki
├── dist/               # Generated static HTML (git-ignored, regenerate with npm run build)
│   ├── index.html
│   ├── home.html
│   ├── about.html
│   └── projects.html
├── style.css           # Wikipedia-style CSS
├── template.html       # HTML template for all pages
├── build.js            # Build script
├── package.json        # Node.js config
└── README.md           # This file
```

---

## Adding New Pages

1. Create a new `.wiki` file in the `pages/` directory:
   ```bash
   pages/mynewpage.wiki
   ```

2. Write content using MediaWiki markup:
   ```wiki
   = My New Page =
   
   Content goes here...
   ```

3. Run the build:
   ```bash
   npm run build
   ```

4. The page will appear in `dist/mynewpage.html` and be linked from `dist/index.html`

---

## Tips

- **Page names**: Use lowercase with hyphens (e.g., `my-page.wiki` → `my-page.html`)
- **First heading**: The first `= Heading =` becomes the page title
- **Links**: Use `[[page-name]]` to link to other wiki pages
- **CSS**: All pages use `style.css` which provides the Wikipedia aesthetic
- **Static hosting**: You can serve the `dist/` folder from any static host (GitHub Pages, Netlify, etc.)

---

## Rebuilding After Changes

Any time you edit a `.wiki` file, run:
```bash
npm run build
```

The build script will regenerate all HTML files in `dist/`.

