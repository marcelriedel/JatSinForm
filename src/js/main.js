/** -----------main.js ------------ 
 * @type {Script}
 * @author: Marcel Riedel
 ----------------------------------*/

/** -------------------------------------- 
 * internal script libraries:
 * @type {HTMLScriptElement}
 --------------------------------------*/
// generatePagedView
const generatePagedViewScript = document.createElement('script');
generatePagedViewScript.type = 'text/javascript';
generatePagedViewScript.src = 'src/js/generatePagedView.js';

// generateHtmlView
const generateHtmlViewScript = document.createElement('script');
generateHtmlViewScript.type = 'text/javascript';
generateHtmlViewScript.src = 'src/js/generateHtmlView.js';

// htmlViewController
const htmlViewControllerScript = document.createElement('script');
htmlViewControllerScript.type = 'text/javascript';
htmlViewControllerScript.src = 'src/js/htmlViewController.js';

// setup-script
const setupScript = document.createElement('script');
setupScript.type = 'text/javascript';
setupScript.src = 'src/js/setup.js';

// fallback-script (for HTML exports);
const fallbackScript = function fallback() {
    document.addEventListener("readystatechange", (event) => {
        if (event.target.readyState === "interactive") {
            let errorConsole = document.createElement("div");
            errorConsole.style = "padding:0.25rem 1.5rem;font-size:0.9rem;background:#fff5d2;"
            errorConsole.innerHTML = "There was a problem loading an external script from the internet." +
            "The document is readable entirely but might have reduced functionalities!";
            window.document.body.prepend(errorConsole);
        }
    });
 }

/** -------------------------------------
 * external script libraries:
 * @type {HTMLScriptElement}
---------------------------------------*/
// pagedJs-script
const pagedJsScript = document.createElement('script');
pagedJsScript.type = 'text/javascript';
pagedJsScript.src = "src/js/pagedjs.js";  // src/js/pagedjs.js

// interactJs-script
const interactJsScript = document.createElement('script');
interactJsScript.type = 'text/javascript';
interactJsScript.src = 'https://cdn.jsdelivr.net/npm/interactjs/dist/interact.min.js' // "src/js/interact.min.js";

// highlightJS-script:
const highlightJsScript = document.createElement('script');
highlightJsScript.type = 'text/javascript';
highlightJsScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js';

// highlightJS-CSS:
const highlightJsCSSLink = document.createElement('link');
highlightJsCSSLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/default.min.css';
highlightJsCSSLink.type = 'text/css';
highlightJsCSSLink.rel = 'stylesheet';

// qrcodejs-script:
const qrcodejs = document.createElement('script');
qrcodejs.type = 'text/javascript';
qrcodejs.src = "https://cdn.rawgit.com/davidshimjs/qrcodejs/gh-pages/qrcode.min.js"; // "src/js/qrcode.min.js"

// leaflet
const leaflet = document.createElement('script');
leaflet.type = 'text/javascript';
leaflet.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

// leafletCssLink:
const leafletCssLink = document.createElement('link');
leafletCssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
leafletCssLink.type = 'text/css';
leafletCssLink.rel = 'stylesheet';

// medium-zoom-Script: https://github.com/francoischalifour/medium-zoom
const mediumZoomScript = document.createElement('script');
mediumZoomScript.type = 'text/javascript';
mediumZoomScript.src = "https://cdn.jsdelivr.net/npm/medium-zoom@1.1.0/dist/medium-zoom.min.js";

// font awesome 4 icons:
const fontAwesomeLink = document.createElement('link');
fontAwesomeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css';
fontAwesomeLink.type = 'text/css';
fontAwesomeLink.rel = 'stylesheet';

/** -------------------------------------
 * prepare application constants:
 * @type {Constants}
---------------------------------------*/
const defaultJournal = "AA";
const urlRegex = /doi|handle|urn|ark:|orcid|ror|dainst|idai.world|wikipedia/g;
const specificUseRegex = "zenon|extrafeatures|supplements";
const progressBar = document.createElement("div");
progressBar.id = "progressBar";

const errorConsole = document.createElement("div");
errorConsole.id = "error";
errorConsole.innerHTML = "<h3>Critical error found:</h3>";

/** --------------------------------------
 * document state event listener:
 * @type {document}
 * @type {EventListenerObject}
 --------------------------------------*/
document.addEventListener("readystatechange", (event) => {

    if (event.target.readyState === "interactive") {
 
        // request tagConversionMap, journals.json and figureConstellations:
        requestSourceFile("configs/tagConversionMap.json", "tag-conversion-map");
        requestSourceFile("configs/journals.json", "journals-config");
        requestSourceFile("configs/figConstellations.json", "fig-constellations");
        requestSourceFile("configs/toggleFigureClasses.json", "toggle-figure-classes");
        requestSourceFile("src/css/viewer-styles.css", "viewer-styles");

        // checkout xml-path
        if (document.querySelector('meta[name="--xml-file"]') === null) {
            errorConsole.innerHTML = "No xml-file given! " + 
            "Checkout index.html: meta[name=\"--xml-file\"]";
            document.body.append(errorConsole);
            throw new Error();
        }

        // request source xml:
        let xml = false;
        let xmlFile = false;
        let xmlPath = false;

        // request jats.xml:
        if(!xmlFromEditor) {
            xmlFile = document.querySelector('meta[name="--xml-file"]').content;
            xmlPath = xmlFolder + "/" + xmlFile;
            if(/.xml/.test(xmlPath)) {
                requestSourceFile(xmlPath, "local-xml-file");
                xml = localStorage.getItem("local-xml-file");
            } else {
                errorConsole.innerHTML = "Path to xml-file is invalid: ['" + 
                xmlPath + "']. Checkout index.html: meta[name=\"--xml-file\"]";
                document.body.append(errorConsole);
                throw new Error();
            }
        }
        else {
            xml = localStorage.getItem("editor-xml");
        }

        // check xml request:
        if(!xml || xml === null) {
            errorConsole.innerHTML = "ERROR: Could not load xml!";
            document.body.append(errorConsole);
            throw new Error();
        }

        // replace nested <sec>-elements with <section>-tag before:
        xml = xml.replaceAll("<sec", "<section")
            .replaceAll("</sec>", "</section>");
        xml = transformSelfClosingTags(xml);  // transform self-closing tags
        
        // create XML-document:
        let parser = new DOMParser();
        let xmlDoc = parser.parseFromString(xml, "text/xml");

        // process xml with pre-validation:
        updateStorageEventListener("Process XML document...");
        processXmlDocument(xmlDoc);  // awaiting preflightXmlRequest();
        updateStorageEventListener("Ready");

        // get journalId:
        let journalId = xmlDoc.querySelector("journal-id").textContent;

        // switch between pdf and viewer-format:
        if (localStorage.getItem("renderAs") === "PDF") {
            // prevent auto start of pagedJs previewer:
            window.PagedConfig = { auto: false };

            // set default imageSizeClass
            if (localStorage.getItem("imageClassThreshold") === undefined) {
                localStorage.setItem("imageClassThreshold", imageClassThresholdDefault);
            }
            // add styles:
            let styleSheetLink = getStyleSheetLink(journalId, "pagedView");
            document.head.appendChild(styleSheetLink);

            // add render scripts:
            document.head.appendChild(generatePagedViewScript);
            document.head.appendChild(pagedJsScript);
        }
        else if(localStorage.getItem("renderAs") === "Viewer") {
            let documentRoot = document.querySelector(':root');
            localStorage.setItem("documentRoot", documentRoot);
            localStorage.setItem("documentBody", document.body.outerHTML);

            // add styles:
            let styleSheetLink = getStyleSheetLink(journalId, "htmlView");
            document.head.appendChild(styleSheetLink);

            // add render scripts:
            document.head.appendChild(generateHtmlViewScript);
            document.head.appendChild(htmlViewControllerScript);
        }
        else {
            document.head.appendChild(setupScript);
        }

        // add third-party libraries
        document.head.appendChild(interactJsScript);
        document.head.appendChild(highlightJsCSSLink);
        document.head.appendChild(highlightJsScript);
        document.head.appendChild(qrcodejs);
        document.head.appendChild(leafletCssLink);
        document.head.appendChild(leaflet);
        document.head.appendChild(mediumZoomScript); 
        document.head.appendChild(fontAwesomeLink);
    }

    if (event.target.readyState === "complete") {

        // pagedJs preview
        if (localStorage.getItem("renderAs") === "PDF") {
            document.body.classList.add("fade-in");
            controlPagedJsHandler();
            controlInteractJs();
            window.PagedPolyfill.preview();
            scrollToLastPosition();
            hljs.highlightAll();
        }
        // html view
        else if(localStorage.getItem("renderAs") === "Viewer") {
            hljs.highlightAll();
        }
        // figure constellation setup
        else {
            document.body.innerHTML = "Setup mode...(see console)!<br><br>" +
            "Press p for rendering jats-xml as pdf-preview.<br>" + 
            "Press v for rendering jats-xml as html-view.<br>";
        }
    }
});

/** -------------------------------------
 * handle processStage by storage listener:
 * @type {window}
 * @type {EventListenerObject}
 --------------------------------------*/
 window.addEventListener("storage", () => {
    document.body.prepend(progressBar);
    let processStage = localStorage.getItem("processStage");
    initProgressBar(processStage);
});

function initProgressBar(processStage) {

    progressBar.style.fontFamily = "UI-MONOSPACE";
    progressBar.style.fontSize = "0.9em";

    if (processStage === "Ready") {
        progressBar.innerHTML = processStage + "!";
        setTimeout(hideProgressBar, 2000);
    } else {
        progressBar.innerHTML = processStage;
    }

    function hideProgressBar() {
        progressBar.style.display = "none";
        document.body.className = "";
    }
}

function updateStorageEventListener(processStage) {
    localStorage.setItem("processStage", processStage);
    window.dispatchEvent(new Event('storage'));
}

/** -------------------------------------
 * document keyboard event listener:
 * @type {document}
 * @type {EventListenerObject}
 --------------------------------------*/
document.addEventListener('keyup', function (e) {

    // press e to switch to editorjs:
    if (e.key === "e") {
        let editorLocation = "/xml-generation/editorjs/editor.html"
        window.location = location.origin + editorLocation;
    }
    // press p to set "renderAs" to "PDF-Preview"
    if (e.key === showPagedView) {
        localStorage.setItem("renderAs", "PDF");
        window.location.reload();
    }
    // press v to set "renderAs" to "HTML-View"
    if (e.key === showHTMLView) {
        localStorage.setItem("renderAs", "Viewer");
        window.location.reload();
    }
    // press * to set "renderAs" to "Setup"
    if (e.key === setupFigConstellations) {
        localStorage.setItem("renderAs", "Setup");
        window.location.reload();
    }
    // press r for reload
    if (e.key === reload) {
        window.location.reload();
    }
    // press q for hard reset (refresh maps)
    if (e.key === hardReset) {
        localStorage.removeItem('figure-map');
        localStorage.removeItem('text-content-map');
        localStorage.removeItem('documentState');
        window.location.reload();
    }
    // press @ to download documentConfig
    if (e.key === "@") {
        if(localStorage.getItem("renderAs") === "PDF") {
            downloadDocumentConfig();
        }
        if(localStorage.getItem("renderAs") === "Viewer") {
            downloadHTMLDocument();
        }
    }

    // press f to highlight figRefs:
    if (e.key === highlightFigReferences) {
        let highlightElements = document.querySelectorAll("a.fig-ref");
        for (let i = 0; i < highlightElements.length; i++) {
            highlightElements[i].style.background = "rgb(250 250 172)";
        }
    }

    // press h to highlight context information of elements:
    if (e.key === highlightContextInfo) {
        let highlightElements = document.querySelectorAll(".text-content,FIGURE");
        for (let i = 0; i < highlightElements.length; i++) {
            highlightElements[i].classList.add("display-data-attributes");
        }
    }

    // press o to see overflowing elements of pagedjs-page-content:
    if (e.key === displayOverflows) {
        let pageContents = document.querySelectorAll(".pagedjs_page_content");
        for (let i = 0; i < pageContents.length; i++) {
            pageContents[i].style.display = "flex";
        }
    }

    // press t(op) to push figure on topOfPage:
    if (e.key === figureToTop) {
        if (document.querySelector(".active") !== null) {
            let figure = document.querySelector(".active").parentElement;
            let figureId = figure.id;
            let figureMap = JSON.parse(localStorage.getItem("figure-map"));
            figureMap[figureId]["style"] = false;
            figureMap[figureId]["positionClass"] = "onTopOfPage";
            localStorage.setItem("figure-map", JSON.stringify(figureMap));
            setTimeout(function () {
                window.location.reload();
            }, 2000);
        };
    }

    // press 2, 3, 4 or 6, 7, 8 to change "imageClassThreshold"
    if (e.key >= 2 && e.key < 5 || e.key > 5 && e.key <= 9) {
        let imageClassThreshold = e.key;
        localStorage.setItem("imageClassThreshold", imageClassThreshold);
        localStorage.removeItem("sizeClassSetGlobal");
        window.location.reload();
    }
    // press 1, 5 or 9 to change set sizeClassGlobal:
    if (e.key == 1 || e.key == 5 || e.key == 9) {
        let sizeClassSetGlobal = false;
        switch(true) {
            case(e.key == 1):
            sizeClassSetGlobal = "small";
            break;

            case(e.key == 5):
            sizeClassSetGlobal = "medium";
            break;

            case(e.key == 9):
            sizeClassSetGlobal = "large";
            break;
        }
        localStorage.setItem("sizeClassSetGlobal", sizeClassSetGlobal);
        window.location.reload();
    }
    /*
    if (e.key == "z") {
        if (document.querySelector(".active") !== null) {
            let figure = document.querySelector(".active").parentElement;
            let figureId = figure.id;
            let figureMap = JSON.parse(localStorage.getItem("figure-map"));
            figureMap[figureId]["typesettingClass"] = "overmargin";
            figureMap[figureId]["style"] = false;
            localStorage.setItem("figure-map", JSON.stringify(figureMap));
            setTimeout(function () {
                window.location.reload();
            }, 2000);
        };
    }
    */
});

/** -------------------------------------
 * process XML document and xml preflight-
 * checks asynchronously
 * @type {Script}
  --------------------------------------*/

async function processXmlDocument(xmlDoc) {

    // preflight xml:
    updateStorageEventListener("Preflight xml-request...");
    let xmlErrorResult = await preflightXmlRequest(xmlDoc);
    if(xmlErrorResult) {
        document.body.append(errorConsole);
        throw new Error("XML-Parsing-Error");
    }

    // prepare document properties:
    let articleId;
    let documentId = getDocumentStateProperty("documentId");
    if(xmlDoc.querySelector("article-id[pub-id-type='doi']") !== null) {
        articleId = xmlDoc.querySelector("article-id[pub-id-type='doi']").textContent;
    }
    else {articleId = "document-without-id"};

    // checkout reload of previous document
    let documentReloaded = false;
    let documentState = {};
    if (!documentId || documentId !== articleId) {
        documentState["documentId"] = articleId;    // commonly a doi-url
        documentState["scrollPosition"] = [0, 0];   // x- and y-coordinates
        localStorage.setItem("documentState", JSON.stringify(documentState));
    } else { documentReloaded = true; }

    // get and add language code to html (short form):
    let lang = xmlDoc.querySelector("article").getAttribute("xml:lang");
    lang = (lang) ? lang.slice(0, 2) : "de";
    localStorage.setItem("documentLang", lang);
    
    // define journal related properties:
    let journalId = xmlDoc.querySelector("journal-id").textContent;
    let journalConfigs = JSON.parse(localStorage.getItem("journals-config"))[0];
    let journalKey = (journalConfigs[journalId] !== undefined) ? journalId : defaultJournal;
    let journalColor = journalConfigs[journalKey]["journalMainColor"];
    localStorage.setItem("journal-config", JSON.stringify(journalConfigs[journalKey]));

    // convert xml to htmlContentBody:
    updateStorageEventListener("Convert XML to HTML...");
    let htmlContentBody = convertXMLToHtmlBody(xmlDoc);
    document.body.innerHTML = htmlContentBody.outerHTML;

    // process image (files):
    updateStorageEventListener("Process image files...");
    processImageFiles(documentReloaded);

    // add style related properties to documentRoot:
    let documentRoot = document.querySelector(':root');
    documentRoot.style.setProperty('--journal-color', journalColor);
    documentRoot.style.setProperty('--background-url', getPosterImageBackgroundUrl());
    documentRoot.style.setProperty('--pages-flex-direction', pagesFlexDirection);
}

async function preflightXmlRequest(xmlDoc) {

    updateStorageEventListener("Preflight XML document...");
    let tagConversionMap = JSON.parse(localStorage.getItem("tag-conversion-map"))[0];

    // catch xml parsing errors:
    let errorText;
    let parseErrorNode = xmlDoc.querySelector('parsererror');
    if (parseErrorNode) {
        errorText = parseErrorNode.querySelector("div");
        errorConsole.append(errorText);
        return(errorConsole);
    }

    // collect elements which are obligatory:
    let isObligatory = [];
    Object.keys(tagConversionMap).forEach(function(key){
        let element = tagConversionMap[key];
        if(element.hasOwnProperty("obligatory")) {
            if(element.obligatory) {
                isObligatory.push(key);
            }
        }
    });
 
    // check availability of critical xml elements:
    for (let i = 0; i < isObligatory.length; i++) {
        let element = xmlDoc.querySelector(isObligatory[i]);
        // is not available
        if(element === null) {
            errorText = "<" + isObligatory[i] + ">-element missing";
            console.log(errorText);
            errorConsole.append(errorText);
            return(errorConsole);
        }
        if(!element.hasChildNodes()) {
            if(element.tagName !== "back") {
                errorText = "<" + isObligatory[i] + ">-element is empty";
                errorConsole.append(errorText);
                return(errorConsole);
            };
        }
    }
    // check graphics:
    let graphics = xmlDoc.querySelectorAll("graphic,inline-graphic");
    for (let i = 0; i < graphics.length; i++) {
        if (graphics !== null && graphics.length > 0) {
            let href = graphics[i].getAttribute("xlink:href");
            // check image paths:
            if(/[(){}<>?~;,]/.test(href)) {
                errorText = "Path to: '" + href + "' has invalid characters like [(){}<>?~;,";
                errorConsole.append(errorText);
                return(errorConsole);
            }
            // check image extensions:
            if(/.tif/.test(href) || /.tiff/.test(href)) {
                errorText = "image: '" + href + "' has invalid format (jpeg or png expected)";
                errorConsole.append(errorText);
                return(errorConsole);
            }
        }
    }
    return(false);
}

function convertXMLToHtmlBody(xmlDoc) {

    /* TO-DO:
    xmlBody should be tagged separatly from front and back
    - currently xmlBody is wrapped up as "content-body" together with
    .front and .back, which are appended to xmlBody. 
    The main-text is not queriable separatly. */

    let tagConversionMap = JSON.parse(localStorage.getItem("tag-conversion-map"))[0];
    let xmlBody = xmlDoc.getElementsByTagName("body")[0];
    let xmlFront = xmlDoc.getElementsByTagName("front")[0];
    let xmlBack = xmlDoc.getElementsByTagName("back")[0];
    
    // append meta-content-elements:
    xmlBody.appendChild(xmlFront)
    xmlBody.appendChild(xmlBack);

    // remove empty elements except of (inline-)graphic:
    removeEmptyElements(xmlBody);

    // convert xml elements to html elements:
    convertElementsByTagConversionMap(xmlBody, tagConversionMap);

    // enhance code wit <pre> and language-class:
    let codeItems = xmlDoc.querySelectorAll("code");
    for (let i = 0; i < codeItems.length; i++) {
        let language = codeItems[i].getAttribute("language");
        let pre = document.createElement('pre');
        let code = document.createElement('code');
        if (language) { code.classList.add(language); }
        code.innerHTML = codeItems[i].innerHTML;
        pre.appendChild(code)
        codeItems[i].replaceWith(pre);
    }

    // set metaName as element-attribute of custom-meta:
    let customMetaElements =  xmlDoc.querySelectorAll(".custom-meta");
    for (let i = 0; i < customMetaElements.length; i++) {
        let metaName = customMetaElements[i].querySelector(".meta-name");
        if(metaName) {
            customMetaElements[i].classList.add(metaName.innerText);
            metaName.remove();
        }
    }

    // assign generated element-id if missing:
    let textContentElements = xmlBody.querySelectorAll("p,.title,ul,ol,li,table,pre,code");
    for (let i = 0; i < textContentElements.length; i++) {
        // use loop id to define missing element-ids
        if(!textContentElements[i].id) {
            let genId = "genId-" + i;
            let parent = textContentElements[i].parentElement;
            if(parent !== undefined) {
                if(/footnote/.test(parent.className)) {
                  genId = "fn-genId" + i;
                }
            }
            textContentElements[i].id = genId;
        }
    }
    addHeadlineClassesBySectionHierarchy(xmlBody, ".title");

    // wrap xmlBody as htmlContentBody
    let htmlContentBody = document.createElement('div');
    htmlContentBody.id = "content-body";
    htmlContentBody.innerHTML = xmlBody.innerHTML;

    return (htmlContentBody);
}

function transformSelfClosingTags(xml) {
    let split = xml.split("/>");
    let newXml = "";
    for (let i = 0; i < split.length - 1;i++) {
        let edsplit = split[i].split("<");
        let elementName = edsplit[edsplit.length - 1].split(" ")[0];
        console.log("Notice: self-closing-tags found: ", elementName);
        newXml += split[i] + "></" + elementName + ">";
    }
    return newXml + split[split.length-1];
}

function removeEmptyElements(xmlBody) {

    // get empty elements excluding graphic and inline-graphic:
    let emptyTags = xmlBody.querySelectorAll(
        "*:empty:not(graphic,inline-graphic)");
    
    for (let i = 0; i < emptyTags.length; i++) {
        emptyTags[i].remove();
        console.log("Notice: Empty elements has been removed!");
    }
}

function convertElementsByTagConversionMap(xmlBody, tagConversionMap) {

    // convert selectors as defined in tagConversionMap:
    for (let selector in tagConversionMap) {
        let mapTagName = tagConversionMap[selector]["tagName"];
        let mapClassname = tagConversionMap[selector]["className"];

        // process each selector
        if (xmlBody.querySelectorAll(selector).length !== 0) {
            let xmlElements = xmlBody.querySelectorAll(selector);

            for (let i = 0; i < xmlElements.length; ++i) {
                let newElement = document.createElement(mapTagName);
                
                // transfer ids and classnames of xml-elements:
                if (xmlElements[i].className) {newElement.classList.add(xmlElements[i].className);}
                if (xmlElements[i].id) {newElement.id = xmlElements[i].id;}
                
                // add new defined classnames in tagConversionMap
                if (mapClassname) {newElement.classList.add(mapClassname);}

                // set ref-links:
                if (tagConversionMap[selector].hasOwnProperty("refAttribute")) {
                    let refAttribute = tagConversionMap[selector]["refAttribute"];
                    let refValue = xmlElements[i].getAttribute(refAttribute);

                    // image source-links:
                    if (selector === "graphic" || selector == "inline-graphic") {
                        newElement.src = (refValue) ? xmlFolder + "/" + refValue : "";
                    }
                    // external url-links:
                    else if (selector === "ext-link") {
                        // handle over specific-use attributes of ext-link
                        if(xmlElements[i].getAttribute("specific-use")) {
                            let specificUseValue = xmlElements[i].getAttribute("specific-use");
                            newElement.setAttribute("data-specific-use", specificUseValue);
                        }
                        newElement.href = (refValue) ? (refValue).trim() : "";
                    // internal id-links:
                    } else {
                        newElement.href = (refValue) ? "#" + (refValue).trim() : "";
                    }
                }
                // set defined attribute to newElement
                if (tagConversionMap[selector].hasOwnProperty("setAttribute")) {
                    let attributeKey = tagConversionMap[selector]["setAttribute"];
                    let attributeValue = xmlElements[i].getAttribute(attributeKey);

                    // transform xml:lang-attribute to lang (html)
                    attributeKey = (attributeKey === "xml:lang") ? "lang" : attributeKey;
                    if(selector === "contrib-group" && attributeValue == null) {
                        // check firstChild of contrib-group:
                        let firstChild = xmlElements[i].firstElementChild;
                        if(firstChild && firstChild.getAttribute("contrib-type") === "author") {
                            attributeValue = "article-contributors";
                        }
                    }
                    // add translate="no" to reference elements ("Literaturverzeichnis"):
                    if(selector === "ref") {attributeValue = "no";}
                    
                    // set attribute to new element:
                    newElement.setAttribute(attributeKey, attributeValue);
                }
                // transfer content
                newElement.innerHTML = xmlElements[i].innerHTML;

                // replace xml-element:
                xmlElements[i].replaceWith(newElement);
            }
        }
        else {
            console.log("Notice: Tag/Element <" + selector + "> not found in XML.");
        }
    }
}

/* classify headline hierarchy:
----------------------------------
 * add headline classes by hierarchy of section-elements
 * @param {HTMLElement} content document-fragment made from original DOM
 * @param {selector} selector css-class-selector for headlines, e.g. ".title"
 * @returns {void}
 */
function addHeadlineClassesBySectionHierarchy(content, selector) {

    // check position in section hierarchy
    let headlines = content.querySelectorAll(selector);
    for (let i = 0; i < headlines.length; i++) {
        let parent = headlines[i].parentElement;
        let level = 0; // no-level at all
        do {
            parent = parent.parentElement;
            level++; // at least 1 (loop always run once)
        }
        while (parent !== null && parent.tagName !== "body");

        // add level as attribute to sections and headlines:
        headlines[i].setAttribute("level", level);
        if(/section/.test(headlines[i].parentElement.tagName)) {
            headlines[i].parentElement.setAttribute("level", level);
        }
        // assign headline classes by level:
        switch (true) {
            case (level === 1):
                headlines[i].classList.add("main-title");
                break;
            case (level === 2):
                headlines[i].classList.add("section-title");
                break;
            case (level > 2):
                headlines[i].classList.add("subsection-title");
                break;
            default:
                headlines[i].classList.add("main-title");
        }
    }
}

/* preload and classify images
-----------------------------------*/
function processImageFiles(documentReloaded) {
    
    let images = document.querySelectorAll("img"); 
    images.forEach((image) => {
        let img = new Image();
        img.onload = function () {
            if(!documentReloaded) {
                preloadImage(image);
            }
            if(image.className === "inline-graphic") {
                img.className = image.className;
                // classify inline-graphic?
                image.setAttribute("data-img-width", img.naturalWidth);
                image.setAttribute("data-img-height", img.naturalHeight);
            }
            else {
                classifyImage(img);
                let figure = image.parentElement;
                image.classList = img.classList;
                figure.classList = img.classList;
                figure.setAttribute("data-img-width", img.naturalWidth);
                figure.setAttribute("data-img-height", img.naturalHeight);
            }
        };
        img.src = image.src;
    });
}

async function preloadImage(image) {

    let dataUrl;
    let img = new Image();
    img.onload = function () {
        let canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        let ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        dataUrl = canvas.toDataURL("image/jpeg", 1.0);
        image.src = dataUrl;
        updateStorageEventListener("Image preloading... " + image.parentElement.id);
    };
    img.onerror = function () {
        image.alt = "Could not convert image: " + img.src;
        img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    };
    img.src = image.src;
}

function classifyImage(image) {

    let sizeClassSetGlobal = false;
    if(localStorage.getItem("sizeClassSetGlobal") !== undefined) {
        sizeClassSetGlobal = localStorage.getItem("sizeClassSetGlobal");
    }

    let width = image.naturalWidth;
    let height = image.naturalHeight;
    let ratio = width / height;
    let total_px = width * height;
    let mega_px = Math.round(total_px) / 1000000;

    let sizeClass;
    if(sizeClassSetGlobal) {
        sizeClass = sizeClassSetGlobal;
    }
    else {
        sizeClass = (mega_px) ? defineClassByImageResolution(mega_px) : false;
    }
    let ratioClass = (ratio) ? defineClassByImageRatio(ratio) : false;

    image.classList.add(sizeClass);
    image.classList.add(ratioClass);
}

function defineClassByImageResolution(mega_px) {

    let sizeClass;
    const imageClassThresholdFactor = 5;
    let imageClassThreshold = localStorage.getItem("imageClassThreshold");
    imageClassThreshold = imageClassThreshold * imageClassThresholdFactor;

    switch (true) {
        case (mega_px > 30 / imageClassThreshold):
            sizeClass = "large";
            break;
        case (mega_px <= 30 / imageClassThreshold && mega_px >= 15 / imageClassThreshold):
            sizeClass = "medium";
            break;
        case (mega_px < 15 / imageClassThreshold):
            sizeClass = "small";
            break;
        default:
            sizeClass = false;
            break;
    }
    return (sizeClass);
}

function defineClassByImageRatio(ratio) {

    let ratioClass;

    switch (true) {
        case (ratio > 1.20):
            ratioClass = "landscape";
            break;
        case (ratio <= 1.20 && ratio >= 0.8):
            ratioClass = "square";
            break;
        case (ratio < 0.8):
            ratioClass = "portrait";
            break;
        default:
            ratioClass = false;
            break;
    }
    return (ratioClass);
}

function toggleFigureClasses(figure, toggleCase) {

    let typesettingClass = figure.classList[typesettingClassListKey];
    let toggleFigureClassesMap = JSON.parse(localStorage.getItem("toggle-figure-classes"))[0];
    let addClass;

    // get addClass from toggleFigureClassesMap:
    if(toggleCase === "figureClass") {
        typesettingClass = /float/.test(typesettingClass) ? "float" : typesettingClass;
        addClass = toggleFigureClassesMap["figureClass"][typesettingClass];
    }
    if(toggleCase === "figureColumnWidth") {
        if(/float/.test(typesettingClass)) {
            addClass = toggleFigureClassesMap["figureColumnWidth"][typesettingClass];
        }
    }
    if(toggleCase === "figureCaption") {
        if(/overmargin/.test(typesettingClass) || /regular/.test(typesettingClass)) {
            addClass = toggleFigureClassesMap["figureCaption"][typesettingClass];
        }
    }
    // save changes in figureMap:
    let figureId = (figure.id) ? figure.id : figure.getAttribute("data-id");
    let figureMap = JSON.parse(localStorage.getItem("figure-map"));
    figureMap[figureId]["typesettingClass"] = addClass;
    figureMap[figureId]["style"] = false;
    localStorage.setItem("figure-map", JSON.stringify(figureMap));

    // replace classes and reassign layout-specs:
    setLayoutSpecsOfFigure(figure, addClass, true);

    // reload document after changes:
    setTimeout(function() {
      window.location.reload();
    }, 2000);
}

function scaleImage(img) {

    let natWidth = img.naturalWidth;
    let natHeight = img.naturalHeight;
    let targetHeight = document.documentElement.clientHeight * 0.9;
    let targetWidth = document.documentElement.clientWidth * 0.5;

    if(natHeight > targetHeight) {
        img.style = "max-width:max-content;max-height:" + targetHeight + "px;";
    }
    else if(natWidth < targetWidth) {
        img.style = "max-height:max-content;max-width:" + natWidth + "px;";
    }
}

/* --------------------------------------
Application or library related functions:
-----------------------------------------*/
function requestSourceFile(path, type) {

    let response;
    let request = new XMLHttpRequest();
    request.open("GET", path);
    request.onreadystatechange = function () {
        if (this.status === 200) {
            response = request.responseText;
        }
        else {
            response = request.responseText;
            errorConsole.append(response);
            document.body.append(errorConsole);
        }
        localStorage.setItem(type, response);
    };
    request.send();
}

function getDocumentStateProperty(propertyKey) {

    let property;
    let documentState;
    let documentStateJSON = localStorage.getItem("documentState");
    if (documentStateJSON) {
        documentState = JSON.parse(documentStateJSON);
        property = documentState[propertyKey];
    } else {
        property = false
    }
    return (property);
}


function getStyleSheetLink(journalId, view) {

    // prepare stylesheetLink element:
    const styleSheetLink = document.createElement('link');
    styleSheetLink.type = 'text/css';
    styleSheetLink.rel = 'stylesheet';

    // define stylesheet src:
    let stylesheet;
    if(view === "pagedView") {
        stylesheet = (journalId === "e-DAI-F") ? "paged-styles-reports" : "paged-styles-journals";
    }
    if(view === "htmlView") {
        stylesheet = "viewer-styles";
    }
    // set stylesheet src
    styleSheetLink.href = 'src/css/' + stylesheet + '.css';

    return (styleSheetLink)
}

function getPosterImageBackgroundUrl() {

    let backgroundUrl = false;
    let posterImage = document.querySelector("#poster-image");
   
    if (posterImage) {
        if(posterImage.firstElementChild.src) {
            backgroundUrl = "url(" + posterImage.firstElementChild.src + ")";
        }
    }
    return (backgroundUrl);
}

function getPropertyFromStylesheet(selector, attribute) {

    let value;
    [].some.call(document.styleSheets, function (sheet) {
        return [].some.call(sheet.rules, function (rule) {
            if (selector === rule.selectorText) {
                return [].some.call(rule.style, function (style) {
                    if (attribute === style) {
                        value = rule.style.getPropertyValue(attribute);
                        return true;
                    }
                    return false;
                });
            }
            return false;
        });
    });
    return value;
}

function getComputedStylesOfTextElements() {

    let documentRoot = document.querySelector(':root');

    // get and parse declared style properties of text-content:
    let paraFont = getComputedStyle(documentRoot).getPropertyValue("--long-text-font-family"); 
    let paraFontSizeDeclared = getComputedStyle(documentRoot).getPropertyValue("--p-font-size");
    let lineHeightDeclaredPara = getComputedStyle(documentRoot).getPropertyValue("--line-height-para");
    let lineHeightPara = (lineHeightDeclaredPara) ? lineHeightDeclaredPara : 1.5; 
    let paraFontSize = (paraFontSizeDeclared) ? paraFontSizeDeclared.slice(0, -2) * 1.333 : 12.5; 
    let heightParagraphLinePx = paraFontSize * lineHeightPara; 

    // get and parse declared style properties of figCaptions:
    let captionFont = getComputedStyle(documentRoot).getPropertyValue("--short-text-font-family");
    let captionFontSizeDeclared = getComputedStyle(documentRoot).getPropertyValue("--caption-font-size");
    let lineHeightDeclaredCap = getComputedStyle(documentRoot).getPropertyValue("--line-height-cap");
    let lineHeightCap = (lineHeightDeclaredCap) ? lineHeightDeclaredCap : 1.37; 
    let captionFontSize = (captionFontSizeDeclared) ? captionFontSizeDeclared.slice(0, -2) * 1.333 : 9.75;
    let heightCaptionLinePx = captionFontSize * lineHeightCap;

    // collect computed styles in object
    let computedTextStyles = {
        "paraFont": paraFont,
        "paraFontSizeDeclared": paraFontSizeDeclared,
        "paraFontSize": paraFontSize,
        "heightParagraphLinePx": heightParagraphLinePx,
        "lineHeightPara": lineHeightPara,
        "lineHeightCap": lineHeightCap,
        "captionFont": captionFont,
        "captionFontSizeDeclared": captionFontSizeDeclared,
        "captionFontSize": captionFontSize,
        "heightCaptionLinePx": heightCaptionLinePx,
    }
    return(computedTextStyles);
}

function getTextWidth(text, font) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.font = font;
    let measures = ctx.measureText(text);
    return(measures.width);
}

function checkQualityOfUrls() {

    if(checkUrlPersistence) {
        // get all anchors with external reference
        let anchors = document.querySelectorAll(
            "a:not(.fig-ref,.fn-ref,.bib-ref,.footnote,.panel-anchors,.heading-ref-a)");
        anchors.forEach(function (anchor) {
            let specificUse = anchor.getAttribute("data-specific-use");
            let href = anchor.href;
             // check anchors without specific usage only: 
            if(specificUse == null || (specificUse !== null 
                && specificUse.search(specificUseRegex) == -1)) {
                if(href.search(urlRegex) === -1) {
                    anchor.classList.add("warning-text");
                    anchor.title = "URL might not be persistent!";
                }
            }
        });
    }
}

function makeElementsInteractive(pageElement) {

    const interactElements = ".text-content,figure";
    let pageContent = pageElement.querySelector(".pagedjs_page_content");
    let elementsOfPage = pageContent.querySelectorAll(interactElements);

    for (let i = 0; i < elementsOfPage.length; i++) {
        let element = elementsOfPage[i];
        if (element.matches("figure")) {
            element.classList.add("resizable");
            element.classList.add("tap-target");
        }
        if (/text-content/.test(element.className)) {
            element.classList.add("tap-target");
        }
    }
}

function controlInteractJs() {

    interact('.resizable')
        .resizable({
            edges: {top: true, left: true, bottom: true, right: true},
            listeners: {
                move: function (event) {
                    let {x, y} = event.target.dataset;
                    x = (parseFloat(x) || 0) + event.deltaRect.left;
                    y = (parseFloat(y) || 0) + event.deltaRect.top;

                    Object.assign(event.target.style, {
                        width: `${event.rect.width}px`,
                        // height: `${event.rect.height}px`,
                        transform: `translate(${x}px, ${y}px)`
                    });

                    Object.assign(event.target.dataset, {x, y});

                    // save styles in figure map:
                    let figureMap = JSON.parse(localStorage.getItem("figure-map"));
                    figureMap[event.target.id]["style"] = event.target.getAttribute('style');
                    localStorage.setItem("figure-map", JSON.stringify(figureMap));

                    // reload
                    setTimeout(function(){
                       window.location.reload();
                    }, 5000);
                }
            },
            modifiers: [
                interact.modifiers.aspectRatio({
                    ratio: "preserve"
                }),
            ],
        });

    interact('.tap-target')
        /* Currently ".on('tap')" fires also in case of "double-tap", awaiting to be fixed:
        https://github.com/taye/interact.js/issues/964 */
        .on('tap', (event) => {
            // fire tap-event (one click) when slowly clicked (dt=delay-time)
            if(event.dt >= 80 && event.dt <= 500) {
                if(event.currentTarget.tagName === "FIGURE") {
                    toggleFigureClasses(event.currentTarget, "figureColumnWidth");
                }
                if(/text-content/.test(event.currentTarget.className)) {

                    if(/styled-flag/.test(event.currentTarget.className)) {
                        event.currentTarget.style = "";
                        event.currentTarget.classList.remove("styled-flag");
                        updateTextContentMap(event.currentTarget.id, "class", false);
                        updateTextContentMap(event.currentTarget.id, "style", false);
                    }
                    else {
                        event.currentTarget.style.marginTop = "5mm";
                        event.currentTarget.style.letterSpacing = "0.25px";
                        event.currentTarget.classList.add("styled-flag");
                        updateTextContentMap(event.currentTarget.id, "class", "styled-flag");
                        updateTextContentMap(event.currentTarget.id, "style", "margin-top:5mm;letter-spacing:0.25px;");
                    }
                }
            }
            // skip tap-event (one click) if double-tap fires:
            else {
                event.stopImmediatePropagation();
            }
            event.preventDefault();
        })
        .on('doubletap', function (event) {
            if(event.double && event.dt < 500) {
                if(event.currentTarget.tagName === "FIGURE") {
                    toggleFigureClasses(event.currentTarget, "figureClass");
                }
            }
            event.preventDefault();
        })
        .on('hold', function (event) {
            if(event.currentTarget.tagName === "FIGURE") {
                toggleFigureClasses(event.currentTarget, "figureCaption");
            }
            event.preventDefault();
        })
}

function dragMoveListener(event) {
    var target = event.target
    // keep the dragged position in the data-x/data-y attributes
    var x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx
    var y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy

    // translate the element
    target.style.transform = 'translate(' + x + 'px, ' + y + 'px)'

    // update the posiion attributes
    target.setAttribute('data-x', x)
    target.setAttribute('data-y', y)
}
/**
 * Convert URLs in a string to anchor links
 * @param {!string} string
 * @returns {!string}
 */
function URLifyString(string){

    const urls = string.match(/((((ftp|https?):\/\/)|(w{3}\.))[\-\w@:%_\+.~#?,&\/\/=]+)/g);
    if (urls) {
        urls.forEach(function (url) {
            string = string.replace(url, '<a class ="ext-ref" target="_blank" href="' + url + '">' + url + "</a>");
        });
    }
    return(string);
}

function generateQRCode(url) {

    if (url) {
        let qrcodeContainer = document.getElementById("qrcode");
        new QRCode(qrcodeContainer, url);
        document.getElementById("qrcode").style.display = "block";
    };
}

/** Reload in place script: scroll to last window-position
 *  source: https://gitlab.coko.foundation/pagedjs/pagedjs-plugins/pagedjs-plugins/-/blob/main/public/plugins/reload-in-place.js
 *  @param
 *  @returns
 */
function scrollToLastPosition() {

    document.body.classList.add("blur");
    let scrollPosition = getDocumentStateProperty("scrollPosition");
    let scrollLeft = scrollPosition[0]; // X-axe
    let scrollTop = scrollPosition[1];  // Y-axe

    let winHeight = window.innerHeight || (document.documentElement || document.body).clientHeight
    window.currentInterval = setInterval(function() {
        let docHeight = getDocHeight();

        if (scrollTop > 0 && scrollTop > docHeight - winHeight) {
            window.scrollTo(scrollLeft, docHeight);
        } else {
            window.scrollTo(scrollLeft, scrollTop);
            clearInterval(window.currentInterval);
            setTimeout(function() {
                window.scrollTo(scrollLeft, scrollTop);
                document.body.classList.remove("blur");
            }, 100);
        }
    }, 50);

    // slow down a bit save position pace
    let slowSave = debounce(function() {
        saveAmountScrolled();
    }, 100);

    // Scroll triggers save, but not immediately on load
    setTimeout(function() {
        window.addEventListener('scroll', slowSave);
    }, 1000);
}

function getDocHeight() {
    let doc = document;
    return Math.max(
        doc.body.scrollHeight, doc.documentElement.scrollHeight,
        doc.body.offsetHeight, doc.documentElement.offsetHeight,
        doc.body.clientHeight, doc.documentElement.clientHeight
    )
}

function saveAmountScrolled() {

    let scrollTop = window.pageYOffset || (document.documentElement || document.body.parentNode || document.body).scrollTop;
    let scrollLeft = window.pageXOffset || (document.documentElement || document.body.parentNode || document.body).scrollLeft;

    let documentId = getDocumentStateProperty("documentId");
    let documentState = {
        "documentId": documentId,
        "scrollPosition": [scrollLeft, scrollTop]
    };
    localStorage.setItem("documentState", JSON.stringify(documentState));
}

function debounce(func, wait, immediate) {
    var timeout;
    return function() {
        var context = this,
            args = arguments;
        var later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
}

/* ----------------------
Download related function:
-----------------------*/

function downloadDocumentConfig() {

    // define document json:
    let documentId = getDocumentStateProperty("documentId");
    let figureMap = localStorage.getItem("figure-map");
    let textContentMap = localStorage.getItem("text-content-map");
    let json = {
        "documentId": documentId,
        "figure-map": JSON.parse(figureMap),
        "text-content-map": JSON.parse(textContentMap)
    }
    let filename = documentId + ".json";
    download(JSON.stringify(json), "text/json", filename);
}

function downloadHTMLDocument() {

    let confirmDownload = confirm("Download this document as HTML-file?");
    if (confirmDownload) {
        let documentRoot = document.querySelector(':root');
        let styles = getComputedStyle(documentRoot);
        let journalColor = styles.getPropertyValue("--journal-color"); 
        let documentId = getDocumentStateProperty("documentId");
        let lang = localStorage.getItem("documentLang");
        let viewerStyles = localStorage.getItem("viewer-styles");
        let documentBody = document.body.outerHTML;
        let htmlDocument = 
        "<html lang = '" + lang + "'>" +
            "<head>" +
            " <meta name='--journal-color' content='" + journalColor + "'>" +
            "  <link rel='preconnect' href='https://fonts.googleapis.com'>" +
            "  <link rel='preconnect' href='https://fonts.gstatic.com' crossorigin>" +
            "  <link href='https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,100..900;1,100..900&display=swap' rel='stylesheet'>" +
            "  <link href='https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,100..900;1,100..900&display=swap' rel='stylesheet'></link>" +
            "  <link href='https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet'></link>" +
            "  <script>" + fallbackScript + "</script>" +
            "  <script type='text/javascript' src='https://cdn.jsdelivr.net/npm/medium-zoom@1.1.0/dist/medium-zoom.min.js'></script>" +
            "  <script type='text/javascript' onerror='this.onerror=null;fallback();' src='/src/js/htmlViewController.js'></script>" +
            "  <style>" + viewerStyles + "</style>" +
            "</head>" +
            documentBody +
        "</html>";
    
        let filename = documentId + ".html";
        download(htmlDocument, "text/html", filename);
        console.log(htmlDocument);
    };
}

function download(content, type, filename) {

     // create blob and download link:
     const blob = new Blob([content], { type: type });
     const link = document.createElement("a");
     link.download = filename;
     link.href = window.URL.createObjectURL(blob);
     link.dataset.downloadurl = [type, link.download, link.href].join(":");
 
     // proceed download by adding click event:
     const evt = new MouseEvent("click", {
         view: window,
         bubbles: true,
         cancelable: true,
     });
 
     link.dispatchEvent(evt);
     link.remove();
}
