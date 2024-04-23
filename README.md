# JatSinForm

JatSinForm is a light-weight js-application used for a browser-based pdf-production of scholarly articles, formatted in (NISO)-JATS-XML standard. 

The core functionalities of JatSinForm are primarily based on pagedJs, developed and maintained by Coko Foundation. pagedJs displays paginated content in the browser and generate print books (and articles) using web technology (JS and CSS Paged Media Module)

JatSinForm converts each jats-xml, given as source document, to html and transforms it into the desired document model (e.g. with cover-page, abstract-sections, imprint). In addition to this, JatSinForm offers several editing functions usable during the pagedJs-preview for customizing the layout of each image (scaling, switching typesetting classes, resizing) in the browser (keyboard-shortcuts and on-click-features). 

Currently JatSinForm is tailored (article-design, css-styles, assets) to the highly standardized journals published by the German Archaeological Institute. But it might be - at least partly - adaptable to other journal (or book) designs.

The html-views are not fully implemented yet.
The JATS-XML documents (of the German Archaeological Institute) are created by independant tool chains (e.g. TagToolWizard).

## Libraries
- pagedJs
- interactJs
- qrCodeJs
- highlightJs

## Prerequisites
- You need a browser (tested with Chrome and Firefox only)
- You need an IDE (e.g. Visual Studio Code) or other server-solutions to run the js-application scripts (cors-policy-friendly) in the web-browser.

## Getting Started
- ...







