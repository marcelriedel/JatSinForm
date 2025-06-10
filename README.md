# JatSinForm

**JatSinForm** is a light-weight js-application used for a browser-based pdf-production of scholarly articles, formatted in [(NISO)-JATS-XML](https://jats.nlm.nih.gov/) standard. 

The core functionalities of **JatSinForm** (=> renderAsPDF.js) are primarily based on [pagedJs](https://github.com/pagedjs/pagedjs), developed and maintained by [Coko Foundation](https://coko.foundation/). pagedJs displays paginated content in the browser and generate print books (and articles) using web technologies (JS and CSS Paged Media Module).

**JatSinForm** converts each jats-xml, given as source document, to html and transforms it into the desired document model (e.g. with cover-page, abstract-sections, imprint). The figures, referenced in the source xml via figure references ("fig-ref") are typeset automatically by default-sets. **JatSinForm** also offers several editing functions usable during the pagedJs-preview for customizing the layout of each image (scaling, switching typesetting classes, resizing) by keyboard-shortcuts.

Currently **JatSinForm** is tailored (article-design, css-styles, typesetting classes, assets) to the highly standardized journals published by the German Archaeological Institute. But, it might be - at least partly - adaptable to other journal (or book) designs.

The JATS-XML documents (of the German Archaeological Institute) are created by independant tool chains (e.g. [TagToolWizard](https://github.com/pBxr/TagTool_WiZArd) and/or InDesign-workflows).

## Prerequisites
- You need a browser (tested with Chrome and Firefox only)
- You need an IDE (e.g. Visual Studio Code) or other server-solutions to run the js-application scripts (cors-policy-friendly) locally in your web-browser.

## Getting Started
- **/xml-documents**: deposit xml-files and its related images in this folder (analogue to "example.xml")

- **index.html**: 
    - reference xml-file in meta-tag: 
        - `<meta name="--xml-file" content="example.xml">`
    - reference main.js in document head: 
        - `<script src="src/js/app.js" type="application/javascript"></script>` 
    - open/serve/preview index.html in your prefered browser 
        - using your IDE as local webserver 
        - installing "Live Preview"-Extension recommended

## Controls

### Application Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `p` | Show paged view |
| `v` | Show web (HTML) view |
| `e` | Show editor view *(not implemented)* |
| `ß` | Create `figConstellation.json` *(dev-only)* |
| `r` | Reload page |
| `q` | Reload page *(with style refresh)* |
| `f` | Highlight all figure references |
| `h` | Highlight context information |
| `o` | Display overflows in paged view |
| `d` | Download document configs or HTML document |

### Set Figure Size (All Figures)

| Key | Size | Action |
|-----|------|--------|
| `t` | tiny | Set size class of all figures to tiny |
| `s` | small | Set size class of all figures to small |
| `m` | medium | Set size class of all figures to medium |
| `l` | large | Set size class of all figures to large |

---

### Figure Control Shortcuts (mouse over figure)

| Key | Class / Action | Description |
|-----|----------------|-------------|
| `u` | — | Place figure on top of page |
| `c` | Toggle caption position | Switch between: `regular-bottom`, `regular`, `overmargin-bottom`, `overmargin` |
| `1` | overmargin | Set figure class to `overmargin` |
| `2` | regular | Set figure class to `regular` |
| `3` | inset | Set figure class to `inset` |
| `4` | float-w-col-6 | Set figure class to `float-w-col-6` |
| `5` | float-w-col-4 | Set figure class to `float-w-col-4` |
| `6` | float-w-col-2 | Set figure class to `float-w-col-2` |












