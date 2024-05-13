# JatSinForm

**JatSinForm** is a light-weight js-application used for a browser-based pdf-production of scholarly articles, formatted in [(NISO)-JATS-XML](https://jats.nlm.nih.gov/) standard. 

The core functionalities of **JatSinForm** (=> renderAsPDF.js) are primarily based on [pagedJs](https://github.com/pagedjs/pagedjs), developed and maintained by [Coko Foundation](https://coko.foundation/). pagedJs displays paginated content in the browser and generate print books (and articles) using web technologies (JS and CSS Paged Media Module).

**JatSinForm** converts each jats-xml, given as source document, to html and transforms it into the desired document model (e.g. with cover-page, abstract-sections, imprint). The figures, referenced in the source xml via figure references ("fig-ref") are typeset automatically by default-sets. **JatSinForm** also offers several editing functions usable during the pagedJs-preview for customizing the layout of each image (scaling, switching typesetting classes, resizing) by keyboard-shortcuts and on-click-features (using interactJs). 

Currently **JatSinForm** is tailored (article-design, css-styles, typesetting classes, assets) to the highly standardized journals published by the German Archaeological Institute. But, it might be - at least partly - adaptable to other journal (or book) designs.

The html-views (=>renderAsViewer.js) are not fully implemented yet.
The JATS-XML documents (of the German Archaeological Institute) are created by independant tool chains (e.g. [TagToolWizard](https://github.com/pBxr/TagTool_WiZArd) and/or InDesign-workflows).

## Prerequisites
- You need a browser (tested with Chrome and Firefox only)
- You need an IDE (e.g. Visual Studio Code) or other server-solutions to run the js-application scripts (cors-policy-friendly) locally in your web-browser.

## Getting Started
- **/xml-documents**: deposit xml-files and its related images in this folder (analogue to "example.xml")

- **index.html**: 
    - reference xml-file in meta-tag: `<meta name="--xml-file" content="example.xml">`
    - reference main.js in document head: `<script src="src/js/main.js" type="application/javascript"></script>` 
    - open/serve/preview index.html in your prefered browser (using your IDE as local webserver. Installing "Live Preview"-Extension recommended)

## Libraries
- pagedJs
- interactJs
- qrCodeJs
- highlightJs

## Configurations
/configs:

- *figConstellations.json*
- *journals.json*
- *tagConversionMap.json*
- *toggleFigureClasses.json*












