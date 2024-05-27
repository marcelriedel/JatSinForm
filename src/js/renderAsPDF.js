/** ------------------------
* CONSTANTS
----------------------------*/
const resTypeClassListKey = 0;
const ratioClassListKey = 1;
const typesettingClassListKey = 2;
const imageClassThresholdDefault = 5;
const pageSpaceBuffer = 0.89;
const createToC = false;
const urlRegex = /doi|handle|urn|ark:|orcid|ror/g;
const specificUseRegex = "zenon|extrafeatures|supplements";
const onTopOfPage = ["regular", "regular-bottom", "overmargin", "overmargin-bottom",
"inset", "float-w-col-2", "float-w-col-4", "float-w-col-6"]; /*  ["regular", "regular-bottom", "overmargin", "overmargin-bottom",
"inset", "float-w-col-2", "float-w-col-4", "float-w-col-6"] */

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
            updateStorageEventListener("Parsing document...");

            // create article and replace content
            let article = createPDFArticle(content);
            content.replaceChildren();
            content.append(article);
        }

        /** Chunker: afterParsed:
         *  runs after the content has been parsed but before rendering has started
         *  parsed → content once parsed and given ids (data-ref and break rules from the css
         */

        afterParsed(parsed) {
           
            let documentId = getDocumentStateProperty("documentId");
            let previousParaMap = JSON.parse(localStorage.getItem("paragraph-map"));
            if (previousParaMap && previousParaMap["documentId"] === documentId) {
                createPararaphMap(parsed, previousParaMap);
            }
            else {
                createPararaphMap(parsed, false);
            }
         
            let previousFigMap = JSON.parse(localStorage.getItem("figure-map"));
            if (previousFigMap && previousFigMap["documentId"] === documentId) {
                createFigureMap(parsed, previousFigMap);
            }
            else {
                createFigureMap(parsed, false);
            }
        }

        /** Chunker: beforePageLayout
         *  runs when a new page has been created
         *  page → node of the page that’s gonna be created
         */

        beforePageLayout(page, content, breakToken) {}

        /** Layout: render node
         *   When a node is rendered
         *  (renderNode is the cloned node that is added to the DOM)
         */
        renderNode(sourceNode, renderNode, Layout) {

            if (sourceNode && sourceNode.nodeType == Node.ELEMENT_NODE) {

                // get paragrapMap and parsedContent:
                let paragraphMap = JSON.parse(localStorage.getItem("paragraph-map"));
                let parsedContent = Layout.hooks.afterParsed.context.source.firstChild;

                // handle layout of content paragraphs:
                if (paragraphMap[sourceNode.id] && !paragraphMap[sourceNode.id]["isSet"]) {

                    console.log("---------", sourceNode.id, "-----------------");
      
                    // define nodeParams (e.g. position on page, figure references):
                    let nodeParams = defineRenderNodeParameter(sourceNode, renderNode, parsedContent);
          
                    // exclude figures for defined paragraphs (first text page)
                    if(nodeParams["contexts"]["pageId"] === firstTextPageId ) {
                        if(nodeParams["currentFigure"]) {
                            pushFigRefToNextParagraph(sourceNode.id, nodeParams["currentFigure"].id);
                        }
                        if(nodeParams["nextFigure"]) {
                            pushFigRefToNextParagraph(sourceNode.id, nodeParams["nextFigure"].id);
                        }
                    }
                    // process figure enhancing:
                    else {
                        processFigureEnhancing(nodeParams);
                    }

                    /* ------- TESTING -------------*/
                    // create pseudo nodes in case of overcrowding of figure references:
                    let nextParagraph = getNextParagraphInParagraphMap(paragraphMap, sourceNode.id);
                    if(!nextParagraph && nodeParams["numFigRefs"] > 0) {
                        insertPseudoNodeAtEndOfSections(nodeParams, parsedContent);
                        nodeParams["figRefs"] = false;
                    }
                    /*
                    else if(nextParagraph["isFirstOfSection"] && nodeParams["numFigRefs"] >= 4) {
                        insertPseudoNodeAtEndOfSections(nodeParams, parsedContent);
                        nodeParams["figRefs"] = false;
                    }
                    */

                    // handle over rest of figRefs which exceeds the limit maxNumFigures
                    let maxNumFigures = 2; // limit of figures, each one single node can handle
                    if(nodeParams["figRefs"]) {
                        for (let i = maxNumFigures; i < nodeParams["figRefs"].length; i++) {
                            pushFigRefToNextParagraph(sourceNode.id, nodeParams["figRefs"][i]);
                        }
                    }
                    // assign given paragraph styles to paragraph node
                    updateParagraphMap(sourceNode.id, "isSet", true);
                    sourceNode.style.cssText = paragraphMap[sourceNode.id]["style"];
                }
                 // handle layout of text elements (e.g. title elements and tables):
                else {
                    adjustLayoutOfTextElements(sourceNode, renderNode);
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

            // TEST: ignore hyphenation by pagedJs:
            ignoreHyphenationByPagedJs(true, pageElement, page, breakToken);

            // classify if element is rendered on left or right page:
            classifyPageOfElement(pageElement, page);

            // classify position of elements on page:
            classifyElementPositionOnPage(pageElement);

            // render figCaptions at the bottom area of each page:
            let journalConfig = JSON.parse(localStorage.getItem("journal-config"));
            if (journalConfig["figCaptionsAtPageBottom"]) {
                renderFigCaptionsAtpageBottomArea(pageElement);
            }

            // adjust position of element on page:
            adjustElementPositionOnPage(pageElement);

            // assign interactiveJs classes to certain elements:
            makeElementsInteractive(pageElement);

            // urlify plain url-strings in footnote spans:
            recreateAnchorsInFootnoteSpans(pageElement, page);

            checkQualityOfUrls();
        }

        /** Chunker: afterRendered
         *  runs after all pages have finished rendering
         *  pages → array that contains all page nodes
         */

        afterRendered(pages) {
            if (pages) {
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
            clonedImagesContainer.childNodes.forEach(element => {
                if(/FIGURE/.test(element.tagName)) {
                    removePage = false;
                }});
            if(removePage) {
                let page = clonedImagesContainer.closest(".pagedjs_page");
                page.remove();
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
function createPDFArticle(content) {

    // create article with documentId:
    let article = document.createElement("article");
    let documentId = getDocumentStateProperty("documentId");
    article.id = (documentId) ? documentId : "no-id";

    // define short title information for margin-sections:
    let articleTitle = content.querySelector(".article-title").textContent;
    let documentRoot = document.querySelector(':root');
    documentRoot.style.setProperty('--article-title', "'" + articleTitle + "'");
    let journalId = content.querySelector(".journal-id").textContent;

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
        if (journalId === "e-DAI-F" || setEndnotes) {
            noteSection = content.querySelector(".footnotes-section");
            noteSection.id = "endnotes-section";
            noteSection.classList.add("meta-section");
        } else {
            reformatFootnotes(content);
        }
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
    addHeadlineClassesBySectionHierarchy(content, ".title");
    article.innerHTML += content.querySelector(".content-body").outerHTML;
    article.appendChild(referenceList);
    article.append(noteSection);
    article.appendChild(meta);
    article.append(figureSection);
 
    // remove or hide redundant elements:
    article.querySelector(".front").remove();
    article.querySelector(".back").remove();
    if( article.querySelector("#images-container")) {
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
    if(abstract) {
        // re-classify abstractHeadline
        let abstractHeadline = abstract.querySelector(".title");
        if(selector === ".abstract") {
            abstractHeadline.classList.add("abstract-headline");
        }
        else {
            abstractHeadline.classList.add("title-appendix");
        }
        // check maxLength of abstractText
        let abstractText = abstract.querySelectorAll(".abstract-text");
        if (abstractText.length > 0) {
            checkMaxLengthOfAbstractText(abstractText[0]);
        }
        // add keywordsSection
        let keywordsSection = document.createElement("div");
        keywordsSection.classList.add("kwd-group");
        let kwdGroup = content.querySelectorAll(".kwd-group");
        if(kwdGroup.length) {
            for (let i = 0; i < kwdGroup.length; i++) {
                let keywordsLang = kwdGroup[i].getAttribute("xml:lang");
                let abstractLang = abstract.getAttribute("xml:lang");
                // if keywords correspond to abstractLang
                if(keywordsLang === abstractLang) {
                    kwHeadline = kwdGroup[i].querySelector(".title");
                    kwHeadline.classList.add("keywords-headline");
                    keywordsSection.appendChild(kwHeadline);
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
 * check maximum length of abstract text:
 * @param {HTMLElement} abstractText given abstract text
 * @returns {HTMLElement} checked abstractText, eventually
 * enriched with warning class and notice
 */
function checkMaxLengthOfAbstractText(abstractText) {

    // character lengths defined as const
    let maxChars = maxAbstractLength;
    if(abstractText.innerText.length > maxChars) {
        abstractText.classList.add("warning-box");
        abstractText.classList.add("display-data-attributes");
        abstractText.setAttribute('data-before', "!Max-Length:" + maxChars + " characters!");
        abstractText.innerHTML = abstractText.innerText.substring(0, maxChars);
    }
    return(abstractText);
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
    titlePage.className = "page-header";
    let titleElement = document.createElement("h1");
    titleElement.className = "page-title";
    titleElement.innerHTML = (title) ? title.textContent : "[Kein Titel]";
    let subtitleElement = document.createElement("h1");
    subtitleElement.className = "page-subtitle";
    subtitleElement.innerHTML = (subtitle) ? subtitle.textContent : "";

    // create contributors elements and fill with content:
    let authorsElement = document.createElement("h1");
    authorsElement.className = "page-authors";
    authorsElement.innerHTML = (authorsCollection.length) ? authorsCollection.join(", ") : "[Keine Autoren]";
    let contributorsElement = document.createElement("p");
    contributorsElement.className = "page-contributors";
    let lang = document.documentElement.lang;
    if(contributorsCollection.length) {
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

            // highlight uncommonly extensive footnotes
            if(footnotes[i].innerText.length >= maxFootnoteLength) {
                footnote.classList.add("warning-box");
                footnote.classList.add("display-data-attributes");
                footnote.setAttribute('data-before', "!Max-Länge: " +
                maxFootnoteLength + "Zeichen!");
            }
            footnote.innerHTML = footnotes[i].innerText;
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
 * create referenceList or rather bibliography:
 * @param {DocumentFragment} content document-fragment made from original DOM
 * @returns {HTMLElement} referenceList as meta-section with author-year-label,
 * reference titles and external ref-links
 */
function createReferenceList(content) {

    let referenceSection = content.querySelector(".reference-section");
    let references = content.querySelectorAll(".reference");
    let referenceList = document.createElement("div");
    referenceList.id = "reference-list";
    referenceList.classList.add("meta-section");

    // checkout ref-list title:
    let refListTitle;
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
    referenceList.appendChild(refListTitle);

    // recreate reference elements:
    if(references) {
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
            else {
                if(mixedCitation !== null) {
                    mixedCitation.innerHTML = URLifyString(mixedCitation.innerText);
                }
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

        // reorder label and figCaption:
        label.innerHTML = label.innerHTML + ": ";
        figCaption.firstElementChild.classList.add("caption-text");
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
            // add orcid-icon:
            if(/orcid/.test(contribId)) {
                let orcidIcon = document.createElement("span");
                orcidIcon.classList.add("orcid-icon");
                contribIdLink.append(orcidIcon);
            }
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
            // add ror-icon:
            if(/ror/.test(institutionId)) {
                let rorIcon = document.createElement("span");
                rorIcon.classList.add("ror-icon");
                institutionIdLink.append(rorIcon);
            }
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
    let publishingHistory;
    // journal title
    if(content.querySelector(".journal-title") !== null) {
        journalTitle = content.querySelector(".journal-title");
        // publishing history:
        if(content.querySelector(".publishing-history") !== null) {
            publishingHistory = content.querySelector(".publishing-history > .meta-value");
            journalTitle.innerHTML += " " + publishingHistory.innerText;
            content.querySelector(".publishing-history").remove();
            imprintSection.appendChild(journalTitle);
        }
    }
    // publisher:
    if(content.querySelector(".publisher") !== null) {
        let publisher = content.querySelector(".publisher");
        let role = document.createElement("p");
        role.innerText = "Publisher:";
        role.classList.add("role");
        if(publisher.querySelector(".ext-ref") !== null) {
            publisher.querySelector(".ext-ref").remove();
        }
        publisher.insertAdjacentElement("afterbegin", role);
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
    // add credit to JatSinForm:
    let selfReferenceNotice = document.createElement("p");
    selfReferenceNotice.classList.add("self-reference");
    selfReferenceNotice.innerHTML = "This PDF was created with " +
    "<a href='https://github.com/dainst/JatSinForm' target='_blank'>JatSinForm</a>";
    imprintSection.appendChild(selfReferenceNotice);
    return (imprintSection);
}

/**
 * add headline classes by hierarchy of section-elements
 * @param {HTMLElement} content document-fragment made from original DOM
 * @param {selector} selector css-class-selector for headlines, e.g. ".title"
 * @returns {void}
 */
function addHeadlineClassesBySectionHierarchy(content, selector) {

    // add section hierarchy related headline-classes
    let headlines = content.querySelectorAll(selector);
    for (let i = 0; i < headlines.length; i++) {
        let parentNodeId = headlines[i].parentNode.id;
        let numberOfSeparators = parentNodeId.split(".").length-1;
        switch (true) {
            case (numberOfSeparators === 0):
                headlines[i].classList.add("main-title");
                break;
            case (numberOfSeparators === 1):
                headlines[i].classList.add("section-title");
                break;
            case (numberOfSeparators >= 2):
                headlines[i].classList.add("subsection-title");
                break;
            default:
                headlines[i].classList.add("main-title");
        }
    }
}

/* -----------------------------
Handle figure and paragraph maps
--------------------------------*/
/**
 * create paragraph map
 * @param {HTMLElement} parsedContent content once parsed and given ids (data-ref and break rules from the css)
 * @param {JSON} previousMap previous map saved in local storage, e.g. with given style properties 
 * @returns {void} paragraphMap (with figRefs, position and other params) will be saved in local storage
 */
function createPararaphMap(parsedContent, previousMap) {

    let paragraphMap = {};
    let allFigRefs = [];
    let hasSectionId = [];
    let numFigRefsSection = 0;
    let numParagraphsSection = 0;
    let isFirstOfSection;

    // set hash for current html document:
    let documentId = parsedContent.querySelector("article").id;
    paragraphMap["documentId"] = documentId;

    // parse references for each paragraph:
    let selector = "p.content-paragraph";
    if(parsedContent.querySelectorAll(selector) !== null) {
        let paragraphs = parsedContent.querySelectorAll(selector);
        for (let i = 0; i < paragraphs.length; i++) {
            let paragraphId = paragraphs[i].id;
            let references = paragraphs[i].querySelectorAll("a.fig-ref");
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
            // count amout of figures and paragraphs within section
            let parent = paragraphs[i].parentElement;
            if (parent && parent.tagName === "SECTION") {
                if (hasSectionId.includes(parent.id)) {
                    // same section
                    isFirstOfSection = false;
                    numFigRefsSection = numFigRefsSection + figRefs.length;
                    numParagraphsSection = numParagraphsSection + 1;
                }
                else {
                    // new section
                    isFirstOfSection = true;
                    paragraphs[i].classList.add("first-of-section");
                    hasSectionId.push(parent.id);
                    numFigRefsSection = figRefs.length;
                    numParagraphsSection = 1;
                }
            }
            // assign values for each paragraph:
            let values = {
                "position": i,
                "id": paragraphId,
                "figRefs": figRefs,
                "isSet": false,
                "style": (previousMap[paragraphId] !== undefined) ? previousMap[paragraphId]["style"] : false,
                "isFirstOfSection": isFirstOfSection,
                "numFigRefsSection": numFigRefsSection,
                "numParagraphsSection": numParagraphsSection
            };
            paragraphMap[paragraphId] = values;
        }
    }
    // save entire map in local storage:
    localStorage.setItem("paragraph-map", JSON.stringify(paragraphMap));
}

/**
 * update paragraph map
 * @param {string} currentNodeId id of regular text-node (e.g. paragraphs) 
 * @param {string} property property-key of paragraphMap
 * @param {string} value property-value of paragraphMap
 * @returns {void} changes are saved in localStorage
 */
function updateParagraphMap(currentNodeId, property, value) {

    // get current paragraphMap:
    let paragraphMap = JSON.parse(localStorage.getItem("paragraph-map"));
    if (paragraphMap[currentNodeId]) {
        // change given property value
        if(property !== undefined) {
            paragraphMap[currentNodeId][property] = value;
        }
    }
    // save updated figure map:
    localStorage.setItem("paragraph-map", JSON.stringify(paragraphMap));
}

/**
 * get properties of nextParagraph in paragraphMap
 * @param {JSON} paragraphMap paragraphMap (with figRefs, position and other params) will be saved in local storage
 * @param {string} currentNodeId id of regular text-node (e.g. paragraphs) 
 * @returns {JSON, boolean=false} JSON-properties of nextParagraph or boolean=false;
 */
function getNextParagraphInParagraphMap(paragraphMap, currentNodeId) {

    // find position of current node:
    let currentNodePosition = paragraphMap[currentNodeId]["position"];
    let nextNodeId = Object.keys(paragraphMap)
        .find(key => paragraphMap[key]["position"] === currentNodePosition + 1);
 
    // get nextParagraph:
    let nextParagraph;
    if(paragraphMap[nextNodeId] !== undefined) {
        nextParagraph = paragraphMap[nextNodeId];
    }
    else {
        nextParagraph = false;
    }
    return (nextParagraph);
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
            "style": (previousMap) ? previousMap[figure.id]["style"] : false,
            "typesettingClass": (previousMap) ? previousMap[figure.id]["typesettingClass"] : false,
            "positionClass": (previousMap) ? previousMap[figure.id]["positionClass"] : false
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

    // get paragraph and figure map:
    let paragraphMap = JSON.parse(localStorage.getItem("paragraph-map"));
    let figureMap = JSON.parse(localStorage.getItem("figure-map"));
    let currentNodePosition = paragraphMap[currentNodeId]["position"];
    
    // find next figure references in all paragraphs within rangeNextFigRefs:
    let nextFigRefs = [];
    let i = 1;  // starting point (currentNode)
    while (i < rangeNextFigRefs) {
        let nodeId = Object.keys(paragraphMap)[currentNodePosition + i];
        let paragraph = paragraphMap[nodeId];
        if (paragraph && paragraph.figRefs.length) {
            let figRef;
            // check figRefs of each paragraph
            for (let i = 0; i < paragraph.figRefs.length; ++i) {
                figRef = paragraph.figRefs[i];
                // collect each figRef in nextFigRefs:
                if (!figureMap[figRef]["inserted"] &&  // if figure not already inserted
                !nextFigRefs.includes(figRef)) {       // and not already included in array
                    nextFigRefs.push(figRef);
                }
            }
        }
        // if node is first of content section:
        if(paragraph && !paragraphMap[nodeId]["isFirstOfSection"]) {
            ++i; // proceed (next paragraph)
        }
        // if rangeOverSection is true (allowed):  
        else if(rangeOverSection) {
            ++i; // proceed (next paragraph)
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
 * push figure reference to next paragraph, used to skip typsetting figure, 
 * which not fits in current node contexts
 * @param {string, number} currentNodeId id of sourceNode to be rendered
 * @param {string} figureId, figure reference as element-id of figure
 * @returns {void} changes are saved in localStorage
 * 
 */
function pushFigRefToNextParagraph(currentNodeId, figureId) {

    if(currentNodeId !== undefined && figureId !== undefined) {
        let paragraphMap = JSON.parse(localStorage.getItem("paragraph-map"));
        let nextParagraph = getNextParagraphInParagraphMap(paragraphMap, currentNodeId);

        // push figRef to nextParagraph
        if (nextParagraph && nextParagraph["figRefs"]) {
            if(!nextParagraph["figRefs"].includes(figureId)) {
                nextParagraph["figRefs"].push(figureId);
            }
        }
        // save updated figure map:
        localStorage.setItem("paragraph-map", JSON.stringify(paragraphMap));
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
function defineRenderNodeParameter(sourceNode, renderNode, parsedContent) {

    // define distribution ratio of section (relation between figures to text-content):
    let distributionRatio = defineDistributionRatioOfSection(sourceNode);

    // define page contexts of source node:
    let contexts = definePageContextsOfSourceNode(sourceNode, renderNode);

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
 * define page contexts of sourceNode
 * @param {node} sourceNode original node from parsedContent currently rendered
 * @param {node} renderNode cloned node that is added to the DOM; if pagedJs splits
 * the sourceNode, renderNode is rendered on the next page
 * @returns {JSON} pageContexts: parameter collection (e.g. pageId, distances to top,
 * remaining space on page, elements set before node); certain parameters will be added
 * to element as data-after-attribute (to display parameter in pagedJs preview)
 * 
 */
function definePageContextsOfSourceNode(sourceNode, renderNode) {

    // get pageContent, pageElement and pageId of sourceNode:
    let pageContent = sourceNode.closest(".pagedjs_page_content");
    let pageElement = pageContent.closest(".pagedjs_page");
    let pageId = (pageElement !== null) ? pageElement.id : false;

    // get elements set before on page:
    let elementsOfPage = pageContent.querySelectorAll("p.content-paragraph,.title,table,ul,figure,.page-title");
    let elementSetBefore = (elementsOfPage.length >= 2) ? elementsOfPage[elementsOfPage.length - 2] : false;
    let elementSetBeforeTagName = (elementSetBefore) ? elementSetBefore.tagName : "FALSE";

    // get bounding client rectangles of pageContent:
    let pageContentTop = pageContent.getBoundingClientRect().top;
    let pageContentHeight = pageContent.offsetHeight;
    let pageContentWidth = pageContent.offsetWidth;

    // get height of footnoteArea:
    let footnoteArea = pageElement.querySelector(".pagedjs_footnote_area");
    let footnoteAreaHeight = footnoteArea.getBoundingClientRect().height;

    // get bounding client rectangle of nodes:
    let nodeTop = sourceNode.getBoundingClientRect().top;
    let nodeBottom = sourceNode.getBoundingClientRect().bottom;
    let nodeMarginTop = parseInt(getComputedStyle(sourceNode).marginTop);
    let paddingTop = parseInt(getComputedStyle(sourceNode).paddingTop);

    // pre-calculate distances of node on page:
    let distanceToTopFromNodeTop = Math.round(nodeTop - nodeMarginTop - paddingTop - pageContentTop);
    let distanceToTopFromNodeBottom = Math.round(nodeBottom - pageContentTop);

    // detecting node splits and pages with figures:
    let nodeSplit = (distanceToTopFromNodeBottom >= pageContentHeight) ? true : false;
    let pageHasFigures = (pageContent.querySelectorAll("FIGURE").length > 0) ? true : false;

    // calculate final distances integrating figure inserts and split-nodes:
    let nodeHeight; 
    let remainingSpace;

    // adjust parameter of nodes split and partly render on next page:
    if(nodeSplit) {
        distanceToTopFromNodeBottom = calculateDistanceFromBottomOfNodeSplit(sourceNode, elementSetBefore, pageContent);
    }
    // add stats of elementsBefore to currentNode if page has figure
    if(pageHasFigures && elementSetBefore) {
        fromNodeBottomBefore = parseFloat(elementSetBefore.getAttribute("fromNodeBottom"));
        let currentNodeHeight = distanceToTopFromNodeBottom - distanceToTopFromNodeTop; 
        let newDistanceToTopFromNodeTop = fromNodeBottomBefore  + 20;
        
        // calculate new distances (fromNodeTop and fromNodeBottom)
        if(newDistanceToTopFromNodeTop + currentNodeHeight < pageContentHeight) {
            distanceToTopFromNodeTop = newDistanceToTopFromNodeTop
            distanceToTopFromNodeBottom = newDistanceToTopFromNodeTop + currentNodeHeight;
        }
        // ignore split nodes from adding stats of elementBefore
        else {
            distanceToTopFromNodeTop = 0;
            distanceToTopFromNodeBottom = calculateDistanceFromBottomOfNodeSplit(sourceNode, elementSetBefore, pageContent)
        }
    }
    // adjust distances of figure nodes:
    if(/FIGURE/.test(sourceNode.tagName)) {
        let figure = pageContent.querySelector("#" + sourceNode.id);
        let clientSizes = calculateClientSizeOfFigure(figure, pageContentWidth);
        let figureHeight = Math.round(clientSizes["clientHeightCalculated"]);
        distanceToTopFromNodeBottom = distanceToTopFromNodeTop + figureHeight;
    }

    // calculate nodeHeight and remaining space:
    nodeHeight = distanceToTopFromNodeBottom - distanceToTopFromNodeTop; 
    remainingSpace = pageContentHeight - distanceToTopFromNodeBottom;

    // collect values in pageContexts object:
    let pageContexts = {
        "pageId": pageId,
        "pageContentHeight": pageContentHeight,
        "pageContentWidth": pageContentWidth,
        "footnoteAreaHeight": footnoteAreaHeight,
        "elementSetBefore": elementSetBefore,
        "elementSetBeforeTagName": elementSetBeforeTagName,
        "distanceToTopFromNodeBottom": distanceToTopFromNodeBottom,
        "distanceToTopFromNodeTop": distanceToTopFromNodeTop,
        "nodeHeight": nodeHeight,
        "remainingSpace": remainingSpace,
        "nodeSplit": nodeSplit
    };

    // save pageContexts-stats as element attribute:
    setPageContextsAsElementAttribute(pageContexts, sourceNode, renderNode);
    return (pageContexts);
}

// re-calculate distanceToTopFromNodeBottom of sourceNode split [data-split-to]: 
function calculateDistanceFromBottomOfNodeSplit(sourceNode, elementSetBefore, pageContent) {

    let pageContentWidth = pageContent.offsetWidth;
    let pageContentHeight = pageContent.offsetHeight;
    let distanceToTopFromNodeBottom = 0;    
    let remainingSpaceElementBefore;

    // get remainingSpace of elementSetBefore
    if(elementSetBefore && elementSetBefore !== undefined) {
        remainingSpaceElementBefore = parseFloat(elementSetBefore.getAttribute("remainingSpace"));
        if(remainingSpaceElementBefore !== 0 && remainingSpaceElementBefore !== undefined) {
            // calculate text-width of sourceNode text:   
            let textStyles = getComputedStylesOfTextElements(); 
            let font = textStyles["paraFontSizeDeclared"] + " " + textStyles["paraFont"]; // "e.g. 9.3pt Noto Serif"
            let textWidth = getTextWidth(sourceNode.innerText, font);
            let linesComplete = Math.ceil(textWidth / pageContentWidth); 
            let heightParagraphLinePx = textStyles["heightParagraphLinePx"];

            // calculate text-height by lineHeight:
            let textHeight = linesComplete * Math.ceil(heightParagraphLinePx); 
            if(textHeight > pageContentHeight) {
                distanceToTopFromNodeBottom = textHeight - pageContentHeight - remainingSpaceElementBefore;
            }
            else if(textHeight > remainingSpaceElementBefore) {
                distanceToTopFromNodeBottom = textHeight - remainingSpaceElementBefore;
            }
            else {
                distanceToTopFromNodeBottom = remainingSpaceElementBefore - textHeight;
            } 
        }
    }
    return(distanceToTopFromNodeBottom);
}

function setPageContextsAsElementAttribute(contexts, sourceNode, renderNode) {

    // set attributes for key-contexts values:
    sourceNode.setAttribute('fromNodeTop', contexts["distanceToTopFromNodeTop"]);
    renderNode.setAttribute('fromNodeTop', contexts["distanceToTopFromNodeTop"]);
    sourceNode.setAttribute('fromNodeBottom', contexts["distanceToTopFromNodeBottom"]);
    renderNode.setAttribute('fromNodeBottom', contexts["distanceToTopFromNodeBottom"]);
    renderNode.setAttribute('nodeHeight', contexts["nodeHeight"]);
    sourceNode.setAttribute('nodeHeight', contexts["nodeHeight"]);
    sourceNode.setAttribute('remainingSpace', contexts["remainingSpace"]);
    renderNode.setAttribute('remainingSpace', contexts["remainingSpace"]);

    // concat all attributes values together:
    let allAttributeValues = "" +
    "fromNodeTop: " + contexts["distanceToTopFromNodeTop"] + "px | " +
    "fromNodeBottom: " + contexts["distanceToTopFromNodeBottom"] + "px | " +
    "nodeHeight: " + contexts["nodeHeight"] + "px | " +
    "remainingSpace: " + contexts["remainingSpace"] + "px | " +
    "elementBefore: " + contexts["elementSetBeforeTagName"];

    // add all attributes as data-after-attribute:
    sourceNode.setAttribute('data-after', allAttributeValues);
    renderNode.setAttribute('data-after', allAttributeValues);
}

function defineDistributionRatioOfSection(sourceNode) {

    let distributionRatio;
    let paragraphMap = JSON.parse(localStorage.getItem("paragraph-map"));

    if(paragraphMap[sourceNode.id]) {
        let paragraph = paragraphMap[sourceNode.id];
        let numParagraphs = paragraph["numParagraphsSection"];
        let numFigRefs = paragraph["numFigRefsSection"];
        distributionRatio = (numFigRefs !== 0) ? numParagraphs / numFigRefs : 2;
    }
    return(distributionRatio);
}

/* ----------------------------------------
Handle typesetting of figure elements:
-----------------------------------------*/
function processFigureEnhancing(nodeParams) {

    // shorten nodeParams and contextsParams:
    let sourceNode = nodeParams["sourceNode"];
    let renderNode = nodeParams["renderNode"];
    let contexts = nodeParams["contexts"];
    let currentFigure = nodeParams["currentFigure"];
    let nextFigure = nodeParams["nextFigure"];

    // (pre)set layout specs of figures:
    setLayoutSpecsOfFigure(currentFigure);
    setLayoutSpecsOfFigure(nextFigure);

    // get typesetting instructions by figConstellationKeys:
    let classes = getTypesettingClassesOfConstellations(contexts, nodeParams);
    let keys = classes["beforeCurrent"] + "#" + classes["current"]  + "#" + classes["next"];
    let figConstellations = JSON.parse(localStorage.getItem("fig-constellations"))[0];
    let set = figConstellations[keys];

    // check if figures fit in current page frame (remaining space)
    let fits = figuresFitInCurrentPageFrame(set, nodeParams);

    /* DEV OUTPUT:
    // console.log("FIG-REFS", nodeParams["figRefs"]);
    if(currentFigure) {
        console.log("currentFigure ->", currentFigure.id);
        console.log("fitsCurrentFigure:",  fits["currentFigure"]);
    }
    if(nextFigure) {
        console.log("nextFigure ->", nextFigure.id);
        console.log("fitsNextFigure:",  fits["nextFigure"]);
    } 
    if(currentFigure || nextFigure) console.log(set);

    /* TEST fits all:
    if(currentFigure) fits["currentFigure"] = true;
    if(nextFigure) fits["nextFigure"] = true; 
    */

    // execute instructions:
    if(fits["currentFigure"] && fits["nextFigure"]) {

        setLayoutSpecsOfFigure(currentFigure, set["currentFigure"][1]);
        setLayoutSpecsOfFigure(nextFigure, set["nextFigure"][1]);

        addVirtualMarginToFloatingFigure(nextFigure, contexts);
        addVirtualMarginToFloatingFigure(currentFigure, contexts);
        
        renderNode.insertAdjacentElement("afterend", nextFigure);
        renderNode.insertAdjacentElement("afterend", currentFigure);

        updateFigureMap(nextFigure.id);
        updateFigureMap(currentFigure.id);
    }
    else if(fits["currentFigure"]) {

        setLayoutSpecsOfFigure(currentFigure, set["currentFigure"][1]);
        addVirtualMarginToFloatingFigure(currentFigure, contexts);

        renderNode.insertAdjacentElement("afterend", currentFigure);
        
        updateFigureMap(currentFigure.id);
        pushFigRefToNextParagraph(sourceNode.id, nextFigure.id);
    } 
    else {
        // push current and nextFigureId to next paragraph:
        pushFigRefToNextParagraph(sourceNode.id, currentFigure.id);
        pushFigRefToNextParagraph(sourceNode.id, nextFigure.id);
    }
}

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

// set typesetting class of figure:
function setFigureTypesettingClass(figure, addClass = false, toggle = false) {

    let figureMap = JSON.parse(localStorage.getItem("figure-map"));
    let typesettingClass;

    // define typesetting class:
    if(figure) {
        // set typesettingClass saved in figureMap:
        if(figureMap[figure.id]["typesettingClass"]) {
            typesettingClass = figureMap[figure.id]["typesettingClass"];
        }
        // set typesettingClass given by user:
        else if(addClass && toggle) {
            let removeClass = figure.classList[typesettingClassListKey];
            figure.classList.remove(removeClass);
            typesettingClass = addClass;
        }
         // (re)set typesettingClass defined by figure constellations:
        else if(addClass) {
            let removeClass = figure.classList[typesettingClassListKey];
            figure.classList.remove(removeClass);
            typesettingClass = addClass;
            typesettingClass = addClass;
        }
        // set default typesettingClass
        else {
            typesettingClass = getDefaultFigureTypesettingClass(figure);
        }
        // add typesetting class to figure element:
        figure.classList.add(typesettingClass);
    }
    return(typesettingClass);
}

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

// get typesetting classes of each figure in current figure constellation:
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

// check if figures fit in currentPageFrame (remaining space):
function figuresFitInCurrentPageFrame(set, nodeParams) {

    let contexts = nodeParams["contexts"];
    let currentFigure = nodeParams["currentFigure"];
    let nextFigure = nodeParams["nextFigure"];
   
    // calculate clientSize of figure (includes figCaption and marginBottom)
    let pageContentWidth = contexts["pageContentWidth"];
    let clientSizeCurrentFigure = calculateClientSizeOfFigure(currentFigure, pageContentWidth);
    let clientSizeNextFigure = calculateClientSizeOfFigure(nextFigure, pageContentWidth);
    let clientHeightCurrentFigure = clientSizeCurrentFigure["clientHeightCalculated"];
    let clientHeightNextFigure = clientSizeNextFigure["clientHeightCalculated"];

    // substract height of footnoteArea from pageContentHeight:
    let remainingSpace = contexts["remainingSpace"] - contexts["footnoteAreaHeight"];
    remainingSpace = remainingSpace * pageSpaceBuffer; // add a slight pageSpaceBuffer:
    
    // set pageContentHeight if remainingSpace has negative value (= leads to pageBreak):
    remainingSpace = (remainingSpace < 0) ? contexts["pageContentHeight"] : remainingSpace;

    // check setting of current and next figure together:
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
    if(set["currentFigure"][0] && !set["nextFigure"][0]) {
        if((remainingSpace > clientHeightCurrentFigure)) {
            fitsCurrentFigure = true;
            fitsNextFigure = false;
        }
        else {
            fitsCurrentFigure = false;
            fitsNextFigure = false;
        }
    }
    // collect result in object
    let fits = {
        "currentFigure": fitsCurrentFigure,
        "nextFigure": fitsNextFigure
    }
    return(fits);
}

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

        // calculate by pixel values (set by interactJs/resize):
        if(/px/.test(figure.style.width)) {
            clientWidthCalculated = figure.style.width.slice(0, -2); // e.g. 325
            clientHeightCalculated = figure.style.height.slice(0, -2); // e.g. 245
        }
        // calculate by width (css-)percentage values:
        else {
            let widthPercentage = figure.style.width.slice(0, -1); // e.g. 50
            clientWidthCalculated = pageContentWidth * widthPercentage / 100;
            clientHeightCalculated = clientWidthCalculated / ratio;        
        }
        // calculate img and figure margins:
        let documentRoot = document.querySelector(':root');
        let imgMarginBottomDeclared = getComputedStyle(documentRoot).getPropertyValue("--imgMarginBottom");
        let imgMarginBottom = (imgMarginBottomDeclared) ? imgMarginBottomDeclared.slice(0, -2) * 3.78 : 10;
        let marginBottomDeclared = getComputedStyle(documentRoot).getPropertyValue("--floatFigureMarginBottom");
        let marginBottom = (marginBottomDeclared) ? marginBottomDeclared.slice(0, -2) * 3.78 : 28;
     
        // calculate clientHeight of figCaption
        clientHeightFigCaption = calculateClientSizeOfFigCaption(figure, clientWidthCalculated);
 
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
            "marginBottom": marginBottom
        }
    }
    return(clientSizes);
}

function calculateClientSizeOfFigCaption(figure, clientWidthCalculated) {

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
  
function addVirtualMarginToFloatingFigure(figure, contexts) {

    if(/float/.test(figure.className)) {

        // get paragraph style properties:
        let textStyles = getComputedStylesOfTextElements();
        
        // get margin properties:
        let documentRoot = document.querySelector(':root');
        let offsetToMarginAreaDeclared = getComputedStyle(documentRoot).getPropertyValue("--floatFigureOffsetToMarginArea");
        // parse all properties to int ((1mm = 3.7795 px or default margin):
        let offsetToMarginArea = (offsetToMarginAreaDeclared) ? offsetToMarginAreaDeclared.slice(0, -2) * 3.78 : 150;
        offsetToMarginArea = Math.abs(offsetToMarginArea); // turn negative value to positive
      
        // calculate client sizes of figure:
        let pageContentWidth = contexts["pageContentWidth"];
        let clientSizes = calculateClientSizeOfFigure(figure, pageContentWidth);
        let figureWidth = clientSizes["clientWidthCalculated"];
        let figureHeight = clientSizes["clientHeightCalculated"];
        let marginBottom = clientSizes["marginBottom"];
    
        // calculate floating text lines space:
        let lines = figureHeight /  textStyles["heightParagraphLinePx"];
        let lineWidth = figureWidth - offsetToMarginArea;
        let textFloatWidth = pageContentWidth - lineWidth;
        let textFloatPercent = textFloatWidth / pageContentWidth;

        // calculate virtualMargin (- subtract regular marginBottom):
        let virtualMargin = (lines * textStyles["heightParagraphLinePx"]) * textFloatPercent - marginBottom; 

        // set calculated margin as inline-style: 
        figure.style.marginBottom = "-" + virtualMargin + "px";
    }
    else {
        figure.style.marginBottom = "7.5mm";
    }
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

/*---TEST ---*/
function insertPseudoNodeAtEndOfSections(nodeParams, parsedContent) {
                        
    let pseudoNode = document.createElement("p");
    pseudoNode.id = "pseudo-" + nodeParams["sourceNode"].id;
    pseudoNode.style.borderTop = "1px solid lightgreen";
    nodeParams["renderNode"].insertAdjacentElement("afterend", pseudoNode);

    let figureMap = JSON.parse(localStorage.getItem("figure-map"));
    let figRefs = nodeParams["figRefs"].reverse();
    for (let i = 0; i < figRefs.length; i++) {
        let figRef = figRefs[i];
        if(!figureMap[figRef]["inserted"]) {
            let figure = getNextFigureElement(figRef, parsedContent);
            if(figure) {
                setLayoutSpecsOfFigure(figure);
                pseudoNode.insertAdjacentElement("afterend", figure);
            }
        }
    }
}

/* --------------------------------------------------------
classify and adjust elements after node is rendered on page
------------------------------------------------------------*/
function classifyPageOfElement(pageElement, page) {

    let pageContent = pageElement.querySelector(".pagedjs_page_content");
    let elementsOfPage = pageContent.querySelectorAll("figure,.fig-number,.meta-section");

    for (let i = 0; i < elementsOfPage.length; i++) {
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

function classifyElementPositionOnPage(pageElement) {

    let pageContent = pageElement.querySelector(".pagedjs_page_content");
    let elementsOfPage = pageContent.querySelectorAll("p.content-paragraph,.title,table,ul,figure");
    let lastIndex = elementsOfPage.length - 1;

    for (let i = 0; i < elementsOfPage.length; i++) {
        let element = elementsOfPage[i];      
        // still necessary? : if (element.matches("figure") || /title/.test(element.className)) {
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

function adjustLayoutOfTextElements(sourceNode, renderNode) {

    // get pageContext of elements:
    let contexts = definePageContextsOfSourceNode(sourceNode, renderNode);

    // define threshold values:
    let bottomAreaNoHeadlinePx = contexts["pageContentHeight"] / 9;
    let bottomAreaNoTitleAppendixPx = contexts["pageContentHeight"]-100;
    let bottomAreaNoTablePx = contexts["pageContentHeight"] / 7;
  
    // handle layout of regular headlines:
    if(/title/.test(sourceNode.className)) {
        // exclude titles on cover-page:
        let parentElementClass = sourceNode.parentElement.className;
        if(parentElementClass !== "abstract" && parentElementClass !== "kwd-group") {
            // add top-margins to headlines and push them to next page:
            if(contexts["remainingSpace"] < bottomAreaNoHeadlinePx &&
            contexts["remainingSpace"] > 20) {
                sourceNode.style.marginTop = contexts["remainingSpace"] + 50 + "px";
            }
            // remove top-padding from headlines set after figure element:
            if(contexts["elementSetBefore"].tagName === "FIGURE") {
                sourceNode.style.paddingTop = 0;
            }
        }
    }
    // add top-margins to title-appendixes and push them to next column
    if(/title-appendix/.test(sourceNode.className)
    && contexts["remainingSpace"] < bottomAreaNoTitleAppendixPx) {
        sourceNode.style.marginTop = contexts["remainingSpace"] + 40 + "px";
    }
    // avoid table blocks starting at bottom of page
    if(/table-wrap/.test(sourceNode.className)) {
        // add top-margins to headlines and push them to next page:
        if(contexts["remainingSpace"] < bottomAreaNoTablePx) {
            sourceNode.style.marginTop = contexts["remainingSpace"] + 50 + "mm";
        }
    }
    // handle layout of catalogs:
    if (/catalog-number/.test(sourceNode.className)) {
        // add top-margins to catalog number and push them to next page:
        if(contexts["remainingSpace"] < bottomAreaNoTablePx) {
            sourceNode.style.marginTop = contexts["remainingSpace"] + 50 + "mm";
        }
    }
}

function adjustElementPositionOnPage(pageElement) {

    let pageContent = pageElement.querySelector(".pagedjs_page_content");
    let elementsOfPage = pageContent.querySelectorAll("p,.title,table,ul,figure,figCaption, pre");

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
            if (onTopOfPage.some(className => element.classList.contains(className))
                || /onTopOfPage/.test(element.className)) {

                // if first element is figure push element after this figure:
                if(firstElement.matches("figure")) {
                    firstElement.insertAdjacentElement("afterend", element);
                }
                // push element before first element and reassign position class:
                else {
                    firstElement.insertAdjacentElement("beforebegin", element);
                    element.classList.remove(element.classList.item(6));
                    element.classList.add("first-element");
                }
            }
        }
        // set figcaptions to block after page rendering:
        if (element.matches("figcaption")) {
            element.style.display = "block";
        }
    }
}

function recreateAnchorsInFootnoteSpans(pageElement, page) {

    let elements = pageElement.querySelectorAll(".footnote");
    for (let i = 0; i < elements.length; i++) {
        elements[i].innerHTML = URLifyString(elements[i].innerText);
    }
}

function renderFigCaptionsAtpageBottomArea(pageElement) {

    let pageContent = pageElement.querySelector(".pagedjs_page_content");
    let figures = pageContent.querySelectorAll("figure");
    let lastIndex = figures.length - 1;

    if(figures) {
        let figCaptionArea = document.createElement("div");
        figCaptionArea.classList.add("figCaption-area");

        for (let i = 0; i < figures.length; i++) {

            // all figures on top of page:
            figures[i].classList.toggle("onTopOfPage");

            let figNumber = figures[i].querySelector(".fig-number")
                .cloneNode(true);
            figNumber.classList.add("fig-number-bottomArea");
            let figCaption = figures[i].querySelector("figCaption");
            figCaption.querySelector(".img-label").remove();
            let captionText = figCaption.querySelector(".caption-text");

            let footnoteCaption = document.createElement("p");
            footnoteCaption.classList.add("footnote-caption");
            captionText.prepend(figNumber);
            footnoteCaption.append(captionText);

            figCaptionArea.appendChild(footnoteCaption);
            let lastFigCaption = figures[lastIndex].querySelector("figCaption");
            lastFigCaption.parentElement.appendChild(figCaptionArea);
        }
    }
}

function checkQualityOfUrls() {

    if(checkUrlPersistence) {
        // get all anchors with external reference
        let anchors = document.querySelectorAll(
            "a:not(.fig-ref,.fn-ref,.bib-ref,.footnote)");
        anchors.forEach(function (anchor) {
            console.log(anchor);
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

/*--TEST--*/
function ignoreHyphenationByPagedJs(ignore, pageElement, page, breakToken) {

    if (ignore && pageElement.querySelector('.pagedjs_hyphen')) {

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

/* --------------------------------------
Application or library related functions:
-----------------------------------------*/

function getDocumentStateProperty(propertyKey) {

    let property;
    let documentState;
    let documentStateJSON = localStorage.getItem("documentState");
    if(documentStateJSON) {
        documentState = JSON.parse(documentStateJSON);
        property = documentState[propertyKey];
    } else {
        property = false
    }
    return(property);
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

    // get and parse declared style properties of content-paragraphs:
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

function makeElementsInteractive(pageElement) {

    const interactElements = "figure,p.content-paragraph";
    let pageContent = pageElement.querySelector(".pagedjs_page_content");
    let elementsOfPage = pageContent.querySelectorAll(interactElements);

    for (let i = 0; i < elementsOfPage.length; i++) {
        let element = elementsOfPage[i];
        if (element.matches("figure")) {
            element.classList.add("resizable");
            element.classList.add("tap-target");
        }
        if (/content-paragraph/.test(element.className)) {
            element.classList.add("tap-target");
            // element.classList.add("resizable-paragraph");
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
                        height: `${event.rect.height}px`,
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
                if(/content-paragraph/.test(event.currentTarget.className)) {

                    // clear:both;margin-bottom:5mm
                    event.currentTarget.style.marginTop = "5mm";
                    event.currentTarget.style.letterSpacing = "0.2px";

                    event.currentTarget.classList.add("styled-flag");
                    updateParagraphMap(event.currentTarget.id, "style", "margin-top:5mm;letter-spacing:0.2px;");
    
                    /* reload document after changes:
                    setTimeout(function(){
                        window.location.reload();
                    }, 2000);
                    */
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
    let documentId = getDocumentStateProperty("documentId");
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
