/** internal script libraries:
 * @type {HTMLScriptElement}
 */

// viewer-script
const renderAsPDFScript = document.createElement('script');
renderAsPDFScript.type = 'text/javascript';
renderAsPDFScript.src = 'src/js/renderAsPDF.js';

// viewer-script
const renderAsViewerScript = document.createElement('script');
renderAsViewerScript.type = 'text/javascript';
renderAsViewerScript.src = 'src/js/renderAsViewer.js';

// setup-script
const setupScript = document.createElement('script');
setupScript.type = 'text/javascript';
setupScript.src = 'src/js/setup.js';

/** external script libraries:
 * @type {HTMLScriptElement}
 */

// pagedJs-script
const pagedJsScript = document.createElement('script');
pagedJsScript.type = 'text/javascript';
pagedJsScript.src = "src/js/pagedjs.js"  // 'https://unpkg.com/pagedjs/dist/paged.polyfill.js';

// interactJs-script
const interactJsScript = document.createElement('script');
interactJsScript.type = 'text/javascript';
interactJsScript.src = 'https://cdn.jsdelivr.net/npm/interactjs/dist/interact.min.js';

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
qrcodejs.src = "https://cdn.rawgit.com/davidshimjs/qrcodejs/gh-pages/qrcode.min.js";

// application configs:
const progressBar = document.createElement("div");
progressBar.id = "progressBar";
const defaultJournal = "AA";

/** define window.document function:
 * @type {HTMLScriptElement}
 */
document.addEventListener("readystatechange", (event) => {

    if (event.target.readyState === "interactive") {

        // request tagConversionMap, journals.json and figureConstellations:
        requestSourceFile("configs/tagConversionMap.json", "tag-conversion-map");
        requestSourceFile("configs/journals.json", "journals-config");
        requestSourceFile("configs/figConstellations.json", "fig-constellations");

        // checkout xml-path
        if (document.querySelector('meta[name="--xml-file"]') !== null) {

            // request jats.xml:
            let xmlFile = document.querySelector('meta[name="--xml-file"]').content;
            let xmlPath = xmlFolder + "/" + xmlFile;
            requestSourceFile(xmlPath, "jats-xml");

            // prepare document:
            let xmlRequest = localStorage.getItem("jats-xml");
            if (!xmlRequest.match(/ERROR/)) {
                // prepare document text:
                let xml = localStorage.getItem("jats-xml");

                // replace nested <sec>-elements with <section>-tag before:
                xml = xml.replaceAll("<sec", "<section")
                    .replaceAll("</sec>", "</section>");

                // create XML-document:
                let parser = new DOMParser();
                let xmlDoc = parser.parseFromString(xml, "text/xml");

                // prepare document properties:
                let documentId = getDocumentStateProperty("documentId");
                let articleId;
                if(xmlDoc.querySelector("article-id[pub-id-type='doi']") !== null) {
                    articleId = xmlDoc.querySelector("article-id[pub-id-type='doi']").textContent;
                }
                else {articleId = "DocumentWithoutId"};
 
                // checkout reload of previous document
                if (!documentId || documentId !== articleId) {
                    let documentState = {
                        "documentId": articleId,   // commonly a doi-url
                        "scrollPosition": [0, 0]     // x- and y-coordinates
                    }
                    localStorage.setItem("documentState", JSON.stringify(documentState));
                }

                // get and add language code to html (short form):
                let lang = xmlDoc.querySelector("article").getAttribute("xml:lang");
                lang = (lang) ? lang.slice(0, 2) : "de";
                document.documentElement.setAttribute("lang", lang);

                // convert xml to htmlContentBody:
                let htmlContentBody = convertXMLToHtmlBody(xmlDoc);
                console.log("htmlContentBody", htmlContentBody);
                document.body.innerHTML = htmlContentBody.outerHTML;
            }
            else {
                document.body.innerHTML = xmlRequest;
                throw new Error(xmlRequest);
            }
        }
        else {
            document.body.innerHTML =
                "<div>ERROR:<br>No xml-file given! Checkout index.html: meta[name=\"--xml-file\"]";
            throw new Error();
        }
    
        // define journal related properties:
        let journalId = document.querySelector(".journal-id").textContent;
        let journalConfigs = JSON.parse(localStorage.getItem("journals-config"))[0];
        let journalKey = (journalConfigs[journalId]) ? journalId : defaultJournal;
        let journalColor = journalConfigs[journalKey]["journal-main-color"];
        localStorage.setItem("journal-config", JSON.stringify(journalConfigs[journalId]));

        // preload and classify images:
        let images = document.querySelectorAll("img");
        let sizeClassSetGlobal = false;
        if(localStorage.getItem("sizeClassSetGlobal") !== undefined) {
            sizeClassSetGlobal = localStorage.getItem("sizeClassSetGlobal");
        }

        images.forEach((image, index) => {
            let img = new Image();
            let resolve, reject;
            let imageLoaded = new Promise(function (r, x) {
                resolve = r;
                reject = x;
            });
            // classify image:
            img.onload = function () {
                classifyImage(img, sizeClassSetGlobal);
                let figure = image.parentElement;
                image.classList = img.classList;
                figure.classList = img.classList;
                figure.setAttribute("data-img-width", img.naturalWidth);
                figure.setAttribute("data-img-height", img.naturalHeight);
                resolve();
            };
            img.onerror = function (img) {
                console.log("error: ", img);
                reject();
            };
            img.src = image.src;
        });

        // add style properties to documentRoot:
        let documentRoot = document.querySelector(':root');
        documentRoot.style.setProperty('--journal-color', journalColor);
        documentRoot.style.setProperty('--background-url', getPosterImageBackgroundUrl());

        // add styles and render scripts:
        let styleSheetLink = getStyleSheetLink(journalId);

        // switch between pdf and viewer-format
        if (localStorage.getItem("renderAs") === "PDF") {
           
            // prevent auto start of pagedJs previewer:
            window.PagedConfig = { auto: false };

            // set default imageSizeClass
            if (localStorage.getItem("imageClassThreshold") === undefined) {
                localStorage.setItem("imageClassThreshold", imageClassThresholdDefault);
            }
            document.head.appendChild(styleSheetLink);
            document.head.appendChild(renderAsPDFScript);
            document.head.appendChild(pagedJsScript);
        }
        else if(localStorage.getItem("renderAs") === "Viewer") {
            document.head.appendChild(renderAsViewerScript);
        }
        else {
            document.head.appendChild(setupScript);
        }

        // add third-party libraries
        document.head.appendChild(interactJsScript);
        document.head.appendChild(highlightJsCSSLink);
        document.head.appendChild(highlightJsScript);
        document.head.appendChild(qrcodejs);
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
        // viewer
        else if(localStorage.getItem("renderAs") === "Viewer") {
            hljs.highlightAll();
        }
        // setup
        else {
            document.body.innerHTML = "Setup mode...(see console)!";
        }   
    }
});

/** define window event listener:
 * @type {HTMLScriptElement}
 */

// define keyboard control settings:
document.addEventListener('keyup', function (e) {

    // press r for reload
    if (e.key === "r") {
        window.location.reload();
    }

    // press q for hard reset (refresh figureMap)
    if (e.key === "q") {
        localStorage.removeItem('figure-map');
        localStorage.removeItem('documentState');
        window.location.reload();
    }

    // press p to set "renderAs" to "PDF"
    if (e.key === "p") {
        localStorage.setItem("renderAs", "PDF");
        window.location.reload();
    }

    // press v to set "renderAs" to "Viewer"
    if (e.key === "v") {
        localStorage.setItem("renderAs", "Viewer");
        window.location.reload();
    }

    // press * to set "renderAs" to "Setup"
    if (e.key === "*") {
        localStorage.setItem("renderAs", "Setup");
        window.location.reload();
    }

    // press f to highlight figRefs:
    if (e.key === "f") {
        let highlightElements = document.querySelectorAll("a.fig-ref");
        for (let i = 0; i < highlightElements.length; i++) {
            highlightElements[i].style.background = "rgb(250 250 172)";
        }
    }

    // press h to highlight context information of elements:
    if (e.key === "h") {
        let highlightElements = document.querySelectorAll(".content-paragraph, .title");
        for (let i = 0; i < highlightElements.length; i++) {
            highlightElements[i].classList.add("display-data-attributes");
        }
    }

    // press o to see overflowing elements of pagedjs-page-content:
    if (e.key === "o") {
        let pageContents = document.querySelectorAll(".pagedjs_page_content");
        for (let i = 0; i < pageContents.length; i++) {
            pageContents[i].style.display = "flex";
        }
    }

    // press t(op) to push figure on topOfPage:
    if (e.key === "t") {
        if (document.querySelector(".active") !== null) {
            let figure = document.querySelector(".active").parentElement;
            let figureId = figure.id;
            figure.classList.toggle("onTopOfPage");

            let figureMap = JSON.parse(localStorage.getItem("figure-map"));
            figureMap[figureId]["style"] = false;
            figureMap[figureId]["positionClass"] = "onTopOfPage";
            localStorage.setItem("figure-map", JSON.stringify(figureMap));
            setTimeout(function () {
                window.location.reload();
            }, 1000);
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

    
    /* define figureClasses by presets defined in keyboard control settings (main.js)
    let imageClassThreshold = localStorage.getItem("imageClassThreshold");
    if(imageClassThreshold === "1") {
        assignLayoutSpecsToFigure(firstFigure, "float-w-col-2");
        reassignLayoutSpecsByGivenClass(secondFigure, "float-w-col-2")
    }
    if(imageClassThreshold === "9") {
        assignLayoutSpecsToFigure(firstFigure, "overmargin");
        reassignLayoutSpecsByGivenClass(secondFigure, "overmargin");
    }
    */

});

// handle processStage by storage listener:
window.addEventListener("storage", () => {
    progressBar.style = "color:white;text-shadow: 1px 1px 2px black;";
    document.body.prepend(progressBar);
    let processStage = localStorage.getItem("processStage");
    initProgressBar(processStage);
});

/** convert JATS-XML and prepare HTML
 * @type {HTMLScriptElement}
 */

function requestSourceFile(path, type) {

    let response;
    let request = new XMLHttpRequest();
    request.open("GET", path);
    request.onreadystatechange = function () {
        if (this.status === 200) { response = request.responseText; }
        else {
            response = request.responseText +
            "<div>ERROR => File: " + path + "</div>";
        }
        localStorage.setItem(type, response);
    };
    request.send();
}

function convertXMLToHtmlBody(xmlDoc) {

    let tagConversionMap = JSON.parse(localStorage.getItem("tag-conversion-map"))[0];
    let xmlBody = xmlDoc.getElementsByTagName("body")[0];
    let xmlFront = xmlDoc.getElementsByTagName("front")[0];
    let xmlBack = xmlDoc.getElementsByTagName("back")[0];
    xmlBody.appendChild(xmlFront)
    xmlBody.appendChild(xmlBack);

    // pre-check: find id-less paragraphs with fig-refs:
    let idLessParagraphs = xmlBody.querySelectorAll("p:not(p[id])");
    for (let i = 0; i < idLessParagraphs.length; i++) {
        if(idLessParagraphs[i].querySelectorAll("xref[ref-type='fig']").length) {
            // assing randomId to paragraph-element:
            idLessParagraphs[i].id = "generatedId-" + Math.floor(Math.random() * 100);
            // shout out Warning message:
            console.log("Warning: Element with tag <p> has no id-attribute! \n" + 
            "Random-ID assigned to XML-Element \n" + idLessParagraphs[i].outerHTML);
        };
    }

    // convert selectors as defined in tagConversionMap:
    for (let selector in tagConversionMap) {
        let tagName = tagConversionMap[selector]["tagName"];
        let classname = tagConversionMap[selector]["className"];

        if (xmlBody.querySelectorAll(selector).length !== 0) {
            let xmlElements = xmlBody.querySelectorAll(selector);

            for (let i = 0; i < xmlElements.length; ++i) {
                // create new element with ids and classNames:
                let newElement = document.createElement(tagName);
                if (xmlElements[i].id) { newElement.id = xmlElements[i].id; }
                if (classname) { newElement.classList.add(classname); }

                // set ref-links:
                if (tagConversionMap[selector].hasOwnProperty("refAttribute")) {
                    let refAttribute = tagConversionMap[selector]["refAttribute"];
                    let refValue = xmlElements[i].getAttribute(refAttribute);

                    if (selector === "graphic") {
                        // image source-links:
                        newElement.src = (refValue) ? xmlFolder + "/" + refValue : "";
                    } else if (selector === "ext-link") {
                        // external url-links:
                        newElement.href = (refValue) ? (refValue).trim() : "";
                    } else {
                        // internal id-links:
                        newElement.href = (refValue) ? "#" + (refValue).trim() : "";
                    }
                }
                // set defined attribute to newElement
                if (tagConversionMap[selector].hasOwnProperty("setAttribute")) {
                    let attributeKey = tagConversionMap[selector]["setAttribute"];
                    let attributeValue = xmlElements[i].getAttribute(attributeKey);
                    newElement.setAttribute(attributeKey, attributeValue);
                }
                // transfer content and replace xml-element:
                newElement.innerHTML = xmlElements[i].innerHTML;
                xmlElements[i].replaceWith(newElement);
            }
        }
        else {
            console.log("Notice: Tag/Element <" + selector + "> not found in XML.");
        }
    }

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

    // wrap xmlBody as htmlContentBody
    let htmlContentBody = document.createElement('div');
    htmlContentBody.classList.add("content-body");
    htmlContentBody.innerHTML = xmlBody.innerHTML;
    return (htmlContentBody);
}

/* element classifiers
------------------------*/
function classifyImage(image, sizeClassSetGlobal) {

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

/* application related functions:
-----------------------------------*/
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

function getStyleSheetLink(journalId) {

    // prepare stylesheetLink element:
    const styleSheetLink = document.createElement('link');
    styleSheetLink.type = 'text/css';
    styleSheetLink.rel = 'stylesheet';

    // define stylesheet src
    let stylesheet = (journalId === "e-DAI-F") ? "print-styles-berichte" : "print-styles-journals";

    // set stylesheet src
    styleSheetLink.href = 'src/css/' + stylesheet + '.css';

    return (styleSheetLink)
}

function getPosterImageBackgroundUrl() {

    let backgroundUrl = false;
    let posterImage = document.querySelector("#poster-image");
   
    if (posterImage) {
        let url = posterImage.firstElementChild.src;

        // test url for invalid characters, e.g. ()
        if(/[(){}<>?~;,]/.test(url)) {
            console.log("Error: background-URL contains invalid characters \"(){}<>?~;,\" \n", 
                posterImage.firstElementChild.src);
        }
        else {
            backgroundUrl = "url(" + posterImage.firstElementChild.src + ")";
        }
    }
    return (backgroundUrl);
}



