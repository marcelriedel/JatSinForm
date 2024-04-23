# JatSinForm

JatSinForm is a light-weight js-application used for a browser-based pdf-production of scholarly articles, formatted in (NISO)-JATS-XML standard. 

The core functionalities of JatSinForm are primarily based on pagedJs, developed and maintained by Coko Foundation. pagedJs displays paginated content in the browser and generate print books (and articles) using web technologies (JS and CSS Paged Media Module).

JatSinForm converts each jats-xml, given as source document, to html and transforms it into the desired document model (e.g. with cover-page, abstract-sections, imprint). In addition to this, JatSinForm offers several editing functions usable during the pagedJs-preview for customizing the layout of each image (scaling, switching typesetting classes, resizing) by keyboard-shortcuts and on-click-features (using interactJs). 

Currently JatSinForm is tailored (article-design, css-styles, assets) to the highly standardized journals published by the German Archaeological Institute. 
It might be - at least partly - adaptable to other journal (or book) designs.

The html-views (renderAsViewer.js) are not fully implemented yet.
The JATS-XML documents (of the German Archaeological Institute) are created by independant tool chains (e.g. TagToolWizard and/or InDesign-workflows).

## Prerequisites
- You need a browser (tested with Chrome and Firefox only)
- You need an IDE (e.g. Visual Studio Code) or other server-solutions to run the js-application scripts (cors-policy-friendly) locally in your web-browser.

## Getting Started
- /xml-documents: deposit xml-files and related images here
- index.html: reference the xml-file to be rendered in: <meta name="--xml-file" content="example.xml"> 
- open index.html in default browser (using your IDE as local webserver)

## Libraries
- pagedJs
- interactJs
- qrCodeJs
- highlightJs

## Configurations
/configs:

- figConstellations.json
- journals.json
- tagConversionMap.json
- toggleFigureClasses.json












