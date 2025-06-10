/** ------------------------
* CONSTANTS
----------------------------*/
const resTypeClassListKey = 0;
const ratioClassListKey = 1;
const typesettingClassListKey = 2;
const pageSpaceBuffer = 0.9;
const virtualMarginBuffer = 1;
const minDistanceFromNodeTop = 0;
const maxPageContentHeight = 907;
const pageFigureMax = 2;
const noOrphanArea = 75;

/** ------------------------------
 * control pagedJs-Handler (Hook), documentation: 
 * https://pagedjs.org/documentation/10-handlers-hooks-and-custom-javascript/
 * -------------------------------
 */
function controlPagedJsHandler() {

    class pagedJsHandler extends Paged.Handler {

        constructor(chunker, polisher, caller) {
            super(chunker, polisher, caller);
        }

        /** Chunker beforeParsed:
         *  runs on content before it is parsed and given IDs
         *  content → document-fragment made from the original DOM
         */
        beforeParsed(content) {
            // create article and replace content
            updateStorageEventListener("Create PDF article...");
            let article = createPagedArticle(content);
            content.replaceChildren();
            content.append(article);
        }

        /** Chunker: afterParsed:
         *  runs after the content has been parsed but before rendering has started
         *  parsed → content once parsed and given ids (data-ref and break rules from the css)
         */
        afterParsed(parsed) {
            let documentId = getDocumentStateProperty("documentId");
            let previousParaMap = JSON.parse(localStorage.getItem("text-content-map"));
            if (previousParaMap && previousParaMap["documentId"] === documentId) {
                createTextContentMap(parsed, previousParaMap);
            }
            else {
                createTextContentMap(parsed, false);
            }
         
            let previousFigMap = JSON.parse(localStorage.getItem("figure-map"));
            if (previousFigMap && previousFigMap["documentId"] === documentId) {
                createFigureMap(parsed, previousFigMap);
            }
            else {
                createFigureMap(parsed, false);
            }
        }

        /** Layout: render node
         *   When a node is rendered
         *  (renderNode is the cloned node that is added to the DOM)
         */
        renderNode(sourceNode, renderNode, Layout) {

            if (sourceNode && sourceNode.nodeType == Node.ELEMENT_NODE) {
                // get textContentMap and parsedContent:
                let textContentMap = JSON.parse(localStorage.getItem("text-content-map"));
                delete textContentMap["documentId"];  // skip documentId:
                let parsedContent = Layout.hooks.afterParsed.context.source.firstChild;

                // handle layout of text-content-elements:
                if(textContentMap[sourceNode.id] !== undefined && !textContentMap[sourceNode.id]["isSet"]) {
                    // define nodeParams (e.g. position on page, figure references):
                    let nodeParams = defineSourceNodeParameter(sourceNode, renderNode, parsedContent);
                
                    // exclude figures for defined paragraphs (first text page):
                    if(nodeParams["contexts"]["pageId"] == firstTextPageId) {
                        if(nodeParams["currentFigure"]) {
                            pushFigRefToNextNode(sourceNode.id, nodeParams["currentFigure"].id);
                            console.log("push: ", nodeParams["currentFigure"].id)
                        }
                        if(nodeParams["nextFigure"]) {
                            console.log("push: ", nodeParams["nextFigure"].id)
                            pushFigRefToNextNode(sourceNode.id, nodeParams["nextFigure"].id);
                        }
                    }
                    // process figure enhancing:
                    else {
                        processFigureEnhancing(nodeParams);
                    }    

                    // handle over rest of figRefs which exceeds the limit maxNumFigures
                    let maxNumFigures = 2; // limit of figures, each one single node can handle
                    if(nodeParams["figRefs"]) {
                        for (let i = maxNumFigures; i < nodeParams["figRefs"].length; i++) {
                            pushFigRefToNextNode(sourceNode.id, nodeParams["figRefs"][i]);
                        }
                    }
                    // set isSet flag in text-content-map:
                    updateTextContentMap(sourceNode.id, "isSet", true);
                }
                // define contexts of figure elements:
                else if(/FIGURE/.test(sourceNode.tagName)) {
                    let contexts = definePageContextsOfSourceNode(sourceNode);
                    contexts = calculateNodeDistances(contexts, sourceNode);
                    setPageContextsAsElementAttribute(contexts, sourceNode, renderNode);
                }
                // adjust layout of appendix titles:
                else {
                    adjustLayoutOfAppendixTitles(sourceNode);
                }
            }
        }

        /** Chunker: afterPageLayout
         *  runs after a single page has gone through layout, and allows adjusting the breakToken
         *  pageElement → page element that just been rendered,
         *  page → node of the page being rendered,
         *  breakToken → location of the beginning of the overflow
         */
        afterPageLayout(pageElement, page, breakToken) {

            updateStorageEventListener("Render " + page.id + "...");

            // ignore hyphenation by pagedJs:
            ignoreHyphenationByPagedJs(pageElement, page, breakToken);

            // classify if elements are rendered on left or right page:
            classifyPageOfElements(pageElement, 
                "figure,.fig-number,.boxed-text,.meta-section,#endnotes-section");

            // classify position of elements on page:
            classifyElementPositionOnPage(pageElement,".text-content,figure");

            // push figure element on top of page:
            pushFigureElementOnTopOfPage(pageElement, 
                "p,.title,table,ol,ul,li,figure,figCaption,pre,.boxed-text");

            // set figCaptions as block element after page rendering:
            let pageContent = pageElement.querySelector(".pagedjs_page_content");
            let figCaptions = pageContent.querySelectorAll("figcaption");
            for (let i = 0; i < figCaptions.length; i++) {
                figCaptions[i].style.display = "block";
            }

            // urlify plain url-strings in footnote spans:
            let footnoteSpans = pageElement.querySelectorAll(".footnote");
            for (let i = 0; i < footnoteSpans.length; i++) {
                let element = footnoteSpans[i];
                element.innerHTML = URLifyString(element.innerText);
            }
            // check urls:
            checkQualityOfUrls();

            // test calculations of node distances (see console)
            if(devMode) {
                testCalculationsOfNodeDistances(pageElement);
            }
        }

        /** Chunker: afterRendered
         *  runs after all pages have finished rendering
         *  pages → array that contains all page nodes
         */
        afterRendered(pages) {
            if(pages) {
                updateStorageEventListener("Ready");
                let documentId = getDocumentStateProperty("documentId");
                let url = documentId;
                url = (/https:/.test(url)) ? url : "https://doi.org/" + url;
                generateQRCode(url);
            }

            // add mouseover event class to typeset figures:
            document.querySelectorAll("FIGURE").forEach(element => {
                if(element.firstElementChild !== null) {
                    element.firstElementChild.addEventListener("mouseover", () => {
                        element.firstElementChild.classList.toggle('active');
                    })
                    element.firstElementChild.addEventListener("mouseout", () => {
                        element.firstElementChild.classList.remove('active');
                    })
                }
            });
            // remove last page if cloned images container is empty:
            let removePage = true;
            let clonedImagesContainer = document.querySelector("#cloned-images-container");
            if(clonedImagesContainer !== null) {
                // check if cloned images container is empty
                clonedImagesContainer.childNodes.forEach(element => {
                    if(/FIGURE/.test(element.tagName)) {
                        removePage = false;
                    }});
                // remove page
                if(removePage) {
                    let page = clonedImagesContainer.closest(".pagedjs_page");
                    page.remove();
                }
            }
        }
    }
    Paged.registerHandlers(pagedJsHandler);
}
/* -----------------------------
Prepare elements of PDF article
--------------------------------*/
/**
 * create article-html for pdf rendering:
 * @param {DocumentFragment} content: document-fragment made from the original DOM
 * @returns {HTMLElement} article element: extensively enriched with all content- and meta-sections 
 * used in dai-journal-article 
 */
function createPagedArticle(content) {

    // create article with documentId:
    let article = document.createElement("article");
    let documentId = getDocumentStateProperty("documentId");
    article.id = (documentId) ? documentId : "no-id";

    // define short title information for margin-sections:
    let articleTitle = content.querySelector(".article-title").textContent;
    let documentRoot = document.querySelector(':root');
    documentRoot.style.setProperty('--article-title', "'" + articleTitle + "'");

    // generate components from src-content:
    let coverPage = createCoverPage(content);
    let titlePage = createTitlePage(content);
    let referenceList = createReferenceList(content);
    let transAbstractSection = createAbstractSection(content, ".trans-abstract");
    let contributorsDetails = createContributorsDetails(content, true);
    let articleMetaSection = createArticleMetaSection();
    let imprintSection = createImprintSection(content);
    let tocList = createToCFromHeadings(content);
    let figureSection = recreateFiguresSection(content);
    let sourceOfIllustrations = createSourceOfIllustrations(figureSection);

    // remove poster-image from figureSection:
    if(figureSection.querySelector("#poster-image") !== null) {
        figureSection.querySelector("#poster-image").remove();
    }

    // format notes as foot- or endnotes:
    let noteSection = document.createElement("div");
    if(content.querySelector(".footnotes-section") !== null) {
        if (setEndnotes) {
            noteSection = content.querySelector(".footnotes-section");
            noteSection.id = "endnotes-section";
            noteSection.classList.remove("footnotes-section");
        } else {
            reformatFootnotes(content);
        }
    }

    // clean up list elements (from internal paragraphs)
    if(content.querySelectorAll("li") !== null) {
        let listElements = content.querySelectorAll("li");
        listElements.forEach(function (element) {
            if(element.firstElementChild !== null &&
            element.firstElementChild.tagName === "P") {
                element.innerHTML = element.firstElementChild.innerHTML;
            }
        });
    }

    // collect appendices in meta-element:
    let meta = document.createElement("div");
    meta.classList.add("meta-section");
    meta.appendChild(sourceOfIllustrations);
    if(transAbstractSection) {
        meta.appendChild(transAbstractSection);
    }
    meta.appendChild(articleMetaSection);
    meta.appendChild(contributorsDetails);
    meta.appendChild(imprintSection);
    if(createToC) {
        meta.appendChild(tocList);
    }
    // append all sections to article:
    article.appendChild(coverPage);
    article.appendChild(titlePage);
    article.innerHTML += content.querySelector
        ("#content-body").outerHTML;
 
    article.appendChild(referenceList);
    article.append(noteSection);
    article.appendChild(meta);
    article.append(figureSection);

    // remove or hide redundant elements:
    if(article.querySelector(".front") != null) {
        article.querySelector(".front").remove();
    }
    if(article.querySelector(".back") !== null) {
        article.querySelector(".back").remove();
    }
    if(article.querySelector("#images-container") !== null) {
        article.querySelector("#images-container").remove();
        article.querySelector("#cloned-images-container > .title").remove();
    }
    return (article);
}

/**
 * create cover-page as div-element:
 * @param {DocumentFragment} content: document-fragment made from original DOM
 * @returns {HTMLElement} coverPage with abstractSection
 */
function createCoverPage(content) {

    let coverPage = document.createElement("div");
    coverPage.className = "cover-page";

    let abstractSection;
    abstractSection = createAbstractSection(content, ".abstract");
    if(!abstractSection) {
        abstractSection = document.createElement("div");
        abstractSection.classList.add("abstract");
        abstractSection.innerHTML = "[ABSTRACT MISSING]";
    }
    coverPage.append(abstractSection);
    return (coverPage);
}

/**
 * create abstractSection:
 * @param {DocumentFragment} content: document-fragment made from original DOM
 * @param {string} selector: class-selector of abstractType, e.g.
 * .abstract, .trans-abstract
 * @returns {HTMLElement} abstract with abstract information and keywords.
 */
function createAbstractSection(content, selector) {

    let abstract = content.querySelector(selector);
    if(abstract !== null) {
        // re-classify abstractHeadline
        let abstractHeadline = abstract.querySelector(".title");
        if(abstractHeadline !== null) {
            if(selector === ".abstract") {
                abstractHeadline.classList.add("abstract-headline");
            }
            else {
                abstractHeadline.classList.add("title-appendix");
            }
            abstractHeadline.classList.remove("title");
        }
        // check maxLength of abstractText
        let abstractText = abstract.querySelectorAll(".abstract-text");
        if (abstractText.length > 0) {
            checkMaxLengthOfInnerText(abstractText[0], maxAbstractLength);
        }
        // add keywordsSection
        let keywordsSection = document.createElement("div");
        keywordsSection.classList.add("kwd-group");
        let kwdGroup = content.querySelectorAll(".kwd-group");
        if(kwdGroup.length) {
            for (let i = 0; i < kwdGroup.length; i++) {
                let keywordsLang = kwdGroup[i].getAttribute("lang");
                let abstractLang = abstract.getAttribute("lang");
                // if keywords correspond to abstractLang
                if(keywordsLang === abstractLang) {
                    kwHeadline = kwdGroup[i].querySelector(".title");
                    if(kwHeadline !== null) {
                        kwHeadline.classList.add("keywords-headline");
                        keywordsSection.appendChild(kwHeadline);
                    }
                    let keywords = kwdGroup[i].querySelectorAll(".keyword");
                    // add each keyword (span> to keywordSection:
                    for (let i = 0; i < keywords.length; i++) {
                        let lastIndex = keywords.length-1;
                        if(i !== lastIndex) {
                            // separate spans with comma except last kwd:
                            keywords[i].textContent = keywords[i].textContent + ", ";
                        }
                        keywordsSection.appendChild(keywords[i]);
                    }
                }
            }
        }
        else {
            keywordsSection.innerHTML = "[KEYWORDS MISSING]";
        }
        abstract.append(keywordsSection);

        // clean up abstract from empty paragraphs:
        let paragraphs = abstract.querySelectorAll("p");
        for (let i = 0; i < paragraphs.length; i++) {
            if(!paragraphs[i].childNodes.length
            || paragraphs[i].innerText.trim() == '') {
                paragraphs[i].remove();
            }
        }
    }
    return(abstract)
}

/**
 * create titlePage: upper part of first page with text:
 * @param {DocumentFragment} content document-fragment made from original DOM
 * @returns {HTMLElement} titlePage as div-container with title and contributors
 */
function createTitlePage(content) {

    // get title information:
    let title = content.querySelector(".article-title");
    let subtitle = content.querySelector(".subtitle");
    let lang = document.documentElement.lang;

    // get article contributors (e.g. authors):
    let authors = [];
    let contributors = [];
    if(content.querySelector(".contrib-group[content-type='article-contributors']") !== null) {
        let articleContributors = content.querySelector(".contrib-group[content-type='article-contributors']");
        authors = articleContributors.querySelectorAll(".contrib[contrib-type='author']");
        contributors = articleContributors.querySelectorAll(".contrib[contrib-type='co-author']");
    }
    // collect names of each author:
    let authorsCollection = [];
    if(authors.length) {
        for (let i = 0; i < authors.length; i++) {
            let givenName;
            let surName;
            if(authors[i].querySelector(".given-names") !== null) {
                givenName = authors[i].querySelector(".given-names").textContent;
            }
            if(authors[i].querySelector(".surname") !== null) {
                surName = authors[i].querySelector(".surname").textContent;
            }
            authorsCollection.push(givenName + " " + surName);
        }
    }
    // collect names of each contributor (e.g. co-author):
    let contributorsCollection = [];
    if(contributors.length) {
        for (let i = 0; i < contributors.length; i++) {
            let givenName = contributors[i].querySelector(".given-names").textContent;
            let surName = contributors[i].querySelector(".surname").textContent;
            contributorsCollection.push(givenName + " " + surName);
        }
    }

    // create title page elements and fill with content:
    let titlePage = document.createElement("div");
    titlePage.id = "page-header";
    let titleElement = document.createElement("h1");
    titleElement.classList.add("page-title", "text-content");
    titleElement.innerHTML = (title) ? title.textContent : "[Kein Titel]";
    let subtitleElement = document.createElement("h1");
    subtitleElement.classList.add("page-subtitle", "text-content");
    subtitleElement.innerHTML = (subtitle) ? subtitle.textContent : "";

    // create contributors elements and fill with content:
    let authorsElement = document.createElement("h1");
    authorsElement.classList.add("page-authors", "text-content");
    authorsElement.innerHTML = (authorsCollection.length) ? authorsCollection.join(", ") : "[Keine Autoren]";
    let contributorsElement = document.createElement("p");
    contributorsElement.className = "page-contributors";
    if(contributorsCollection.length && lang !== undefined) {
        contributorsElement.innerHTML = contributorsPrepositions[lang] + " " + contributorsCollection.join(", ");
    }

    // append all elements to titlePage:
    titlePage.append(authorsElement);
    titlePage.append(titleElement);
    titlePage.append(subtitleElement);
    titlePage.append(contributorsElement);

    return (titlePage);
}

/**
 * create ToC: table of contents by headlines:
 * @param {DocumentFragment} content document-fragment made from original DOM
 * @returns {HTMLElement} toc: table of content; currently not used for dai-journals
 */
function createToCFromHeadings(content) {

    let toc = document.createElement("div");

    if (createToC) {
        let tocListTitle = document.createElement("h3");
        tocListTitle.id = "contents";
        tocListTitle.classList.add("title-appendix");
        let lang = document.documentElement.lang;
        tocListTitle.innerHTML = titlesOfAppendices["contents"][lang];
        toc.append(tocListTitle);

        let tocList = document.createElement("ul");
        tocList.classList.add("toc-list");

        // get headings
        let headings = content.querySelectorAll(".title");
        if (headings) {
            for (let i = 0; i < headings.length; ++i) {
                let name = "toc-" + i;
                let level = headings[i].localName; // get h1, h2 etc.
                level = level.substring(1); // remove h
                headings[i].id = name;

                let tocListItem = document.createElement("li");
                tocListItem.classList.add("heading-ref", "level-" + level);
                let tocEntry = document.createElement("a");
                tocEntry.classList.add("heading-ref-a");
                tocEntry.setAttribute("href", "#" + name);
                tocEntry.innerHTML = headings[i].innerHTML;

                tocListItem.appendChild(tocEntry);
                tocList.appendChild(tocListItem);
            }
            toc.appendChild(tocList);
        }
    }
    return(toc);
}

/**
 * reformat footnotes for displaying them at bottom of page,
 * based on https://pagedjs.org/posts/2021-06-newRelease/:
 * @param {DocumentFragment} content document-fragment made from original DOM
 * @returns {void}
 */
function reformatFootnotes(content) {

    // get footnotes and footnoteReferences
    let footnotes = content.querySelectorAll(".footnote");
    let footnoteRefs = content.querySelectorAll("a[href*='#fn']");
    const footnotesCollection = [];

    if (footnoteRefs && footnotes) {
        // reformat footnotes:
        for (let i = 0; i < footnotes.length; ++i) {
            let footnote = document.createElement("span");

            // remove fn-label:
            if( footnotes[i].querySelector(".label")) {
                footnotes[i].querySelector(".label").remove();
            }

            // assign classes for rendering and for range-specific stylings
            if (i + 1 < 10) {
                footnote.classList.add("footnote");
                footnote.classList.add("footnote-1-10");
            } else if (i + 1 >= 10 && i + 1 <= 99) {
                footnote.classList.add("footnote");
                footnote.classList.add("footnote-10-99");
            } else {
                footnote.classList.add("footnote");
                footnote.classList.add("footnote-100-999");
            }

            // assign footnote text to footnote span:
            footnote.innerHTML = footnotes[i].innerText;
            checkMaxLengthOfInnerText(footnote, maxFootnoteLength);
            footnotesCollection.push(footnote);
        }

        // reformat footnoteReferences:
        for (let i = 0; i < footnoteRefs.length; ++i) {
            footnoteRefs[i].innerHTML = "";
            footnoteRefs[i].append(footnotesCollection[i]);
        }
    }
}

/**
 * create referenceList:
 * @param {DocumentFragment} content document-fragment made from original DOM
 * @returns {HTMLElement} referenceList as meta-section with author-year-label,
 * reference titles and external ref-links
 */
function createReferenceList(content) {

    let referenceList = document.createElement("div");
    referenceList.id = "reference-list";
    referenceList.classList.add("meta-section");

    let referenceSection = content.querySelector(".reference-section");
    let references = []; // no ref-list
    if(referenceSection !== null) {
        references = content.querySelectorAll(".reference");
    };

    // checkout ref-list title
    let refListTitle;
    if(references.length) {
        if (referenceSection && referenceSection.querySelector(".title") !== null) {
            refListTitle = referenceSection.querySelector(".title");
            refListTitle.classList.add("main-title");
        }
        else {
            refListTitle = document.createElement("h3");
            let lang = document.documentElement.lang;
            refListTitle.innerHTML = titlesOfAppendices["references"][lang];
            refListTitle.classList.add("main-title");
        }
    } else {
        refListTitle = document.createElement("h3");
        let lang = document.documentElement.lang;
        refListTitle.innerHTML = "[NO-REFERENCES]";
        refListTitle.classList.add("main-title");
    }
    referenceList.appendChild(refListTitle)

    // recreate reference elements:
    if(references.length) {
        for (let i = 0; i < references.length; i++) {
            let label = references[i].querySelector(".label");
            let mixedCitation = references[i].querySelector(".mixed-citation");
            
            // handle ext-ref-links and urlify plain url strings:
            let extRef;
            if(references[i].querySelector(".ext-ref") !== null) {
                // rebuild ext-refs as single anchor:
                extRef = references[i].querySelector(".ext-ref")
                let extRefLink = document.createElement("a");
                extRefLink.classList.add("ext-ref");
                extRefLink.target = "_blank";
                extRefLink.href = extRef.href;

                // clone specific use attribute:
                if(extRef.getAttribute("data-specific-use")) {
                    let specificUse = extRef.getAttribute("data-specific-use");
                    extRefLink.setAttribute("data-specific-use", specificUse);
                    // display zenon-links in parenthesis-notation:
                    if(specificUse === "zenon") { 
                        extRefLink.innerHTML = "[Zenon &#9741]";
                    };
                    if(specificUse === "weblink") { 
                        extRefLink.innerHTML = "" + extRef.href + "";
                    };
                }
                // extract reference text from ext-ref-element
                // let citation = extRef.textContent;
                mixedCitation.innerHTML = URLifyString(mixedCitation.textContent);
                mixedCitation.append(extRefLink);
            }
            else if(mixedCitation !== null) {
                mixedCitation.innerHTML = URLifyString(mixedCitation.innerText);
            }
            else {
                mixedCitation = document.createElement("p");
                mixedCitation.classList.add("mixed-citation");
            }

            // append reference elements:
            references[i].innerHTML = "";
            mixedCitation.prepend(label);
            // references[i].append(label);
            references[i].append(mixedCitation);
            referenceList.append(references[i]);
        }
    }
    return (referenceList);
}

/**
 * recreate figureSection as clone from content:
 * @param {DocumentFragment} content document-fragment made from original DOM
 * @returns {HTMLElement} cloned figureSection, validated, enhanced, classified,
 * reordered. Will be reused for parts of sourceOfIllustration
 */
function recreateFiguresSection(content) {

    // check and clone original figure section:
    let figureSection;
    if(content.querySelector(".figure-section") !== null) {
        figureSection = content.querySelector(".figure-section").cloneNode(true);
        figureSection.id = "cloned-images-container";
        figures = figureSection.querySelectorAll("figure:not(#poster-image)");
    } 
    else {
        figureSection = document.createElement("div");
        return(figureSection);
    }

    // process each figure element:
    for (let i = 0; i < figures.length; ++i) {
        let img = figures[i].querySelector("img");
        let figCaption = figures[i].querySelector("figCaption");
    
        let attribution;
        if(figures[i].querySelector(".attribution") !== null) {
            attribution = figures[i].querySelector(".attribution");
        }
        else {
            attribution = document.createElement("p");
            attribution.classList.add("attribution");
            attribution.classList.add("warning-text");
            attribution.innerHTML = "[CREDIT ATTRIBUTION MISSING]";
        }

        let label = figures[i].querySelector(".label");
        label.classList.add("img-label");

        // create figNumber with counter-value:
        let figNumber = label.cloneNode(true);
        figNumber.classList.remove("img-label");
        figNumber.classList.add("fig-number");
        let counter = figNumber.textContent.slice(5);
        figNumber.innerHTML = counter;

        // check length of figCaption text:
        checkMaxLengthOfInnerText(figCaption.firstElementChild, maxCaptionLength);
        
        // reorder label and figCaption:
        figCaption.firstElementChild.classList.add("caption-text");
        label.innerHTML = label.innerHTML + ": ";
        figCaption.firstElementChild.insertAdjacentElement("afterbegin", label);
    
        // reappend figure elements:
        figures[i].innerHTML = "";
        figures[i].append(img);
        figures[i].append(figNumber);
        figures[i].append(figCaption);
        figures[i].append(attribution);
        figureSection.append(figures[i]);
    }
    return(figureSection);
}

/**
 * create source of illustrations or rather credits section:
 * @param {Element} figureSection figureSection cloned from content
 * @returns {HTMLElement} sourceOfIllustrations used as meta-section with credith
 * information for each figure
 */
function createSourceOfIllustrations(figureSection) {

    // prepare section elements:
    let sourceOfIllustrations = document.createElement("div");
    sourceOfIllustrations.id = "source-of-illustrations";

    if(figureSection) {
        // (re)create title for source of illustrations:
        let lang = document.documentElement.lang;
        let sourceOfIllustrationsTitle = document.createElement("h3");
        sourceOfIllustrationsTitle.classList.add("main-title");
        sourceOfIllustrationsTitle.classList.add("title-appendix");
        sourceOfIllustrationsTitle.innerHTML = titlesOfAppendices["sourceOfIllustrations"][lang];
        sourceOfIllustrations.appendChild(sourceOfIllustrationsTitle);

       // append credits for each figure
       let figures = figureSection.querySelectorAll("figure:not(#poster-image)");
       for (let i = 0; i < figures.length; ++i) {
           let label = figures[i].querySelector(".img-label");
           let labelCloned = label.cloneNode(true);
           let attribution = figures[i].querySelector(".attribution");
           attribution.insertAdjacentElement("afterbegin", labelCloned);

           let credits = document.createElement("div");
           credits.classList.add("credits");
           credits.append(attribution);
           sourceOfIllustrations.appendChild(credits);
       }
    }
    return (sourceOfIllustrations);
}

/**
 * create contributors details for all participants (article and journal)
 * @param {DocumentFragment} content document-fragment made from original DOM
 * @param {boolean} isArticle if true, contributors data will be taken from 
   <article-meta> and display as contributors of article or rather authorDetails
 * @returns {HTMLElement} contributorsDetails
 */
function createContributorsDetails(content, isArticle) {

    let contributorsDetails = document.createElement("div");
    contributorsDetails.id = "contributors-section";

    let authors;
    let contributors;
    let editors;
    let coEditors;
    let advisoryBoardMember;
    if(isArticle) {
        // define title of authorDetails
        let contributorsDetailsTitle = document.createElement("h3");
        contributorsDetailsTitle.classList.add("title-appendix");
        let lang = document.documentElement.lang;
        contributorsDetailsTitle.innerHTML = titlesOfAppendices["authorDetails"][lang];
        contributorsDetails.appendChild(contributorsDetailsTitle);

        // get article authors and contributors
        authors = content.querySelectorAll(".contrib[contrib-type='author']");
        contributors = content.querySelectorAll(".contrib[contrib-type='co-author']");
    }
    else {
        // get journals editors, co-editors and advisory board member
        editors = content.querySelectorAll(".contrib[contrib-type='Editor']");
        coEditors = content.querySelectorAll(".contrib[contrib-type='Co-Editor']");
        advisoryBoardMember = content.querySelectorAll(".contrib[contrib-type='Advisory Board Member']");
    }

    // add main-authors:
    if(authors) {
        for (let i = 0; i < authors.length; i++) {
            let contributorsCard = createContributorsCard(authors[i]);
            contributorsDetails.appendChild(contributorsCard);
        }
    }
    // add contributors:
    if(contributors) {
        for (let i = 0; i < contributors.length; i++) {
            let contributorsCard = createContributorsCard(contributors[i]);
            contributorsDetails.appendChild(contributorsCard);
        }
    }
    // add editors:
    if(editors) {
        for (let i = 0; i < editors.length; i++) {
            let contributorsCard = createContributorsCard(editors[i]);
            contributorsDetails.appendChild(contributorsCard);
        }
    }
    // add co-editors:
    if(coEditors) {
        for (let i = 0; i < coEditors.length; i++) {
            let contributorsCard = createContributorsCard(coEditors[i]);
            contributorsDetails.appendChild(contributorsCard);
        }
    }
     // add co-editors:
     if(advisoryBoardMember) {
        for (let i = 0; i < advisoryBoardMember.length; i++) {
            let contributorsCard = createContributorsCard(advisoryBoardMember[i]);
            contributorsDetails.appendChild(contributorsCard);
        }
    }
    return(contributorsDetails);
}

/**
 * create contributors card for each participant (e.g author)
 * @param {HTMLElement} contributor given data for each contributor
 * @returns {HTMLElement} contributorsCard, common information of each author
   including contributors-ids, institution affiliation and contact email
 */
function createContributorsCard(contributor) {

    // prepare section elements:
    let contributorsCard = document.createElement("div");
    contributorsCard.classList.add("contributors-card");

    // prepae sub-elements of contributors card:
    let name = document.createElement("p");
    let institution = document.createElement("p");
    let contribIdLink = document.createElement("a");
    let institutionIdLink = document.createElement("a");
    let email = document.createElement("p");

    // parse and reorder names and contrib-ids (e.g. orcid):
    if(contributor.querySelector(".given-names") !== null && contributor.querySelector(".surname") !== null) {
        let givenName = contributor.querySelector(".given-names").textContent;
        let surName = contributor.querySelector(".surname").textContent;
        if(contributor.querySelector(".contrib-id") !== null) {
            let contribId = contributor.querySelector(".contrib-id").textContent;
            contribIdLink.classList.add("contributor-link");
            contribIdLink.target = "_blank";
            contribIdLink.href = contribId;
            contribIdLink.innerHTML = givenName + " " + surName;
            name.append(contribIdLink);
        } else { name.innerHTML = givenName + " " + surName;}
        contributorsCard.append(name);
    };

     // parse and reorder affiliation information: 
    if(contributor.querySelector(".institution") !== null) {
        if(contributor.querySelector(".institution-id") !== null) {
            let institutionId = contributor.querySelector(".institution-id").textContent;
            institutionIdLink.classList.add("institution-link");
            institutionIdLink.target = "_blank";
            institutionIdLink.href = institutionId
            institutionIdLink.innerHTML = contributor.querySelector(".institution").textContent;
            institution.append(institutionIdLink);
        } else { institution.innerHTML = contributor.querySelector(".institution").textContent;}
        contributorsCard.append(institution);
    };

     // parse and append email information:
    if(contributor.querySelector(".email") !== null) {
        email.innerHTML = contributor.querySelector(".email").textContent;
        contributorsCard.append(email);
    }
    return(contributorsCard);
}

/**
 * create article meta-section in form of external doi-reference
 * @returns {HTMLElement} articleMetaSection with doi as link and qrcode
 */
function createArticleMetaSection() {

    // prepare section elements:
    let articleMetaSection = document.createElement("div");
    articleMetaSection.id = "metadata";
    articleMetaSection.classList.add("metadata-section");
    let articleMetaSectionTitle = document.createElement("h3");
    articleMetaSectionTitle.classList.add("title-appendix");
    let lang = document.documentElement.lang;
    articleMetaSectionTitle.innerHTML = titlesOfAppendices["metadata"][lang];
    articleMetaSection.appendChild(articleMetaSectionTitle);

    // address article meta as qr-code reference:
    let qrCodeContainer = document.createElement("div");
    qrCodeContainer.id = "qrcode";
    articleMetaSection.appendChild(qrCodeContainer);

    let doiLink;
    let doiUrl = getDocumentStateProperty("documentId");
    if(doiUrl) {
        doiLink = document.createElement("a");
        doiLink.classList.add("metadata-doi-link");
        doiUrl = (/https:/.test(doiUrl)) ? doiUrl : "https://doi.org/" + doiUrl;
        doiLink.href = doiUrl;
        doiLink.innerHTML = doiUrl;
        articleMetaSection.appendChild(doiLink);
    }
    return (articleMetaSection);
}

/**
 * create imprint section to display journal related metadata
 * @param {DocumentFragment} content document-fragment made from original DOM
 * @returns {HTMLElement} imprint section enhanced with certain journal 
   information (publisher, editors, contributors and other credits)
 */
function createImprintSection(content) {

    // prepare imprint elements:
    let imprintSection = document.createElement("div");
    imprintSection.id = "imprint";
    imprintSection.classList.add("metadata-section");
    let imprintSectionTitle = document.createElement("h3");
    imprintSectionTitle.classList.add("title-appendix");
    let lang = document.documentElement.lang;
    imprintSectionTitle.innerHTML = titlesOfAppendices["imprint"][lang];
    imprintSection.appendChild(imprintSectionTitle);

    // collect journal information:
    let journalTitle;
    let journalDOI;
    let publisher;

    // journal title
    if(content.querySelector(".journal-title") !== null) {
        journalTitle = content.querySelector(".journal-title");
        journalTitle.innerHTML =  journalTitle.innerText;
        // add journal DOI:
        let journalDOILink
        if(content.querySelector(".journal-id[journal-id-type='doi']") !== null) {
            journalDOI = content.querySelector(".journal-id[journal-id-type='doi']");
            journalDOILink = document.createElement("a");
            journalDOILink.id = "journal-doi-link";
            journalDOILink.href = journalDOI.innerText;
            journalDOILink.textContent = journalDOI.innerText;
            journalTitle.appendChild(journalDOILink);
        }
        imprintSection.appendChild(journalTitle);
    }

    // publisher:
    if(content.querySelector(".publisher") !== null) {
        publisher = content.querySelector(".publisher");
        imprintSection.appendChild(publisher);
    }

    // editors and advisory board members:
    let journalMeta = content.querySelector(".journal-meta");
    let editorsGroup = content.querySelector(".contrib-group[content-type='Editors']");
    let advisoryBoardGroup = content.querySelector(".contrib-group[content-type='Advisory Board']");
    let contributorsDetails;
    let role;
    if(editorsGroup !== null) {
        role = editorsGroup.querySelector(".role");
        contributorsDetails = createContributorsDetails(editorsGroup, false);
        editorsGroup.classList.add("contributors-imprint");
        editorsGroup.innerHTML = contributorsDetails.innerHTML;
        editorsGroup.insertAdjacentElement("afterbegin", role);
        imprintSection.appendChild(editorsGroup);
    }
    if(advisoryBoardGroup !== null) {
        role = advisoryBoardGroup.querySelector(".role");
        contributorsDetails = createContributorsDetails(advisoryBoardGroup, false);
        advisoryBoardGroup.classList.add("contributors-imprint");
        advisoryBoardGroup.innerHTML = contributorsDetails.innerHTML;
        advisoryBoardGroup.insertAdjacentElement("afterbegin", role);
        imprintSection.appendChild(advisoryBoardGroup);
    }
    // parse customMetaGroup:
    let customMetas;
    if(journalMeta.querySelector(".custom-meta-group") !== null) {
        customMetas = journalMeta.querySelectorAll(".custom-meta");
        for (let i = 0; i < customMetas.length; i++) {
            let customMeta = customMetas[i];
            if(/label/.test(customMeta.className)) {
                customMeta.classList.add("role");
            }
            if(/url/.test(customMeta.className)) {
                customMeta.style.display = "none";
            }
            imprintSection.appendChild(customMeta);
        }
    }
    return (imprintSection);
}

/* -----------------------------
Handle figure and text-content maps
--------------------------------*/
/**
 * create text-content map
 * @param {HTMLElement} parsedContent content once parsed and given ids (data-ref and break rules from the css)
 * @param {JSON} previousMap previous map saved in local storage, e.g. with given style properties 
 * @returns {void} textContentMap (with figRefs, position and other params) will be saved in local storage
 */
function createTextContentMap(parsedContent, previousMap) {

    // presets:
    let textContentMap = {};
    let allFigRefs = [];
    let hasSectionId = [];
    let numFigRefsSection = 0;
    let numTextElementsSection = 0;
    let isFirstOfSection;

    // set hash for current html document:
    let documentId = parsedContent.querySelector("article").id;
    textContentMap["documentId"] = documentId;

    // get content-body
    let contentBody = parsedContent.querySelector("#content-body");

    // elements defined as text-elements:
    let textElementsSelector = "p,li,table,pre,code,.boxed-text,.title";

    // select text-content elements:;
    if(contentBody.querySelectorAll(textElementsSelector) !== null) {
        let textElements = contentBody.querySelectorAll(textElementsSelector);        
        // process each text element
        for (let i = 0; i < textElements.length; i++) {
             // add text-content class to text element
            let element = textElements[i];
            element.classList.add("text-content");

            // parse references for each text element:
            let references = element.querySelectorAll("a.fig-ref");
            let figRefs = [];
            if (references) {
                for (let index = 0; index < references.length; index++) {
                    // get figure ids from href/hash:
                    let reference = references[index].hash.slice(1); // e.g. "f-1"
                    // avoid duplicates:
                    if (!allFigRefs.includes(reference)) {
                        figRefs.push(reference);
                        allFigRefs.push(reference);
                    }
                }
            }
       
            // count amout of figures and text elements within section
            let parent = element.parentElement;
            if (parent && parent.tagName === "SECTION") {
                if (hasSectionId.includes(parent.id)) {
                    // same section
                    isFirstOfSection = false;
                    numFigRefsSection = numFigRefsSection + figRefs.length;
                    numTextElementsSection = numTextElementsSection + 1;
                }
                else {
                    // new section
                    isFirstOfSection = true;
                    element.classList.add("first-of-section");
                    hasSectionId.push(parent.id);
                    numFigRefsSection = figRefs.length;
                    numTextElementsSection = 1;
                }
            }
            // assign values for each text element:
            let values = {
                "position": i,
                "id": element.id,
                "tagName": element.tagName,
                "figRefs": figRefs,
                "isSet": false,
                "style": (previousMap[element.id] !== undefined) ? previousMap[element.id]["style"] : false,
                "class": (previousMap[element.id] !== undefined) ? previousMap[element.id]["class"] : false,
                "isFirstOfSection": isFirstOfSection,
                "numFigRefsSection": numFigRefsSection,
                "numTextElementsSection": numTextElementsSection
            };
            textContentMap[element.id] = values;
        }
    }
    // save entire map in local storage:
    localStorage.setItem("text-content-map", JSON.stringify(textContentMap));
}

/**
 * update text-content map
 * @param {string} currentNodeId id of regular text-content-nodes (e.g. paragraphs) 
 * @param {string} property property-key of textContentMap
 * @param {string} value property-value of textContentMap
 * @returns {void} changes are saved in localStorage
 */
function updateTextContentMap(currentNodeId, property, value) {

    // get current textContentMap:
    let textContentMap = JSON.parse(localStorage.getItem("text-content-map"));
    if (textContentMap[currentNodeId]) {
        // change given property value
        if(property !== undefined) {
            textContentMap[currentNodeId][property] = value;
        }
    }
    // save updated figure map:
    localStorage.setItem("text-content-map", JSON.stringify(textContentMap));
}

/**
 * create figure map
 * @param {HTMLElement} parsedContent content once parsed and given ids
 * (data-ref and break rules from the css)
 * @param {JSON} previousMap previous map saved in local storage, e.g. with given style properties 
 * @returns {void} figureMap (with position, states, styles and typesettingClasses) will be saved in local storage
 */
function createFigureMap(parsedContent, previousMap) {

    let figureMap = {};

    // set hash for current html document:
    let documentId = parsedContent.querySelector("article").id;
    figureMap["documentId"] = documentId;

    // create map of regular paragraphs:
    let figures = parsedContent.querySelectorAll("figure:not(#poster-image)");
    for (let i = 0; i < figures.length; i++) {
        let figure = figures[i];  
        let values = {
            "position": i,
            "id": figure.id,
            "inserted": false,
            "style": (previousMap[figure.id] !== undefined) ? previousMap[figure.id]["style"] : false,
            "typesettingClass": (previousMap[figure.id] !== undefined) ? previousMap[figure.id]["typesettingClass"] : false,
            "positionClass": (previousMap[figure.id] !== undefined) ? previousMap[figure.id]["positionClass"] : false
        };
        figureMap[figure.id] = values;
    }
    // save entire map in local storage:
    localStorage.setItem("figure-map", JSON.stringify(figureMap));
}

/**
 * update figure map
 * @param {string} figureId id of figure element
 * @returns {void} changes are saved in localStorage
 */
function updateFigureMap(figureId) {

    // get current figureMap:
    let figureMap = JSON.parse(localStorage.getItem("figure-map"));

    // reset "setLast"-state of previous figure:
    let setLastId = Object.keys(figureMap).find(key => figureMap[key]["setLast"] === true);
    if (setLastId) {
        figureMap[setLastId]["setLast"] = false;
    }
    // update states of current figure:
    figureMap[figureId]["inserted"] = true;
    figureMap[figureId]["setLast"] = true;

    // save updated figure map:
    localStorage.setItem("figure-map", JSON.stringify(figureMap));
}

/* --------------------------------------
Handle figure reference management:
-----------------------------------------*/
/**
 * get next figure references in sourceNode
 * @param {string, number} nodeId id of sourceNode, right before rendering
 * @returns {array} nextFigRefs
 */
function getNextFigRefs(currentNodeId) {

    const rangeNextFigRefs = 2;

    // get textContent and figure map:
    let textContentMap = JSON.parse(localStorage.getItem("text-content-map"));
    let figureMap = JSON.parse(localStorage.getItem("figure-map"));
    let currentNodePosition = textContentMap[currentNodeId]["position"];

    // find next figure references in all textElement within rangeNextFigRefs:
    let nextFigRefs = [];
    let nodeId;
    let textElement;
    let i = 1;  // starting point (currentNode)
    while (i <= rangeNextFigRefs) {
        nodeId = Object.keys(textContentMap)[currentNodePosition + i];
        textElement = textContentMap[nodeId];
        if(textElement && textElement.figRefs !== undefined && textElement.figRefs.length) {
            let figRef;   // check figRefs of each text element
            for (let i = 0; i < textElement.figRefs.length; ++i) {
                figRef = textElement.figRefs[i];
                // collect each figRef in nextFigRefs:
                if(figureMap[figRef] !== undefined) {
                    if (!figureMap[figRef]["inserted"]     // if figure not already inserted
                     && !nextFigRefs.includes(figRef)) {   // and not already included in array
                        nextFigRefs.push(figRef);
                    }
                }
            }
        }
        // if node is first of content section:
        if(textElement && !textContentMap[nodeId]["isFirstOfSection"]) {
            // ++i; // proceed (next paragraph)
            i = i + 1;
        }
        // if rangeOverSection is true (allowed):  
        else if(rangeOverSection) {
            // ++i; // proceed (next paragraph)
            i = i + 1;
        }
        // break up entire loop of figRef search:
        else {
            i = rangeNextFigRefs;
        }
    }
    return(nextFigRefs);
}

/**
 * sort nextFigRefs by figurePosition
 * @param {array} nextFigRefs array of figRefs
 * @returns {array} nextFigRefs: nextFigRefs sorted by figure position
 * to ensure keeping figure placement in numeric order (fig. 3 before fig. 4) 
 */
function sortNextFigRefsByFigurePosition(nextFigRefs) {

    if(nextFigRefs && nextFigRefs.length) {
        let figureMap = JSON.parse(localStorage.getItem("figure-map"));
        // get figurePosition and collect in positionArray:
        let positionArray = [];
        for (let i = 0; i < nextFigRefs.length; i++) {
            let figRef = nextFigRefs[i];
            let figurePosition = figureMap[figRef]["position"];
            positionArray.push(figurePosition);
        }
        // sort positionArray numerically:
        positionArray.sort(function(a, b) {return a - b;});
        // re-map nextFigRefs by positionArray:
        nextFigRefs = [];
        for (let i = 0; i < positionArray.length; i++) {
            let figRef = Object.keys(figureMap).find(key => 
                figureMap[key]["position"] === positionArray[i]);
            nextFigRefs.push(figRef);
        }
    }
    return(nextFigRefs);
}

/**
 * push figure reference to next text-content node, used to skip typsetting figure, 
 * which not fits in current node contexts
 * @param {string, number} currentNodeId id of sourceNode to be rendered
 * @param {string} figureId, figure reference as element-id of figure
 * @returns {void} changes are saved in localStorage
 * 
 */
function pushFigRefToNextNode(currentNodeId, figureId) {

    if(currentNodeId !== undefined && figureId !== undefined) {
        
        // get textContentMap
        let textContentMap = JSON.parse(localStorage.getItem("text-content-map"));

        // get nextNodeId by position of current node:
        let currentNodePosition = textContentMap[currentNodeId]["position"];
        let nextNodeId = Object.keys(textContentMap)
        .find(key => textContentMap[key]["position"] === currentNodePosition + 1);

        // push figRef to next node
        if (textContentMap[nextNodeId] !== undefined) {
            if(!textContentMap[nextNodeId]["figRefs"].includes(figureId)) {
                textContentMap[nextNodeId]["figRefs"].push(figureId);
            }
        }
        // save updated figure map:
        localStorage.setItem("text-content-map", JSON.stringify(textContentMap));
    }  
}

/**
 * get next figure element by figure reference
 * @param {string} nextFigRef is figure reference as element-id of figure
 * @param {HTMLElement} parsedContent content once parsed and given ids 
 * (data-ref and break rules from the css)
 * @returns {HTMLElement} figureElement
 * 
 */
function getNextFigureElement(nextFigRef, parsedContent) {

    let figureElement = false;
    if (nextFigRef) {
        figureElement = parsedContent.querySelector("figure#" + nextFigRef);
    }
    return(figureElement);
}

/* -------------------------------------
Control page layout of element nodes
----------------------------------------*/
/**
 * define parameter of renderNode
 * @param {node} sourceNode original node from parsedContent currently rendered
 * @param {node} renderNode cloned node that is added to the DOM; if pagedJs splits
 * the sourceNode, renderNode is rendered on the next page
 * @param {HTMLElement} parsedContent content once parsed and given ids
 * (data-ref and break rules from the css)
 * @returns {JSON} nodeParams: parameter collection (e.g. pageContext-parameter,
 * target figure references, target figure Elements)
 * 
 */
function defineSourceNodeParameter(sourceNode, renderNode, parsedContent) {

    // define distribution ratio of section (relation between figures to text-content):
    let distributionRatio = defineDistributionRatioOfSection(sourceNode);

    // define page contexts and distances of source node:
    let contexts = definePageContextsOfSourceNode(sourceNode, renderNode);
    contexts = calculateNodeDistances(contexts, sourceNode);

    // save stats of pageContexts as element attribute:
    setPageContextsAsElementAttribute(contexts, sourceNode, renderNode);

    // get next figRefs and sort nextFigRefs:
    let nextFigRefs = getNextFigRefs(sourceNode.id);
    nextFigRefs = sortNextFigRefsByFigurePosition(nextFigRefs);

    // get next two figure elements by nextFigRefs:
    let currentFigure = getNextFigureElement(nextFigRefs[0], parsedContent);
    let nextFigure = getNextFigureElement(nextFigRefs[1], parsedContent);

    // collect nodeParams:
    let nodeParams = {
        "sourceNode": sourceNode,
        "renderNode": renderNode,
        "distributionRatio": distributionRatio,
        "figRefs": nextFigRefs,
        "numFigRefs": nextFigRefs.length,
        "contexts": contexts,
        "currentFigure": currentFigure,
        "nextFigure": nextFigure
    };
    return(nodeParams);
}

/**
 * define distribution ratio of section
 * @param {node} sourceNode original node from parsedContent currently rendered
 * @returns {number} distributionRatio: decimal number (between 0 and 1) decribing 
 * the ratio between amount of figures, referenced in all textElements of each section,
 * in relation to the amout of these textElements (value currently not used / evaluated).
 */
function defineDistributionRatioOfSection(sourceNode) {

    let distributionRatio;
    let textContentMap = JSON.parse(localStorage.getItem("text-content-map"));

    if(textContentMap[sourceNode.id]) {
        let textElement = textContentMap[sourceNode.id];
        let numTextElements = textElement["numTextElementsSection"];
        let numFigRefs = textElement["numFigRefsSection"];
        distributionRatio = (numTextElements !== 0) ? numFigRefs / numTextElements : 0;
    }
    return(distributionRatio);
}

/**
 * define page contexts of sourceNode
 * @param {node} sourceNode original node from parsedContent currently rendered
 * @returns {JSON} pageContexts: parameter collection (e.g. pageId, elementSetBefore,
 * precalculated distances)
 * 
 */
function definePageContextsOfSourceNode(sourceNode, renderNode) {

    // get pageContent, pageElement and pageId of sourceNode:
    let pageContent = sourceNode.closest(".pagedjs_page_content");
    let pageElement = pageContent.closest(".pagedjs_page");
    let pageId = (pageElement !== null) ? pageElement.id : false;

    // get element set before on page:
    let elementsOfPage = pageContent.querySelectorAll(".text-content,figure");
    let index = Array.prototype.indexOf.call(elementsOfPage, sourceNode);
    let elementSetBefore = (index >= 1) ? elementsOfPage[index-1] : false;
    let elementSetBeforeTagName = (elementSetBefore) ? elementSetBefore.tagName : false;
  
    // get bounding client rectangles of pageContent:
    let pageContentTop = Math.round(pageContent.getBoundingClientRect().top);
    let pageContentHeight = pageContent.offsetHeight;
    let pageContentWidth = pageContent.offsetWidth;

    // get height of footnoteArea:
    let footnoteArea = pageElement.querySelector(".pagedjs_footnote_area");
    let footnoteAreaHeight = footnoteArea.getBoundingClientRect().height;
    footnoteAreaHeight = Math.round(footnoteAreaHeight);
 
    // get bounding client rectangle of nodes:
    let nodeTop = Math.round(sourceNode.getBoundingClientRect().top);
    let nodeBottom = Math.round(sourceNode.getBoundingClientRect().bottom);
    let nodeMarginTop = parseInt(getComputedStyle(sourceNode).marginTop);
    let nodeMarginBottom = parseInt(getComputedStyle(sourceNode).marginBottom);
   
    // pre-calculate distances of node to top of page:
    let distanceFromNodeTop = Math.round(nodeTop - pageContentTop + nodeMarginTop);
    let distanceFromNodeBottom = Math.round(nodeBottom - pageContentTop + nodeMarginBottom);

    // check if page has reached maximum amount of figures:
    let isPageFigureMax;
    if(pageContent.querySelectorAll("FIGURE").length > pageFigureMax-1) {
        isPageFigureMax = true;
    } else isPageFigureMax = false;
    
    // detecting node splits:
    let nodeSplit = (distanceFromNodeBottom >= pageContentHeight) ? true : false;
    if (nodeSplit && renderNode !== undefined) {
        sourceNode.setAttribute("is-split-node-parent", true);
        renderNode.setAttribute("is-split-node", true);
    };

    // detecting nodes laid out on next page:
    let nextPageNode = false;
    if(!nodeSplit && distanceFromNodeTop == 0) {
        nextPageNode = true;
        // Why 37: must be the margin between two pages!
        distanceFromNodeBottom = distanceFromNodeBottom  - 37;
    }
   
    // return values in pageContexts object:
    let pageContexts = {
        "pageId": pageId,
        "pageContent": pageContent,
        "pageContentHeight": pageContentHeight,
        "pageContentWidth": pageContentWidth,
        "pageContentTop": pageContentTop,
        "footnoteAreaHeight": footnoteAreaHeight,
        "elementSetBefore": elementSetBefore,
        "elementSetBeforeTagName": elementSetBeforeTagName,
        "distanceFromNodeBottom": distanceFromNodeBottom,
        "nodeMarginTop": nodeMarginTop,
        "nodeMarginBottom": nodeMarginBottom,
        "distanceFromNodeTop": distanceFromNodeTop,
        "isPageFigureMax": isPageFigureMax,
        "nodeSplit": nodeSplit,
        "nextPageNode": nextPageNode,
        "renderNode": {}
    };
    return pageContexts;
}

/**
 * calculate critical distances of source nodes
 * @param {JSON} contexts parameter collection (e.g. pageId, elementSetBefore,
 * distances etc), predefined before as pageContexts
 * @param {node} sourceNode original node from parsedContent currently rendered
 * @returns {JSON} contexts: enhanced and updated parameterCollection with 
 * calculated distances (e.g. remainingSpace, nodeHeight)
 */
function calculateNodeDistances(contexts, sourceNode) {

    let elementSetBefore = contexts["elementSetBefore"];
    let distanceFromNodeTop = contexts["distanceFromNodeTop"];
    let distanceFromNodeBottom = contexts["distanceFromNodeBottom"];

    // define node types:
    let nodeTypes = defineNodeTypes(contexts, sourceNode, elementSetBefore);

    // modulate distances of split nodes, partly rendered on next page:
    if(nodeTypes["sourceNodeType"] === "split-node") {
        contexts = calculateDistancesOfSplitNodes(contexts, sourceNode);
    }
    // calculate distances of figure nodes:
    if (nodeTypes["sourceNodeType"] === "figure" || nodeTypes["sourceNodeType"] === "float") {
        contexts = calculateDistancesOfFigureNodes(contexts, sourceNode);
    }
    // calculate distances of title nodes:
    if(nodeTypes["sourceNodeType"] === "title") {
        contexts = calculateDistancesOfTitleNodes(contexts, sourceNode);
    }
    // calculate distances of regular nodes:
    if(nodeTypes["sourceNodeType"] === "regular-node") {
        contexts = calculateDistancesOfRegularNodes(contexts, sourceNode);
    }

    // modulate distances when figure is elementBefore
    if(nodeTypes["elementBeforeType"]) {  
        let marginBottom = parseInt(getComputedStyle(sourceNode).marginBottom);
        let fromNodeBottomBefore = parseFloat(elementSetBefore.getAttribute("fromNodeBottom"));
        if(nodeTypes["elementBeforeType"] === "figure") {
            distanceFromNodeTop = fromNodeBottomBefore + marginBottom; 
            distanceFromNodeBottom = distanceFromNodeTop + contexts["nodeHeight"] + marginBottom;
        }
    } 
    return (contexts);

  
}

/**
 * define types of sourceNode and element set before
 * @param {JSON} contexts parameter collection (e.g. pageId, elementSetBefore,
 * distances etc), predefined before as pageContexts
 * @param {node} sourceNode original node from parsedContent currently rendered
 * * @param {HTMLElement} elementBefore element set on page before node
 * @returns {Object} nodeTypes object
 */

function defineNodeTypes(contexts, sourceNode, elementBefore) {

    // define sourceNodeTypes:
    let sourceNodeType;
    switch (true) {
        case (/FIGURE/.test(sourceNode.tagName)):
            if (/float/.test(sourceNode.className)) {
                sourceNodeType = "float";
            } else sourceNodeType = "figure";
            break;
        case (/title/.test(sourceNode.className)):
            sourceNodeType = "headline";
            if (/title-appendix/.test(sourceNode.className)) {
                sourceNodeType = "title-appendix";
            } else sourceNodeType = "title";
            break;
        case (contexts["nodeSplit"]):
            sourceNodeType = "split-node";
            break;
        default:
            sourceNodeType = "regular-node";
            break;
    }

    // define elementBeforeType:
    let elementBeforeType;
    if(elementBefore) {
        if(/FIGURE/.test(elementBefore.tagName)) {
            if (/float/.test(elementBefore.className)) {
                elementBeforeType = "float";
            } else elementBeforeType = "figure";
        }
        else if(/title/.test(elementBefore.className)) {
            elementBeforeType = "title";
        }
        else if(elementBefore.getAttribute("is-split-node")) {
            elementBeforeType = "split-node";
        }
        else elementBeforeType = "regular-node";
    } else elementBeforeType = false;

    // return nodeTypes:
    return nodeTypes = {
        "sourceNodeType": sourceNodeType,
        "elementBeforeType": elementBeforeType,
    };
}

function calculateDistancesOfSplitNodes(contexts, sourceNode) {
            
    let elementSetBefore = contexts["elementSetBefore"];
    let distanceFromNodeBottom = contexts["distanceFromNodeBottom"];
    let distanceFromNodeTop = contexts["distanceFromNodeTop"];
    let nodeMarginTop = contexts["nodeMarginTop"];
    let nodeMarginBottom = contexts["nodeMarginBottom"];
    let pageContentHeight = contexts["pageContentHeight"];
    let footnoteAreaHeight = contexts["footnoteAreaHeight"];

    // set attributes of sourceNode (split-parent):
    let fromNodeBottomBefore = parseFloat(elementSetBefore.getAttribute("fromNodeBottom"));
    distanceFromNodeTop = fromNodeBottomBefore + nodeMarginTop;
    distanceFromNodeBottom = pageContentHeight - nodeMarginBottom;

    let heightOfSplitParent = distanceFromNodeBottom - distanceFromNodeTop;
    let nodeHeight = distanceFromNodeBottom - distanceFromNodeTop; 
    let remainingSpace = pageContentHeight - distanceFromNodeBottom;

    contexts["distanceFromNodeTop"] = distanceFromNodeTop;
    contexts["distanceFromNodeBottom"] = distanceFromNodeBottom;
    contexts["nodeHeight"] = nodeHeight;
    contexts["remainingSpace"] = Math.round(remainingSpace);
    contexts["footnoteAreaHeight"] = footnoteAreaHeight;

    // set attributes of renderNode (split-child):
    let calculatedHeight = calculateHeightOfSplitNode(sourceNode, contexts);

    // get marginBottom of renderNode:
    let marginBottom = parseInt(getComputedStyle(sourceNode).marginBottom); 

    let heightOfRenderNode = calculatedHeight - heightOfSplitParent + nodeMarginBottom;
    let fromNodeBottomRenderNode = heightOfRenderNode + marginBottom;
    let remainingSpaceRenderNode = maxPageContentHeight - heightOfRenderNode;

    // add renderNode values in contexts object:
    contexts["renderNode"]["distanceFromNodeTop"] = minDistanceFromNodeTop;
    contexts["renderNode"]["distanceFromNodeBottom"] = fromNodeBottomRenderNode;
    contexts["renderNode"]["nodeHeight"] = heightOfRenderNode;
    contexts["renderNode"]["remainingSpace"] = Math.round(remainingSpaceRenderNode);
    contexts["renderNode"]["footnoteAreaHeight"] = 1;

    return(contexts);
}

function calculateDistancesOfFigureNodes(contexts, sourceNode) {
            
    let distanceFromNodeBottom = contexts["distanceFromNodeBottom"];
    let distanceFromNodeTop = contexts["distanceFromNodeTop"];
    let pageContentHeight = contexts["pageContentHeight"];
    let pageContentWidth = contexts["pageContentWidth"];
 
    let clientSizes = calculateClientSizeOfFigure(sourceNode, pageContentWidth);
    let figureHeight = Math.round(clientSizes["clientHeightCalculated"]);
    distanceFromNodeBottom = distanceFromNodeTop + figureHeight;
    let remainingSpace = pageContentHeight - distanceFromNodeBottom;

    contexts["distanceFromNodeTop"] = distanceFromNodeTop;
    contexts["distanceFromNodeBottom"] = distanceFromNodeBottom;
    contexts["nodeHeight"] = figureHeight;
    contexts["remainingSpace"] = Math.round(remainingSpace);

    return(contexts);
}

function calculateDistancesOfRegularNodes(contexts) {

    let distanceFromNodeBottom = contexts["distanceFromNodeBottom"];
    let distanceFromNodeTop = contexts["distanceFromNodeTop"];
    let pageContentHeight = contexts["pageContentHeight"];
            
    // calculate nodeHeight and remaining space:
    let nodeHeight = distanceFromNodeBottom - distanceFromNodeTop; 
    let remainingSpace = pageContentHeight - distanceFromNodeBottom;

    // set remainingSpace to 0 if it has negative value;
    remainingSpace = (remainingSpace < 0) ? 0 : remainingSpace;

    // update sourceNode values in contexts object:
    contexts["distanceFromNodeTop"] = distanceFromNodeTop;
    contexts["distanceFromNodeBottom"] = distanceFromNodeBottom;
    contexts["nodeHeight"] = nodeHeight;
    contexts["remainingSpace"] = Math.round(remainingSpace);

    // update renderNode values in contexts object:
    contexts["renderNode"]["distanceFromNodeTop"] = distanceFromNodeTop;
    contexts["renderNode"]["distanceFromNodeBottom"] = distanceFromNodeBottom;
    contexts["renderNode"]["nodeHeight"] = nodeHeight;
    contexts["renderNode"]["remainingSpace"] = Math.round(remainingSpace);
    contexts["renderNode"]["footnoteAreaHeight"] = contexts["footnoteAreaHeight"];

    return(contexts);
}

function calculateDistancesOfTitleNodes(contexts, sourceNode) {

    let distanceFromNodeBottom = contexts["distanceFromNodeBottom"];
    let distanceFromNodeTop = contexts["distanceFromNodeTop"];
    let pageContentHeight = contexts["pageContentHeight"];

    // calculate nodeHeight and remaining space:
    let nodeHeight = distanceFromNodeBottom - distanceFromNodeTop; 
    let remainingSpace = pageContentHeight - distanceFromNodeBottom;

    // avoid orphans by adding remaining-space as margin-top (push to next page)
    if (remainingSpace <= noOrphanArea && autoAvoidOrphans) {
        let marginBottom = parseInt(getComputedStyle(sourceNode).marginBottom); 
        sourceNode.style.marginTop = noOrphanArea * 1.5 + "px";
        fromNodeBottomRenderNode = nodeHeight + marginBottom;
        remainingSpaceRenderNode = maxPageContentHeight - nodeHeight;

        // add renderNode values in contexts object:
        contexts["renderNode"]["distanceFromNodeTop"] = minDistanceFromNodeTop;
        contexts["renderNode"]["distanceFromNodeBottom"] = fromNodeBottomRenderNode;
        contexts["renderNode"]["nodeHeight"] = nodeHeight;
        contexts["renderNode"]["remainingSpace"] = Math.round(remainingSpaceRenderNode);
        contexts["renderNode"]["footnoteAreaHeight"] = 1;
    }

    // update sourceNode values in contexts object:
    contexts["distanceFromNodeTop"] = distanceFromNodeTop;
    contexts["distanceFromNodeBottom"] = distanceFromNodeBottom;
    contexts["nodeHeight"] = nodeHeight;
    contexts["remainingSpace"] = Math.round(remainingSpace);

    // update renderNode values in contexts object:
    contexts["renderNode"]["distanceFromNodeTop"] = distanceFromNodeTop;
    contexts["renderNode"]["distanceFromNodeBottom"] = distanceFromNodeBottom;
    contexts["renderNode"]["nodeHeight"] = nodeHeight;
    contexts["renderNode"]["remainingSpace"] = Math.round(remainingSpace);
    contexts["renderNode"]["footnoteAreaHeight"] = contexts["footnoteAreaHeight"];
 
    return(contexts);
}


function testCalculationsOfNodeDistances(pageElement) {
    
    let pageId = (pageElement !== null) ? pageElement.id : false;
    let pageContent = pageElement.querySelector(".pagedjs_page_content");

    let selector = ".text-content:not(.page-title,.page-subtitle,.page-authors),figure";
    let elementsOfPage = pageContent.querySelectorAll(selector);
    for (let i = 0; i < elementsOfPage.length; i++) {
        let element = elementsOfPage[i]; 
        let isSplitNode = element.getAttribute("is-split-node");
        let isSplitNodeParent = element.getAttribute("is-split-node-parent");
        let dataId = element.getAttribute("data-id");
        let elementId = (isSplitNode) ? "split-child-" + dataId : element.id;
        elementId = (isSplitNodeParent) ? "split-parent-" + elementId : elementId;

        // get bounding client rectangles of pageContent:
        let pageContentTop = pageContent.getBoundingClientRect().top;
        let pageContentHeight = pageContent.offsetHeight;
     
        // get height of footnoteArea:
        let footnoteArea = pageElement.querySelector(".pagedjs_footnote_area");
        let footnoteAreaHeight = footnoteArea.getBoundingClientRect().height;
        footnoteAreaHeight = Math.round(footnoteAreaHeight);

        // get bounding client rectangle of nodes:
        let nodeTop = element.getBoundingClientRect().top;
        let nodeBottom = element.getBoundingClientRect().bottom;
        let nodeMarginTop = parseInt(getComputedStyle(element).marginTop);
        let nodeMarginBottom = parseInt(getComputedStyle(element).marginBottom);

        // pre-calculate distances of node to top of page:
        let fromNodeTop = Math.round(nodeTop - pageContentTop + nodeMarginTop);
        let fromNodeBottom = Math.round(nodeBottom - pageContentTop + nodeMarginBottom);

        // calculate nodeHeight and remaining space:
        let nodeHeight = fromNodeBottom - fromNodeTop; 
        let remainingSpace = pageContentHeight - fromNodeBottom;
       
        // define pageContexts calculated:
        let fromNodeTopCalc = parseInt(element.getAttribute("fromNodeTop"));
        let fromNodeBottomCalc = parseInt(element.getAttribute("fromNodeBottom"));
        let nodeHeightCalc = parseInt(element.getAttribute("nodeHeight"));
        let remainingSpaceCalc = parseInt(element.getAttribute("remainingSpace"));
        let footnoteAreaHeightCalc = parseInt(element.getAttribute("footnoteAreaHeight"));

        // adjust remainingSpace by repecting the footnote situation during rendering:
        let footnoteAreaDiff = footnoteAreaHeight - footnoteAreaHeightCalc;
        remainingSpace = remainingSpace + footnoteAreaDiff;
        remainingSpace = (remainingSpace > 0) ? remainingSpace : 0;

        // display:
        let failColor = "color: red;"
        let warnColor = "color: #ffc107;";
        let passedColor = "color: green;";

        // if(/FIGURE/.test(element.tagName)) {
        
            let pageIdLog = pageId + "----------------------";
            let elementIdLog = "---" + elementId;
            console.log(pageIdLog );
            console.log(elementIdLog);
    
            let fromNodeTopLog = "------fromNodeTop => was: " + 
                fromNodeTopCalc + ", is: " + fromNodeTop;
            if(isNaN(fromNodeTopCalc)) {
                console.log("%c" + fromNodeTopLog, failColor);
            }
            else if(Math.abs(fromNodeTop - fromNodeTopCalc) >= 10) {
                console.log("%c" + fromNodeTopLog, warnColor);
            } else {console.log("%c" + fromNodeTopLog, passedColor);}
    
            let fromNodeBottomLog = "------fromNodeBottom => was: " + 
                fromNodeBottomCalc + ", is: " + fromNodeBottom;
            if(isNaN(fromNodeBottomCalc)) {
                console.log("%c" + fromNodeBottomLog, failColor);
            }
            else if(Math.abs(fromNodeBottom - fromNodeBottomCalc) >= 10) {
                console.log("%c" + fromNodeBottomLog, warnColor);
            } else {console.log("%c" + fromNodeBottomLog, passedColor);}
    
            let nodeHeightLog = "------nodeHeight => was: " + 
                nodeHeightCalc + ", is: " + nodeHeight;
            if(isNaN(nodeHeightCalc)) {
                console.log("%c" + nodeHeightLog, failColor);
            }
            else if(Math.abs(nodeHeightCalc - nodeHeight) >= 10) {
                console.log("%c" + nodeHeightLog,  warnColor);
            } else {console.log("%c" + nodeHeightLog, passedColor);}

            // compare remaining space and footnoteArea
            let remainingSpaceLog = "------remainingSpace => was: " + 
            remainingSpaceCalc + "; is: " + remainingSpace;
            if(isNaN(remainingSpace)) {
                console.log("%c" + remainingSpaceLog, failColor);
            }
            else if(Math.abs(remainingSpaceCalc - remainingSpace) >= 10) {
                console.log("%c" + remainingSpaceLog, warnColor);
            } else {console.log("%c" + remainingSpaceLog, passedColor);}
    
            let footnoteAreaHeightLog = "------footnoteAreaHeight => " + 
            " at node: " + footnoteAreaHeightCalc + 
            "; at page end: " + footnoteAreaHeight;
            console.log(footnoteAreaHeightLog);

            console.log("---Element", element);
    
        
       // }
    } 
}

/**
 * calculate height of split node [data-split-to]:
 * @param {node} sourceNode original node from parsedContent currently rendered
  * @param {JSON} contexts parameter collection (e.g. pageId, elementSetBefore,
 * distances etc), predefined before as pageContexts
 * @returns {Number} distance to page-top from node-bottom in px
 * 
 */ 
function calculateHeightOfSplitNode(sourceNode, contexts) {

    let pageContentWidth = contexts["pageContent"].offsetWidth;

    // calculate text-width of sourceNode text:   
    let textStyles = getComputedStylesOfTextElements(); // e.g. "9.3pt Noto Serif"
    let font = textStyles["paraFontSizeDeclared"] + " " + textStyles["paraFont"];
    let textWidth = getTextWidth(sourceNode.innerText, font);
    let linesComplete = Math.ceil(textWidth / pageContentWidth); 

    // calculate text-height by lineHeight:
    let heightParagraphLinePx = textStyles["heightParagraphLinePx"];
    let calculatedHeight = linesComplete * Math.ceil(heightParagraphLinePx);
    
    return(calculatedHeight);
}

/**
 * set page contexts information as an attribute node of element:
 * @param {JSON} contexts parameter collection (e.g. pageId, elementSetBefore,
 * distances etc), predefined before as pageContexts
 * @param {node} sourceNode original node from parsedContent currently rendered
 * @param {node} renderNode cloned node that is added to the DOM; if pagedJs splits
 * the sourceNode, renderNode is rendered on the next page
 * @returns {void} contexts information will be saved as attribute node of element
 */
function setPageContextsAsElementAttribute(contexts, sourceNode, renderNode) {

    // set contexts values as attributes of sourceNode:
    if(sourceNode !== undefined) {
        sourceNode.setAttribute('fromNodeTop', contexts["distanceFromNodeTop"]);
        sourceNode.setAttribute('fromNodeBottom', contexts["distanceFromNodeBottom"]);
        sourceNode.setAttribute('nodeHeight', contexts["nodeHeight"]);
        sourceNode.setAttribute('remainingSpace', contexts["remainingSpace"]);
        sourceNode.setAttribute('footnoteAreaHeight', contexts["footnoteAreaHeight"]);
        sourceNode.setAttribute("pageContentTop", contexts["pageContentTop"]);
    }

    // set contexts values as attributes of renderNode:
    let contextRenderNode = contexts["renderNode"];
    if(renderNode !== undefined) {
        renderNode.setAttribute('fromNodeTop', contextRenderNode["distanceFromNodeTop"]);
        renderNode.setAttribute('fromNodeBottom', contextRenderNode["distanceFromNodeBottom"]);
        renderNode.setAttribute('nodeHeight', contextRenderNode["nodeHeight"]);
        renderNode.setAttribute('remainingSpace', contextRenderNode["remainingSpace"]);
        renderNode.setAttribute('footnoteAreaHeight', contextRenderNode["footnoteAreaHeight"]);
        renderNode.setAttribute("pageContentTop", contexts["pageContentTop"]);
    }

 

    /* concat all attributes values together:
    let allAttributeValues = "fromNodeTop: " + contexts["distanceFromNodeTop"] + "px | " +
    "fromNodeBottom: " + contexts["distanceFromNodeBottom"] + "px | " +
    "nodeHeight: " + contexts["nodeHeight"] + "px | " +
    "remainingSpace: " + contexts["remainingSpace"] + "px | " +
    "footnoteAreaHeight: " + contexts["footnoteAreaHeight"] + "px | " +
    "elementBefore: " + contexts["elementSetBeforeTagName"];
    */

    // add all attributes as data-after-attribute:
    // sourceNode.setAttribute('data-after', allAttributeValues);
    // renderNode.setAttribute('data-after', allAttributeValues);
}

/**
 * adjust layout of meta-titles (appendix), e.g. Abstract, Author information, in order
 * to places these headlines on top of each page
 * @param {node} sourceNode original node from parsedContent currently rendered
 * @returns {void} adds marginTop to title element depending on remainingSpace of previous page
 */
function adjustLayoutOfAppendixTitles(sourceNode) {

    if(/title-appendix/.test(sourceNode.className)) {

        // define page contexts of source node:
        let contexts = definePageContextsOfSourceNode(sourceNode);
        contexts = calculateNodeDistances(contexts, sourceNode);

        // add top-margins to title-appendixes and push them to next column
        // let bottomAreaNoTitleAppendixPx = contexts["pageContentHeight"]-100;
        if(contexts["distanceFromNodeTop"] !== 0) {
           // sourceNode.style.marginTop = contexts["remainingSpace"] + "px";
           sourceNode.style.marginTop = contexts["pageContentHeight"] + "px";
        }        
    }
}

/* ----------------------------------------
Handle typesetting of figure elements:
-----------------------------------------*/
/**
 * process figure enhancing: meta function used to control the typesetting of figures:
 * based on defined typesetting classes, figure constellations, layout specs and page
 * contexts it decides if the figures currently processed will be inserted or pushed 
 * to the following node until it fits:
 * @param {JSON} nodeParams: parameter collection (e.g. pageContext-parameter,
 * target figure references, target figure Elements)
 * @returns {void} figures saved in nodeParams will be inserted in renderNode or not.
 */

function processFigureEnhancing(nodeParams) {

    // shorten nodeParams and contextsParams:
    let sourceNode = nodeParams["sourceNode"];
    let renderNode = nodeParams["renderNode"];
    let contexts = nodeParams["contexts"];
    let currentFigure = nodeParams["currentFigure"];
    let nextFigure = nodeParams["nextFigure"];

    // preset default typesetting classes:
    if(currentFigure) setFigureTypesettingClass(currentFigure);
    if(nextFigure) setFigureTypesettingClass(nextFigure);

    // get typesetting instructions by figConstellationKeys:
    let classes = getTypesettingClassesOfConstellations(contexts, nodeParams);
    let keys = classes["beforeCurrent"] + "#" + classes["current"]  + "#" + classes["next"];
    let figConstellations = JSON.parse(localStorage.getItem("fig-constellations"))[0];
    let set = figConstellations[keys];

    if(set !== undefined && set) {

        // set final layout specs of figures:
        if(currentFigure) setLayoutSpecsOfFigure(currentFigure, set["currentFigure"][1]);
        if(nextFigure) setLayoutSpecsOfFigure(nextFigure, set["nextFigure"][1]);

        // check if figures fit in current page frame (remaining space)
        let fits = figuresFitInCurrentPageFrame(set, nodeParams);

        // forced: set all figures ignoring context calculation:
        if(setAllFigures) {
            if(currentFigure) {
                fits["currentFigure"] = true;
                setLayoutSpecsOfFigure(currentFigure, "inset");
            }
            if(nextFigure) {
                fits["nextFigure"] = true;
                setLayoutSpecsOfFigure(nextFigure, "inset");
            }
        }

        // execute instructions:
        if(fits["currentFigure"] && fits["nextFigure"]) {
            addTemporaryMarginToFloatingFigure(nextFigure, contexts);
            addTemporaryMarginToFloatingFigure(currentFigure, contexts);
            renderNode.insertAdjacentElement("afterend", nextFigure);
            renderNode.insertAdjacentElement("afterend", currentFigure);
            updateFigureMap(nextFigure.id);
            updateFigureMap(currentFigure.id);
        }
        else if(fits["currentFigure"]) {
            addTemporaryMarginToFloatingFigure(currentFigure, contexts);
            renderNode.insertAdjacentElement("afterend", currentFigure);
            updateFigureMap(currentFigure.id);
            pushFigRefToNextNode(sourceNode.id, nextFigure.id);
        } 
        else {
            pushFigRefToNextNode(sourceNode.id, currentFigure.id);
            pushFigRefToNextNode(sourceNode.id, nextFigure.id);
        }
    }
}

/**
 * set layout specifications (width and height) of figure
 * @param {HTMLElement} figure figure element currently on stage
 * @param {string} addClass given typesetting class; false by default
 * @returns {void} specs will be directly added as style of figure element
 */
function setLayoutSpecsOfFigure(figure, addClass = false) {

    if(figure) {
        // define and set typesetting class:
        let typesettingClass = setFigureTypesettingClass(figure, addClass);  
        let figureModelSpecs = getFigureModelSpecs(figure, typesettingClass);

        // define figure specs by typesettingClass
        let figureWidthPreset = (figureModelSpecs) ? figureModelSpecs[0] : false;
        let figureHeightPreset = (figureModelSpecs) ? figureModelSpecs[1] : false;

        // pre-assign specs of figure-width and -height:
        figure.style.width = (figureWidthPreset) ? figureWidthPreset : "auto";
        figure.style.height = (figureHeightPreset) ? figureHeightPreset : "auto";
    }
}

/**
 * set typesetting class of figure element
 * @param {HTMLElement} figure figure element currently on stage
 * @param {string} addClass given typesetting class; false by default
 * @returns {string} typesettingClass: the name of the typesettingClass
 * typesettingClass will additionally added to classList of figure
 */

function setFigureTypesettingClass(figure, addClass = false) {

    let figureMap = JSON.parse(localStorage.getItem("figure-map"));
    let typesettingClass;

    // define typesetting class:
    if(figure) {
        // set typesettingClass saved in figureMap:
        if(figureMap[figure.id]["typesettingClass"]) {
            typesettingClass = figureMap[figure.id]["typesettingClass"];
        }
        // set typesettingClass given by user or figure constellation:
        else if(addClass) {
            typesettingClass = addClass;
        }
        // set default typesettingClass
        else {
            typesettingClass = getDefaultFigureTypesettingClass(figure);
        }
        // remove former class from figure element:
        if(figure.classList[typesettingClassListKey] !== undefined) {
            figure.classList.remove(figure.classList[typesettingClassListKey]);
        }
        // add new  typesetting class to figure element:
        figure.classList.add(typesettingClass);
    }
    return(typesettingClass);
}

/**
 * get default typesetting class of figure from journalConfig. Search
 * key is defined by resolutionTypeClass (e.g. small) and ratioClass 
 * (e.g. landscape)
 * @param {HTMLElement} figure figure element currently on stage
 * @returns {string} typesettingClass: the name of typesettingClass
 */
function getDefaultFigureTypesettingClass(figure) {

    let typesettingClass;
    let figureKey;

    // define search keys by calculated figure classes:
    let resTypeFigure = (figure) ? figure.classList[resTypeClassListKey] : false;
    let ratioFigure = (figure) ? figure.classList[ratioClassListKey] : false;
    figureKey = (figure) ? resTypeFigure + "-" + ratioFigure : "";

    // get typeSettingClass from journalConfig:
    let journalConfig = JSON.parse(localStorage.getItem("journal-config"));
    typesettingClass = journalConfig["figureTypesettingClass"][figureKey];
    
    return(typesettingClass);
}

/**
 * get figure model specifications (width and height) from journal-config,
 * from figure map (document specific) or default specs (fallback)
 * key is defined by resolutionTypeClass (e.g. small) and ratioClass 
 * (e.g. landscape)
 * @param {HTMLElement} figure figure element currently on stage
 * @param {string} typesettingClass: the name of typesettingClass
 * @returns {array} figureModelSpecs as array [width, height]
 */
function getFigureModelSpecs(figure, typesettingClass) {

    let figureModelSpecs;
    let figureMap = JSON.parse(localStorage.getItem("figure-map"));
    let journalConfig = JSON.parse(localStorage.getItem("journal-config"));

    // check for figure styles saved in figureMap:
    if(figureMap && figureMap[figure.id]["style"]) {
        figure.style.cssText = figureMap[figure.id]["style"];
        figureModelSpecs = [figure.style.width, figure.style.height];
    } 
    // get specs from journal-config:
    else if(journalConfig["figureModelSpecs"][typesettingClass] !== undefined) {
        figureModelSpecs = journalConfig["figureModelSpecs"][typesettingClass];
    }
    // set default specs:
    else {
        figureModelSpecs = ["100%", "100%"];
    }    
    return(figureModelSpecs);
}

/**
 * helper function: get typesetting class of each figures in figure constellation, 
 * that means the typesetting class of the figure typeset before (if existing), the
 * the class of the current figure and the next figure
 * @param {JSON} contexts parameter collection (e.g. pageId, elementSetBefore,
 * distances etc), predefined before as pageContexts
 * @param {JSON} nodeParams: parameter collection (e.g. pageContext-parameter,
 * target figure references, target figure Elements)
 * @returns {JSON} typesetting classes of each figure
 */
function getTypesettingClassesOfConstellations(contexts, nodeParams) {

    let elementSetBefore = contexts["elementSetBefore"]
    let currentFigure = nodeParams["currentFigure"];
    let nextFigure = nodeParams["nextFigure"];

    let currentFigureClass = (currentFigure) ? currentFigure.classList[typesettingClassListKey] : false;
    let nextFigureClass = (nextFigure) ? nextFigure.classList[typesettingClassListKey] : false;
    let figureBeforeCurrentClass;

    if(elementSetBefore && elementSetBefore.tagName === "FIGURE") {
        figureBeforeCurrentClass = elementSetBefore.classList[typesettingClassListKey];
        if(/onTopOfPage/.test(figureBeforeCurrentClass)) {
            figureBeforeCurrentClass = elementSetBefore.classList[3];
        }
    }
    else {figureBeforeCurrentClass = false;}

    let typesettingClasses = {
        "beforeCurrent": figureBeforeCurrentClass,
        "current": currentFigureClass,
        "next": nextFigureClass
    }
    return(typesettingClasses);
}

/**
 * add a temporary margin-bottom to floating figure. The negative margin has
 * the purpose to give a virtual space to the text nodes following the figure
 * on page during pagedJs rendering. Currently pagedJs does not handle floating 
 * elements properly in regard to pageBreaks. Without this margin - overwritten 
 * later by the regular css-specs in the stylesheets - a lot of whitespace would 
 * be left. 
 * The margin value itself is calculated based on figureClientHeight and 
 * figureClientWidth in relation to floating text lines
 * @param {HTMLElement} figure figure element currently on stage
 * @param {JSON} contexts parameter collection (e.g. pageId, elementSetBefore,
 * distances etc), predefined before as pageContexts
 * @returns {void}  margin-bottom will set as inline-style of figure element
 */
function addTemporaryMarginToFloatingFigure(figure, contexts) {

    // get properties from document root:
    let documentRoot = document.querySelector(':root');
    let offsetToMarginAreaDeclared = getComputedStyle(documentRoot)
        .getPropertyValue("--floatFigureOffsetToMarginArea");
    let figureMarginBottomDefault = getComputedStyle(documentRoot)
    .getPropertyValue("--figureMarginBottomDefault");

    if(/float/.test(figure.className)) {
        // parse offsetToMarginArea properties to int:
        let offsetToMarginArea;
        if(offsetToMarginAreaDeclared) {
            offsetToMarginArea = offsetToMarginAreaDeclared.slice(0, -2) * 3.78; // 1mm = 3.7795px
        } else offsetToMarginArea = 150; // default margin
        offsetToMarginArea = Math.abs(offsetToMarginArea); // turn negative value to positive

        // calculate client sizes of figure:
        let pageContentWidth = contexts["pageContentWidth"];
        let clientSizes = calculateClientSizeOfFigure(figure, pageContentWidth);
        let figureWidth = clientSizes["clientWidthCalculated"];
        let figureHeight = clientSizes["clientHeightCalculated"];
        let marginBottom = clientSizes["marginBottom"];
        let sideMargin = clientSizes["sideMargin"];

        // calculate width of floating text area:
        let lineWidth; /* expected with of text area based on figureWidth */
        if(figureWidth - sideMargin - offsetToMarginArea > 0) {
            lineWidth = figureWidth - offsetToMarginArea;
        } 
        // for figures which repress no text at all:
        else lineWidth = figureWidth; 
        let textFloatWidth = pageContentWidth - lineWidth;
        let textFloatPercent = textFloatWidth / pageContentWidth;
       
        // calculate height of floating text area:
        let textStyles = getComputedStylesOfTextElements();
        let textLines = figureHeight / textStyles["heightParagraphLinePx"];
        let textHeight = textLines * textStyles["heightParagraphLinePx"];

        // calculate virtualMargin (- subtract regular marginBottom):
        let virtualMargin = textHeight * textFloatPercent - marginBottom - sideMargin;
        virtualMargin = virtualMargin * virtualMarginBuffer; // e.g. * 0.9 (const)
    
        // set negative margin value as inline-style:
        figure.style.marginBottom = "-" + virtualMargin + "px"; 
    }
    // set marginBottom to default margin if figure was set to float before:
    else {
        figure.style.marginBottom = figureMarginBottomDefault; // e.g. 7.5mm
    }
}

/**
 * determine if figures fit in current page frame
 * @param {JSON} set: typesetting instructions from figConstellations.json 
 * defined by each classes of figure constellation
 * @param {JSON} nodeParams: parameter collection (e.g. pageContext-parameter,
 * target figure references, target figure Elements)
 * @returns {JSON} fits: object with booleans for current and next figure
 */
function figuresFitInCurrentPageFrame(set, nodeParams) {

    let contexts = nodeParams["contexts"];
    let remainingSpace = contexts["remainingSpace"];
    let currentFigure = nodeParams["currentFigure"];
    let nextFigure = nodeParams["nextFigure"];
    
    // calculate clientSize of figure (includes figCaption and marginBottom)
    let pageContentWidth = contexts["pageContentWidth"];
    let clientSizeCurrentFigure = calculateClientSizeOfFigure(currentFigure, pageContentWidth);
    let clientSizeNextFigure = calculateClientSizeOfFigure(nextFigure, pageContentWidth);
    let clientHeightCurrentFigure = clientSizeCurrentFigure["clientHeightCalculated"];
    let clientHeightNextFigure = clientSizeNextFigure["clientHeightCalculated"];

    // substract height of footnoteArea from pageContentHeight:
    // let remainingSpace = contexts["remainingSpace"] - contexts["footnoteAreaHeight"];
    remainingSpace = remainingSpace * pageSpaceBuffer; // add a slight pageSpaceBuffer:
    
    /* set pageContentHeight if remainingSpace has negative value (= leads to pageBreak):
    remainingSpace = (remainingSpace < 0) ? contexts["pageContentHeight"] : remainingSpace;
    */

    // check settings of current and next figure together:
    let fitsCurrentFigure;
    let fitsNextFigure;
    if(set["currentFigure"][0] && set["nextFigure"][0]) {
        if(remainingSpace > (clientHeightCurrentFigure + clientHeightNextFigure)) {
            fitsCurrentFigure = true;
            fitsNextFigure = true;
        }
        else if(remainingSpace > clientHeightCurrentFigure) {
            fitsCurrentFigure = true;
            fitsNextFigure = false;
        }
        else {
            fitsCurrentFigure = false;
            fitsNextFigure = false;
        }    
    }
    // check setting of current figure only:
    else if(set["currentFigure"][0]) {
        if(remainingSpace > clientHeightCurrentFigure) {
            fitsCurrentFigure = true;
            fitsNextFigure = false;
        }
        else {
            fitsCurrentFigure = false;
            fitsNextFigure = false;
        }
    }
    else {
        fitsCurrentFigure = false;
        fitsNextFigure = false;
    }
    // exclude pages which have n-Figures already:
    if(contexts["isPageFigureMax"]) {
        fitsCurrentFigure = false;
        fitsNextFigure = false;
    }
    // avoid figure after headline:
    if(/title/.test(nodeParams["sourceNode"].className)) {
        fitsCurrentFigure = false;
        fitsNextFigure = false;
    }
 
    // return results as object:
    return fits = {
        "currentFigure": fitsCurrentFigure,
        "nextFigure": fitsNextFigure
    }
}

/**
 * calculate client size of figure not yet added to DOM. It integrates
 * all size critical elements of figure (image, figCaption and each 
 * margins) 
 * @param {HTMLElement} figure figure element currently on stage
 * @param {int} pageContentWidth: width of text-area (without page-margins)
 * @returns {JSON} clientSizes: object with relevant size-parameter
 */
function calculateClientSizeOfFigure(figure, pageContentWidth) {

    // calculate clientWidth and clientHeight of figure:
    let clientSizes = {};
    let clientWidthCalculated = 0;
    let clientHeightCalculated = 0;
    let clientHeightFigCaption = 0;

    if(figure) {  
        // get available size parameter:
        let naturalWidth = figure.getAttribute("data-img-width");
        let naturalHeight = figure.getAttribute("data-img-height");
        let ratio = naturalWidth / naturalHeight;

        // calculate by width (css-)percentage values:
        let widthPercentage = figure.style.width.slice(0, -1); // e.g. 50
        clientWidthCalculated = pageContentWidth * widthPercentage / 100;
        clientHeightCalculated = clientWidthCalculated / ratio;  

        // calculate img and figure margins:
        let documentRoot = document.querySelector(':root');
        let imgMarginBottomDeclared = getComputedStyle(documentRoot).getPropertyValue("--imgMarginBottom");
        let imgMarginBottom = (imgMarginBottomDeclared) ? imgMarginBottomDeclared.slice(0, -2) * 3.78 : 10;
        let marginBottomDeclared = getComputedStyle(documentRoot).getPropertyValue("--floatFigureMarginBottom");
        let marginBottom = (marginBottomDeclared) ? marginBottomDeclared.slice(0, -2) * 3.78 : 28;
     
        // calculate clientHeight of figCaption
        clientHeightFigCaption = calculateClientHeightOfFigCaption(figure, clientWidthCalculated);
 
        // add clientHeightFigCaption and marginBottom to calculated clientHeight of figure:
        clientHeightCalculated = clientHeightCalculated + imgMarginBottom + clientHeightFigCaption + marginBottom;

        // add sideMargins to clientWidthFigure:
        let sideMarginDeclared = getComputedStyle(documentRoot).getPropertyValue("--floatFigureMarginToText");
        let sideMargin = (sideMarginDeclared ) ? sideMarginDeclared .slice(0, -2) * 3.78 : 38;
        clientWidthCalculated = clientWidthCalculated + sideMargin;

        // round client sizes by fixed-point notation:
        clientWidthCalculated = Math.round(parseFloat(clientWidthCalculated));
        clientHeightCalculated = Math.round(parseFloat(clientHeightCalculated));

        // assign values to clientSizes:
        clientSizes = {
            "clientWidthCalculated": clientWidthCalculated,
            "clientHeightCalculated": clientHeightCalculated,
            "marginBottom": marginBottom,
            "sideMargin": sideMargin
        }
    }
    return(clientSizes);
}

/**
 * calculate client-height of figure caption
 * @param {HTMLElement} figure: figure element currently on stage
 * @param {int} clientWidthCalculated: clientWidth of figure
 * @returns {int} heightFigCaption: height in px
 */
function calculateClientHeightOfFigCaption(figure, clientWidthCalculated) {

    // get all parameters:
    let figCaption = figure.querySelector(".caption-text");
    let textStyles = getComputedStylesOfTextElements();
    let captionFontStyles = textStyles["captionFontSizeDeclared"] + " " + textStyles["captionFont"];

    // calculate length of textWidth:
    let heightFigCaption = 0;
    if(figCaption && figCaption !== undefined && figCaption !== null) {
        let textWidth = getTextWidth(figCaption.innerText, captionFontStyles);
        let lines = textWidth / clientWidthCalculated;
        let captionLinesRound = Math.ceil(lines); // captionLines
        heightFigCaption = captionLinesRound * textStyles["heightCaptionLinePx"];
    }
    return(heightFigCaption);
}

/* --------------------------------------------------------
classify and adjust elements after node is rendered on page
------------------------------------------------------------*/
/**
 * classify if elements are rendered on left or right page:
 * @param {node} pageElement page element that just been rendered
 * @param {string} selector querySelector of elements
 * @returns {void} classes (right-page or left-page) are added to 
 * selected elements (also as title-attributes)
 */ 

function classifyPageOfElements(pageElement, selector) {

    let pageContent = pageElement.querySelector(".pagedjs_page_content");
    let elementsOfPage = pageContent.querySelectorAll(selector);

    for (let i = 0; i < elementsOfPage.length; i++) {
        // check and add page-class of element:
        let element = elementsOfPage[i];
        if (pageElement.classList[1] === "pagedjs_right_page") {
            element.classList.add("right-page");
        } else {
            element.classList.add("left-page");
        }
        // add classes as element-title attribute:
        if(addClassesAsElementTitle) {
            element.title = element.className;
        }
    }
}

/**
 * classify position of elements on page:
 * @param {node} pageElement page element that just been rendered
 * @param {string} selector querySelector of elements
 * @returns {void} classes (e.g. "first-element", "last-element") are added to 
 * selected elements (also as title-attributes)
 */ 
function classifyElementPositionOnPage(pageElement, selector) {

    let pageContent = pageElement.querySelector(".pagedjs_page_content");
    let elementsOfPage = pageContent.querySelectorAll(selector);
    let lastIndex = elementsOfPage.length - 1;

    for (let i = 0; i < elementsOfPage.length; i++) {
        let element = elementsOfPage[i];      
        switch (true) {
            case (elementsOfPage.length === 1):
                element.classList.add("alone");
                break;
            case (elementsOfPage[0] === element):
                element.classList.add("first-element");
                break;
            case (elementsOfPage[lastIndex].id === element.id):
                element.classList.add("last-element");
                break;
            default:
                element.classList.add("in-between");
                break;
        }
        // add classes as element-title attribute:
        if(addClassesAsElementTitle) {
            element.title = element.className;
        }
    }
}

/**
 * push (figure) element on top of page with respect to the given figure order.
 * @param {node} pageElement page element that just been rendered
 * @param {string} selector querySelector of all common block elements on page
 * @returns {void} figure elements will be relocated by insertAdjacent-statements
 */ 
function pushFigureElementOnTopOfPage(pageElement, selector) {

    let onTopOfPage = (allFiguresOnTop) ? ["regular", "regular-bottom", "overmargin", 
        "overmargin-bottom", "inset", "float-w-col-2", "float-w-col-4", "float-w-col-6"] : [];

    let pageContent = pageElement.querySelector(".pagedjs_page_content");
    let elementsOfPage = pageContent.querySelectorAll(selector);
    for (let i = 0; i < elementsOfPage.length; i++) {
        let element = elementsOfPage[i];
        let firstElement = elementsOfPage[0];
        //  adjust figure elements:
        if (element.matches("figure") && i !== 0) {
            // check positionClass and add positionClass saved in figureMap:
            let figureMap = JSON.parse(localStorage.getItem("figure-map"));
            if (figureMap[element.id]["positionClass"]) {
                element.classList.add(figureMap[element.id]["positionClass"]);
            }
            //  push figure with positionClass on top of each page
            if(onTopOfPage.some(className => element.classList.contains(className))
                || /onTopOfPage/.test(element.className)) {
             
                // if first element is figure push element after this figure:
                if(firstElement.matches("figure")) {
                    if(/regular/.test(firstElement.className) || 
                    /overmargin/.test(firstElement.className)) {
                        firstElement.insertAdjacentElement("afterend", element);
                    }
                }
                // push element before first element and reassign position class:
                else {
                    firstElement.insertAdjacentElement("beforebegin", element);
                    element.classList.remove(element.classList.item(6));
                    element.classList.add("first-element");
                }
            }
        }
    }
}

/**
 * ignores hyphenation by pagedJs, for partly fixing the following issue: 
 * https://github.com/pagedjs/pagedjs/issues/87
 * @param {node} pageElement - page element that just been rendered
 * @param {node} page - node of the page being rendered
 * @param {Object} breakToken - location of the beginning of the overflow
 * @returns {void} pagedjs_hypen-elements are replaced in DOM
 * 
 */ 
function ignoreHyphenationByPagedJs(pageElement, page, breakToken) {

    if (pageElement.querySelector('.pagedjs_hyphen')) {

        // find the hyphenated word
        let block = pageElement.querySelector('.pagedjs_hyphen');

        // move the breakToken
        let offsetMove = getFinalWord(block.innerHTML).length;
   
        // move the token accordingly
        page.breakToken = page.endToken.offset - offsetMove;

        // remove the last word
        block.innerHTML = block.innerHTML.replace(getFinalWord(block.innerHTML), "");
        breakToken.offset = page.endToken.offset - offsetMove;
    }

    function getFinalWord(words) {
        var n = words.split(" ");
        return n[n.length - 1];
    }
}
