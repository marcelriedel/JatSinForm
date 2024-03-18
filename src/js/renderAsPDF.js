/** ----------------------
* classList keys of figure
--------------------------*/
const resTypeClassListKey = 0;
const ratioClassListKey = 1;
const typesettingClassListKey = 2;
const imageClassThresholdDefault = 5;

/** ------------------------------
 * control pagedJs-Handler (Hook)
 * documentation: https://pagedjs.org/documentation/10-handlers-hooks-and-custom-javascript/
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
            createPararaphMap(parsed);

            let previousMap = JSON.parse(localStorage.getItem("figure-map"));
            let documentId = getDocumentStateProperty("documentId");

            if (previousMap && previousMap["documentId"] === documentId) {
                createFigureMap(parsed, previousMap);
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
                // define page contexts of source node:
                let parsedContent = Layout.hooks.afterParsed.context.source.firstChild;
                let paragraphMap = JSON.parse(localStorage.getItem("paragraph-map"));
                let pageContent = sourceNode.closest(".pagedjs_page_content");
                let contexts = definePageContextsOfSourceNode(sourceNode, pageContent);

                // handle layout of content paragraphs:
                if (paragraphMap[sourceNode.id] && !paragraphMap[sourceNode.id]["isSet"]) {
                    let nodeParams = defineRenderNodeParameter(sourceNode, renderNode, parsedContent);

                    // exlude figures for defined paragraphs (first text page)
                    if(nodeParams["currentFigure"] && noFigureBefore.includes(sourceNode.id)) {
                        addFigIdToNextParagraph(sourceNode.id, nodeParams["currentFigure"].id);
                    } else {
                        // process figure enhancing:
                        processFigureEnhancing(nodeParams);
                    }
                    updateParagraphMap(sourceNode.id);
                }
                // handle layout of headlines:
                if (/title/.test(sourceNode.className) || /title-appendix/.test(sourceNode.className)) {
                    setPageContextsAsElementAttribute(contexts, sourceNode, renderNode);
                    adjustLayoutOfElements(sourceNode, contexts);
                }

                // handle layout of table blocks:
                if (/table-wrap/.test(sourceNode.className)) {
                    setPageContextsAsElementAttribute(contexts, sourceNode, renderNode);
                    adjustLayoutOfElements(sourceNode, contexts);
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

            // !!!TEST HYPHEN CORRECTION !!!!
            if (pageElement.querySelector('.pagedjs_hyphen')) {

                function getFinalWord(words) {
                    var n = words.split(" ");
                    return n[n.length - 1];
                }

                // find the hyphenated word
                let block = pageElement.querySelector('.pagedjs_hyphen');

                // i dont know what that line was for :thinking: i removed it
                // block.dataset.ref = this.prevHyphen;

                // move the breakToken
                let offsetMove = getFinalWord(block.innerHTML).length;

                // move the token accordingly
                page.breakToken = page.endToken.offset - offsetMove;

                // remove the last word
                block.innerHTML = block.innerHTML.replace(getFinalWord(block.innerHTML), "");

                breakToken.offset = page.endToken.offset - offsetMove;
            }

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
        }
    }
    Paged.registerHandlers(pagedJsHandler);
}
/* -----------------------------
Prepare elements of PDF article
--------------------------------*/
/**
 * create article-html for pdf rendering
 * @param content: document-fragment made from the original DOM
 * @returns article element
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
    if(figureSection.querySelector("#poster-image") !== null) {
        figureSection.querySelector("#poster-image").remove();
    }

    // format notes as foot- or endnotes:
    let noteSection = document.createElement("div");
    if(content.querySelector(".footnotes-section") !== null) {
        if (journalId === "e-DAI-F") {
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

    // append all sections:
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
 * create cover-page as div-element
 * @param content: document-fragment made from original DOM
 * @returns coverPage with abstractSection
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
 * create abstractSection
 * @param content: document-fragment made from original DOM
 * @param selector: class-selector of abstractType, e.g.
 * .abstract, .trans-abstract
 * @returns abstract with abstract information and keywords.
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
        let keywordsSection;
        let keywords = content.querySelectorAll(".kwd-group");
        if(keywords.length) {
            for (let i = 0; i < keywords.length; i++) {
                let keywordsLang = keywords[i].getAttribute("xml:lang");
                let abstractLang = abstract.getAttribute("xml:lang");
                // if keywords correspond to abstractLang
                if(keywordsLang === abstractLang) {
                    kwHeadline = keywords[i].querySelector(".title");
                    kwHeadline.classList.add("keywords-headline");
                    keywordsSection = keywords[i];
                }
            }
        }
        else {
            keywordsSection = document.createElement("div");
            keywordsSection .classList.add("kwd-group");
            keywordsSection .innerHTML = "[KEYWORDS MISSING]";
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
 * check maximum length of abstract text
 * @param abstractText given abstract text
 * @returns checked abstractText, eventually
 * enriched with warning class and notice
 */
function checkMaxLengthOfAbstractText(abstractText) {

    // character lengths defined as const
    let maxChars = maxAbstractLength;
    if(abstractText.innerText.length > maxChars) {
        abstractText.classList.add("warning");
        abstractText.classList.add("display-data-attributes");
        abstractText.setAttribute('data-before', "!Max-Length:" + maxChars + " characters!");
        abstractText.innerHTML = abstractText.innerText.substring(0, maxChars);
    }
    return(abstractText);
}

/**
 * create titlePage: upper part of first page with text
 * @param content document-fragment made from original DOM
 * @returns titlePage as div-container with title and contributors
 */
function createTitlePage(content) {

    // get title page information:
    let title = content.querySelector(".article-title");
    let subtitle = content.querySelector(".subtitle");
    let authors = content.querySelectorAll(".contrib[contrib-type='author']");
    let contributors = content.querySelectorAll(".contrib[contrib-type='co-author']");

    // transform author information to string:
    let authorsCollection = [];
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

    // transform contributors information to string:
    let contributorsCollection = [];
    for (let i = 0; i < contributors.length; i++) {
        let givenName = contributors[i].querySelector(".given-names").textContent;
        let surName = contributors[i].querySelector(".surname").textContent;
        contributorsCollection.push(givenName + " " + surName);
    }

    // create title page elements and fill with content
    let titlePage = document.createElement("div");
    titlePage.className = "page-header";

    let titleElement = document.createElement("h1");
    titleElement.className = "page-title";
    titleElement.innerHTML = (title) ? title.textContent : "[Kein Titel]";

    let subtitleElement = document.createElement("h1");
    subtitleElement.className = "page-subtitle";
    subtitleElement.innerHTML = (subtitle) ? subtitle.textContent : "";

    let authorsElement = document.createElement("h1");
    authorsElement.className = "page-authors";
    authorsElement.innerHTML = (authorsCollection.length) ? authorsCollection.join(", ") : "[Keine Autoren]";

    let contributorsElement = document.createElement("p");
    contributorsElement.className = "page-contributors";
    let lang = document.documentElement.lang;
    if(contributorsCollection.length) {
        contributorsElement.innerHTML = contributorsPrepositions[lang] + " " + contributorsCollection.join(", ");
    }

    // append elements to titlePage:
    titlePage.append(authorsElement);
    titlePage.append(titleElement);
    titlePage.append(subtitleElement);
    titlePage.append(contributorsElement);

    return (titlePage);
}

/**
 * create ToC: table of contents by headlines
 * @param content document-fragment made from original DOM
 * @returns contents: tocList; currently not used for dai-journals
 */
function createToCFromHeadings(content) {

    let contents = document.createElement("div");

    if (createToC) {
        let tocListTitle = document.createElement("h3");
        tocListTitle.id = "contents";
        tocListTitle.classList.add("title-appendix");
        let lang = document.documentElement.lang;
        tocListTitle.innerHTML = titlesOfAppendices["contents"][lang];
        contents.append(tocListTitle);

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
            contents.appendChild(tocList);
        }
    }
    return(contents);
}

/**
 * reformat footnotes for displaying them at bottom of page,
 * based on https://pagedjs.org/posts/2021-06-newRelease/
 * @param content document-fragment made from original DOM
 * @returns 
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
                footnote.classList.add("warning");
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
 * create referenceList or rather bibliography
 * @param content document-fragment made from original DOM
 * @returns referenceList as meta-section with author-year-label,
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
            if(references[i].querySelector(".ext-ref") !== null) {
                let extRefLink = document.createElement("a");
                extRefLink.classList.add("ext-ref-link");
                extRefLink.target = "_blank";
                extRefLink.href = references[i].querySelector(".ext-ref").href;
                extRefLink.innerHTML = "[Zenon &#9741]";

                let citation = references[i].querySelector(".ext-ref").textContent;
                mixedCitation.innerHTML = URLifyString(citation);
                mixedCitation.append(extRefLink);
            }
            else {
                if(mixedCitation !== null) {
                    mixedCitation.innerHTML = URLifyString(mixedCitation.innerText);
                }
            }

            // append reference elements:
            references[i].innerHTML = "";
            references[i].append(label);
            references[i].append(mixedCitation);
            referenceList.append(references[i]);
        }
    }
    return (referenceList);
}

function recreateFiguresSection(content) {

    let figureSection;
    if(content.querySelector(".figure-section") !== null) {
        figureSection = content.querySelector(".figure-section").cloneNode(true);
        figureSection.id = "cloned-images-container";
        figures = figureSection.querySelectorAll("figure:not(#poster-image)");
    } else {
        figureSection = document.createElement("div");
        return(figureSection);
    }

    for (let i = 0; i < figures.length; ++i) {
        // get each figure element:
        let img = figures[i].querySelector("img");
        let figCaption = figures[i].querySelector("figCaption");
        let attribution;
        if(figures[i].querySelector(".attribution") !== null) {
            attribution = figures[i].querySelector(".attribution");
        }
        else {
            attribution = document.createElement("p");
            attribution.classList.add("attribution");
            attribution.style.color = "red";
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

function createSourceOfIllustrations(figureSection) {

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

function createContributorsDetails(content, isArticle) {

    let contributorsDetails = document.createElement("div");
    contributorsDetails.id = "contributors-section";

    let authors;
    let contributors;
    let editors;
    let coEditors;
    let advisoryBoardMember;

    if(isArticle) {
        let contributorsDetailsTitle = document.createElement("h3");
        contributorsDetailsTitle.classList.add("title-appendix");
        let lang = document.documentElement.lang;
        contributorsDetailsTitle.innerHTML = titlesOfAppendices["authorDetails"][lang];
        contributorsDetails.appendChild(contributorsDetailsTitle);

        // get authors and contributors
        authors = content.querySelectorAll(".contrib[contrib-type='author']");
        contributors = content.querySelectorAll(".contrib[contrib-type='co-author']");
    }
    else {
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

function createContributorsCard(contributor) {

    let contributorsCard = document.createElement("div");
    contributorsCard.classList.add("contributors-card");

    let name = document.createElement("p");
    let institution = document.createElement("p");
    let contribIdLink = document.createElement("a");
    let institutionIdLink = document.createElement("a");
    let email = document.createElement("p");

    if(contributor.querySelector(".given-names") !== null && contributor.querySelector(".surname") !== null) {
        let givenName = contributor.querySelector(".given-names").textContent;
        let surName = contributor.querySelector(".surname").textContent;
        if(contributor.querySelector(".contrib-id") !== null) {
            contribIdLink.classList.add("contributors-link");
            contribIdLink.target = "_blank";
            contribIdLink.href = contributor.querySelector(".contrib-id").textContent;
            contribIdLink.innerHTML = givenName + " " + surName + " &#9741;"
            name.append(contribIdLink);
        } else { name.innerHTML = givenName + " " + surName;}
        contributorsCard.append(name);
    };

    if(contributor.querySelector(".institution") !== null) {;
        if(contributor.querySelector(".institution-id") !== null) {
            institutionIdLink.classList.add("contributors-link");
            institutionIdLink.target = "_blank";
            institutionIdLink.href = contributor.querySelector(".institution-id").textContent;
            institutionIdLink.innerHTML = contributor.querySelector(".institution").textContent + " &#9741;"
            institution.append(institutionIdLink);
        } else { institution.innerHTML = contributor.querySelector(".institution").textContent;}
        contributorsCard.append(institution);
    };

    if(contributor.querySelector(".email") !== null) {
        email.innerHTML = contributor.querySelector(".email").textContent;
        contributorsCard.append(email);
    }
    return(contributorsCard);
}

function createArticleMetaSection() {

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

    // journal information:
    let journalTitle;
    let publishingHistory;

    // journal title
    if(content.querySelector(".journal-title") !== null) {
        journalTitle = content.querySelector(".journal-title");

        // publishing history:
        if(content.querySelector(".publishing-history") !== null) {
            publishingHistory = content.querySelector(".publishing-history > .meta-value");
            journalTitle.innerHTML += " " + publishingHistory.innerText + ", ";
            content.querySelector(".publishing-history").remove();
            // !later!
            let journalDoi = document.createElement("a");
            journalDoi.classList.add("ext-ref-link");
            journalDoi.href = "https://publications.dainst.org/journals/FdAI";
            journalDoi.innerText = "!JOURNAL-DOI!";
            journalTitle.appendChild(journalDoi);
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

    // customMetaGroup:
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

function createPararaphMap(parsedContent) {

    let paragraphs = parsedContent.querySelectorAll("p.content-paragraph");
    let paragraphMap = {};
    let allFigRefs = [];
    let hasSectionId = [];
    let numFigRefsSection = 0;
    let numParagraphsSection = 0;
    let isFirstOfSection;

    // parse references for each paragraph:
    for (let i = 0; i < paragraphs.length; i++) {
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
                hasSectionId.push(parent.id);
                numFigRefsSection = figRefs.length;
                numParagraphsSection = 1;
            }
        }

        // assign values for each paragraph
        let values = {
            "position": i,
            "id": paragraphs[i].id,
            "figRefs": figRefs,
            "isSet": false,
            "style": false,
            "isFirstOfSection": isFirstOfSection,
            "numFigRefsSection": numFigRefsSection,
            "numParagraphsSection": numParagraphsSection
        };
        paragraphMap[paragraphs[i].id] = values;
    }

    // save entire map in local storage:
    localStorage.setItem("paragraph-map", JSON.stringify(paragraphMap));
}

function updateParagraphMap(currentNodeId) {

    // get current paragraphMap:
    let paragraphMap = JSON.parse(localStorage.getItem("paragraph-map"));
    if (paragraphMap[currentNodeId]) {
        paragraphMap[currentNodeId]["isSet"] = true;
    }

    // save updated figure map:
    localStorage.setItem("paragraph-map", JSON.stringify(paragraphMap));
}

function addFigIdToNextParagraph(currentNodeId, figureId) {

    // get current paragraphMap:
    let paragraphMap = JSON.parse(localStorage.getItem("paragraph-map"));
    let currentNodePosition = paragraphMap[currentNodeId]["position"];

    // get nextParagraph in paragraphMap:
    let nextNodeId = Object.keys(paragraphMap)[currentNodePosition + 1];
    let nextParagraph = paragraphMap[nextNodeId];

    // push figRef to nextParagraph
    if (nextParagraph && nextParagraph["figRefs"]) {
        if(!nextParagraph["figRefs"].includes((figureId))) {
            nextParagraph["figRefs"].unshift(figureId);
        }
    }
    // save updated figure map:
    localStorage.setItem("paragraph-map", JSON.stringify(paragraphMap));
}

function createFigureMap(parsedContent, previousMap) {

    // prepare figure Map:
    let figureMap = {};
    let documentId = parsedContent.querySelector("article").id;

    // set hash for current html document:
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
            "positionClass": (previousMap) ? previousMap[figure.id]["positionClass"] : false,
        };
        figureMap[figure.id] = values;
    }

    // save entire map in local storage:
    localStorage.setItem("figure-map", JSON.stringify(figureMap));
}

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

function saveInteractStylesInFigureMap(object) {

    let style = object.getAttribute('style');
    let figureId = object.id;

    // get current figureMap
    let figureMap = JSON.parse(localStorage.getItem("figure-map"));

    // update figureMap
    figureMap[figureId]["style"] = style;

    // save updated map:
    localStorage.setItem("figure-map", JSON.stringify(figureMap));
    setTimeout(function(){
        window.location.reload();
    }, 5000);
}

/* -------------------------------------
Control page layout of element nodes
----------------------------------------*/

function definePageContextsOfSourceNode(sourceNode, pageContent) {

    // get bounding rectangles of pageContent:
    let nodeBottom = sourceNode.getBoundingClientRect().bottom;
    let pageContentTop = pageContent.getBoundingClientRect().top;
    let pageContentHeight = pageContent.offsetHeight;
    let pageContentWidth = pageContent.offsetWidth;

    // calculate distances of node and page:
    let distanceToTopFromNodeBottom = Math.round(nodeBottom - pageContentTop);
    let remainingSpace = pageContentHeight - distanceToTopFromNodeBottom;

    // define where node-bottom (!) ends-up on page:
    let pageTopArea = (remainingSpace >= pageContentHeight * 0.66 || remainingSpace <= 1) ? true : false;
    let pageBottomArea = (!pageTopArea && remainingSpace <= pageContentHeight * 0.15) ? true : false;
    let pageInBetweenArea = (!pageTopArea && !pageBottomArea) ? true : false;

    // get element set before on page:
    let elementsOfPage = pageContent.querySelectorAll("p.content-paragraph,.title,table,ul,figure");
    let elementSetBefore = (elementsOfPage.length >= 2) ? elementsOfPage[elementsOfPage.length - 2] : false;

    // collect values in pageContexts object:
    let pageContexts = {
        "pageContentHeight": pageContentHeight,
        "pageContentWidth": pageContentWidth,
        "distanceToTopFromNodeBottom": distanceToTopFromNodeBottom,
        "remainingSpace": remainingSpace,
        "pageTopArea": pageTopArea,
        "pageBottomArea": pageBottomArea,
        "pageInBetweenArea": pageInBetweenArea,
        "elementSetBefore": elementSetBefore
    };
    return (pageContexts);
}

function setPageContextsAsElementAttribute(contexts, sourceNode, renderNode) {

    let attributeValue;
    let pageCursor;

    if(contexts["pageTopArea"]) {
        pageCursor = "pageTopArea";
    }
    else if (contexts["pageBottomArea"]) {
        pageCursor = "pageBottomArea";
    }
    else {
        pageCursor = "in-between";
    }

    attributeValue = "cursor: " + pageCursor + " | " +
        contexts["distanceToTopFromNodeBottom"] + "px | remains: " +
        contexts["remainingSpace"] + "px | " +
        contexts["elementSetBefore"].tagName;

    sourceNode.setAttribute('data-after', attributeValue);
    renderNode.setAttribute('data-after', attributeValue);
}

function defineRenderNodeParameter(sourceNode, renderNode, parsedContent) {
    
    // define page contexts of source node:
    let pageContent = sourceNode.closest(".pagedjs_page_content");
    let contexts = definePageContextsOfSourceNode(sourceNode, pageContent);
    setPageContextsAsElementAttribute(contexts, sourceNode, renderNode);

    // define distribution ratio of section (relation between figures to text-content):
    let distributionRatio = defineDistributionRatioOfSection(sourceNode);
 
    // get figureElements by figRefs:
    let nextFigRefs = getNextFigRefs(sourceNode.id);
    let currentFigure = getNextFigureElement(nextFigRefs[0], parsedContent);
    let nextFigure = getNextFigureElement(nextFigRefs[1], parsedContent);
    
    // collect nodeParams:
    let nodeParams = {
        "sourceNode": sourceNode,
        "renderNode": renderNode,
        "distributionRatio": distributionRatio,
        "numFigRefs": nextFigRefs.length,
        "contexts": contexts,
        "currentFigure": currentFigure,
        "nextFigure": nextFigure
    };
    return(nodeParams);
}

function processFigureEnhancing(nodeParams) {

    // shorten nodeParams and contextsParams:
    let renderNode = nodeParams["renderNode"];
    let contexts = nodeParams["contexts"];
    let distributionRatio = nodeParams["distributionRatio"];
    let numFigRefs = nodeParams["numFigRefs"];
    let elementSetBefore = contexts["elementSetBefore"]
    let currentFigure = nodeParams["currentFigure"];
    let nextFigure = nodeParams["nextFigure"];

    // get typesetting classes of each relevant figure:
    let currentFigureClass = (currentFigure) ? currentFigure.classList[typesettingClassListKey] : false;
    let nextFigureClass = (nextFigure) ? nextFigure.classList[typesettingClassListKey] : false;
    let figureBeforeCurrentClass;
    if(elementSetBefore && elementSetBefore.tagName === "FIGURE") {
        figureBeforeCurrentClass = elementSetBefore.classList[typesettingClassListKey];
    } else { figureBeforeCurrentClass = false;}

    // get typesetting instructions by figConstellationKeys:
    let keys = figureBeforeCurrentClass + "#" + currentFigureClass  + "#" + nextFigureClass;
    let figConstellations = JSON.parse(localStorage.getItem("fig-constellations"))[0];

    console.log(keys);
    let set = figConstellations[keys];

    let clientSizeCurrentFigure;
    let clientSizeNextFigure;
    let fitsCurrent = false;
    let fitsNextFigure = false;

    console.log("Figs:" , numFigRefs, "ratio: ", distributionRatio);
    console.log("-----", renderNode.id);
    console.log(set);

    // check setting of current and nextFigure:
    if(set["currentFigure"][0] && set["nextFigure"][0]) {

        // check remaining space:
        clientSizeCurrentFigure = calculateClientSizeOfFigure(currentFigure, contexts);
        clientSizeNextFigure = calculateClientSizeOfFigure(nextFigure, contexts);

        if(contexts["remainingSpace"] > clientSizeCurrentFigure["clientHeightCalculated"] * 1.25) {
            fitsCurrent = true;
        }
        if(contexts["remainingSpace"] > clientSizeCurrentFigure["clientHeightCalculated"] * 1.25 
        + clientSizeNextFigure["clientHeightCalculated"] * 1.25 ) {
            fitsNextFigure = true;
        }
        if(contexts["pageBottomArea"]) {
            fitsCurrent = true;
            fitsNextFigure = false;
        }
    }
    // check setting of current figure only:
    if(set["currentFigure"][0] && !set["nextFigure"][0]) {
        clientSizeCurrentFigure = calculateClientSizeOfFigure(currentFigure, contexts);
        if(contexts["remainingSpace"] > clientSizeCurrentFigure["clientHeightCalculated"] * 1.25) {
            fitsCurrent = true;
        }
        if(contexts["pageBottomArea"]) {
            fitsCurrent = true;
        }
    }

    // execute instructions:
    if(fitsCurrent && fitsNextFigure) {
        reassignLayoutSpecsByGivenClass(currentFigure, set["currentFigure"][1]);
        reassignLayoutSpecsByGivenClass(nextFigure, set["nextFigure"][1]);

        // insert current figure
        addVirtualMarginToFloatingFigure(nextFigure, contexts);
        renderNode.insertAdjacentElement("afterend", nextFigure);
        updateFigureMap(nextFigure.id);

        // insert next figure
        addVirtualMarginToFloatingFigure(currentFigure, contexts);
        renderNode.insertAdjacentElement("afterend", currentFigure);
        updateFigureMap(currentFigure.id);
    }
    if(fitsCurrent) {
        reassignLayoutSpecsByGivenClass(currentFigure, set["currentFigure"][1]);
        // insert current figure only
        addVirtualMarginToFloatingFigure(currentFigure, contexts);
        renderNode.insertAdjacentElement("afterend", currentFigure);
        updateFigureMap(currentFigure.id);
    }
}

// Copy:
function COPYdefineEnhancingInstructions(nodeParams) {

    // shorten nodeParams and contextsParams:
    let sourceNode = nodeParams["sourceNode"];
    let renderNode = nodeParams["renderNode"];
    let contexts = nodeParams["contexts"];
    let distributionRatio = nodeParams["distributionRatio"];
    let elementSetBefore = contexts["elementSetBefore"]
    let currentFigure = nodeParams["firstFigure"];
    let nextFigure = nodeParams["secondFigure"];

    // get default figure typesetting classes:
    let currentFigureClass = (currentFigure) ? currentFigure.classList[typesettingClassListKey] : false;
    let nextFigureClass = (nextFigure) ? nextFigure.classList[typesettingClassListKey] : false;
    let figureBeforeCurrentClass;
    if(elementSetBefore && elementSetBefore.tagName === "FIGURE") {
        figureBeforeCurrentClass = elementSetBefore.classList[typesettingClassListKey];
    } else { figureBeforeCurrentClass = false;}

    // get typesetting instructions by conFiguration keys:
    let keys = figureBeforeCurrentClass + "#" + currentFigureClass  + "#" + nextFigureClass;
    let figureConfigurationModel = JSON.parse(localStorage.getItem("conFigurations"))[0];
    let instructions = figureConfigurationModel[keys];

    // dev output
    if(currentFigure) {
        console.log(sourceNode.id, "=>", currentFigure.id);
    }
    if(nextFigure) {
        console.log(sourceNode.id, "=>", nextFigure.id);
    }

    // test rewriting instructions to integrate remainingSpace check
    if(currentFigure) {
        let clientSizeCurrent = calculateClientSizeOfFigure(currentFigure, contexts);
        addVirtualMarginToFloatingFigure(currentFigure, contexts);

        if(!contexts["pageBottomArea"]
        && contexts["remainingSpace"] < clientSizeCurrent["clientHeightCalculated"] * 1.25) {
            instructions["currentFigure"] = [false, false];

            console.log(contexts["remainingSpace"], "<", clientSizeCurrent["clientHeightCalculated"] * 1.25);
            console.log(currentFigure.id, "passt nicht");
        }
    }
    
    /* OPEN ISSUES:
    FdAI_Ritter -> viele Bilder nicht gesetzt
    */

    console.log(instructions);

    switch (true) {
        case (contexts["pageBottomArea"] && distributionRatio <= 2):
            if(instructions["currentFigure"][0] && instructions["nextFigure"][0]) {

                // test transforming
                if(instructions["currentFigure"][1]) {
                    reassignLayoutSpecsByGivenClass(currentFigure, instructions["currentFigure"][1]);
                }
                // test transforming
                if(instructions["nextFigure"][1]) {
                    reassignLayoutSpecsByGivenClass(nextFigure, instructions["nextFigure"][1]);
                }

                // insert second figure
                renderNode.insertAdjacentElement("afterend", nextFigure);
                updateFigureMap(nextFigure.id);

                // insert first figure
                renderNode.insertAdjacentElement("afterend", currentFigure);
                updateFigureMap(currentFigure.id);
            }
            break;

        case (contexts["pageBottomArea"] && distributionRatio >= 2):
            if(instructions["currentFigure"][0]) {
                // test transforming
                if(instructions["currentFigure"][1]) {
                    reassignLayoutSpecsByGivenClass(currentFigure, instructions["currentFigure"][1]);
                }
                renderNode.insertAdjacentElement("afterend", currentFigure);
                updateFigureMap(currentFigure.id);
            }
            break;

        case (contexts["pageTopArea"]):
            if(instructions["currentFigure"][0]) {
                // test transforming
                if (instructions["currentFigure"][1]) {
                    reassignLayoutSpecsByGivenClass(currentFigure, instructions["currentFigure"][1]);
                }
                // insert first figure
                renderNode.insertAdjacentElement("afterend", currentFigure);
                updateFigureMap(currentFigure.id);
            }
            else if(instructions["nextFigure"][0]) {
                // test transforming
                if (instructions["nextFigure"][1]) {
                    reassignLayoutSpecsByGivenClass(nextFigure, instructions["nextFigure"][1]);
                }
                // insert second figure
                renderNode.insertAdjacentElement("afterend", nextFigure);
                updateFigureMap(nextFigure.id);
            }
            break;

        case (contexts["pageInBetweenArea"]):
            if(instructions["currentFigure"][0]) {
                // test transforming
                if (instructions["currentFigure"][1]) {
                    reassignLayoutSpecsByGivenClass(currentFigure, instructions["currentFigure"][1]);
                }
                // insert first figure
                renderNode.insertAdjacentElement("afterend", currentFigure);
                updateFigureMap(currentFigure.id);
            }
            else if(instructions["nextFigure"][0]) {
                // test transforming
                if (instructions["nextFigure"][1]) {
                    reassignLayoutSpecsByGivenClass(nextFigure, instructions["nextFigure"][1]);
                }
                // insert second figure
                renderNode.insertAdjacentElement("afterend", nextFigure);
                updateFigureMap(nextFigure.id);
            }
            break;

        default:
            addFigIdToNextParagraph(sourceNode.id, currentFigure.id);
            addFigIdToNextParagraph(sourceNode.id, nextFigure.id);
            break;
    }
}

function getNextFigRefs(nodeId) {

    let paragraphMap = JSON.parse(localStorage.getItem("paragraph-map"));
    let figureMap = JSON.parse(localStorage.getItem("figure-map"));

    let nextFigRefs = findNextSuitableFigRefs(nodeId, paragraphMap, figureMap);
    let figRefsBefore = findFigRefsNotInserted(nodeId, paragraphMap, figureMap)

    // handle over previous figRefs not inserted before:
    if (figRefsBefore.length > 0) {
        figRefsBefore.reverse();
        for (let i = 0; i < figRefsBefore.length; i++) {
            if (!nextFigRefs.includes(figRefsBefore[i])) {
                nextFigRefs.unshift(figRefsBefore[i]);
            }
        }
    }
    return(nextFigRefs);
}

function findNextSuitableFigRefs(currentNodeId, paragraphMap, figureMap) {

    let currentNodePosition = paragraphMap[currentNodeId]["position"];
    let nextFigRef = [];
    let i = 0;  // start with current node

    // find next two figure references in current or next paragraphs:
    while (i < rangeNextFigRefs) { // nextFigRef.length !== 2 &&
        let nodeId = Object.keys(paragraphMap)[currentNodePosition + i];
        let paragraph = paragraphMap[nodeId];

        // check if figRefs exists and were not inserted before
        if (paragraph && paragraph.figRefs.length) {
            // inner loop: figRefs of paragraph
            for (let x = 0; x < paragraph.figRefs.length; ++x) {
                let figRef = paragraph.figRefs[x];

                console.log(figRef);
                if (!figureMap[figRef]["inserted"]) {
                    nextFigRef.push(figRef);
                }
            }
        }
        // if node is last of section-content (chapter) break up figRef search
        if (paragraph && !paragraphMap[nodeId]["isFirstOfSection"]) {
            i++;
        }
        else if(rangeOverSection) {
            i++;
        }
        else {
            i = rangeNextFigRefs;
        }

    }
    return (nextFigRef);
}

function findFigRefsNotInserted(currentNodeId, paragraphMap, figureMap) {

    let currentNodePosition = paragraphMap[currentNodeId]["position"];
    let figRefsNotInserted = [];
    let i = 0;  // start with currentNodePosition;

    while (i < currentNodePosition) { // figRefsUninserted.length !== 2 &&
        let nodeId = Object.keys(paragraphMap)[currentNodePosition - i];
        let paragraph = paragraphMap[nodeId];

        // check if figRefs exists and were not inserted before
        if (paragraph && paragraph.figRefs.length) {
            // inner loop: figRefs of paragraph
            for (let x = 0; x < paragraph.figRefs.length; ++x) {
                let figRef = paragraph.figRefs[x];
                if (!figureMap[figRef]["inserted"]) {
                    figRefsNotInserted.push(figRef);
                }
            }
        }
        i++;
    }

    return (figRefsNotInserted);
}

function getNextFigureElement(nextFigRef, parsedContent) {

    let figureElement = false;
    if (nextFigRef) {
        let figure = parsedContent.querySelector("figure#" + nextFigRef);
        assignLayoutSpecsToFigure(figure);
        figureElement = figure;
    }
    return(figureElement);
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

function calculateClientSizeOfFigure(figure, contexts) {

    // get available size parameter:
    let naturalWidth = figure.getAttribute("data-img-width");
    let naturalHeight = figure.getAttribute("data-img-height");
    let ratio = naturalWidth / naturalHeight;
    let figureStyleWidth = figure.style.width;

    // calculate clientWidth and clientHeight of figure:
    let clientWidthCalculated;
    let clientHeightCalculated;

    // calculate by pixel values (set by interactJs/resize):
    if(/px/.test(figureStyleWidth)) {
        clientWidthCalculated = figure.style.width.slice(0, -2); // e.g. 325
        clientHeightCalculated = figure.style.height.slice(0, -2); // e.g. 245
    }
    // calculate by width (css-)percentage values:
    else {
        let widthPercentage = figure.style.width.slice(0, -1); // e.g. 50
        clientWidthCalculated = contexts["pageContentWidth"] * widthPercentage / 100;
        clientHeightCalculated = clientWidthCalculated / ratio;
    }

    // assign values to pageContexts:
    let clientSize = {
        "clientWidthCalculated": clientWidthCalculated,
        "clientHeightCalculated": clientHeightCalculated
    };
    return (clientSize);
}

/* ----------------------------------------
Handle figure typesetting specifications
-----------------------------------------*/

function defineFigureTypesettingClass(figure) {

    let typesettingClass;
    let figureKey;

    // get calculated figure classes:
    let resTypeFigure = (figure) ? figure.classList[resTypeClassListKey] : false;
    let ratioFigure = (figure) ? figure.classList[ratioClassListKey] : false;

    // define search keys:
    figureKey = (figure) ? resTypeFigure + "-" + ratioFigure : "";

    let figureMap = JSON.parse(localStorage.getItem("figure-map"));
    let journalConfig = JSON.parse(localStorage.getItem("journal-config"));

    // check saved typesettingClass in figureMap before
    if (figureMap[figure.id]["typesettingClass"]) {
        typesettingClass = figureMap[figure.id]["typesettingClass"];
    }
    // get typeSettingClass from journalConfig:
    else {
        typesettingClass = journalConfig["figureTypesettingClass"][figureKey];
    }
    return (typesettingClass);
}

function assignLayoutSpecsToFigure(figure, givenClass = false) {

    // define typesetting class and get style specs from different sources:
    let typesettingClass = (!givenClass) ? defineFigureTypesettingClass(figure) : givenClass;
    let journalConfig = JSON.parse(localStorage.getItem("journal-config"));
    let figureModelSpecs = journalConfig["figureModelSpecs"][typesettingClass];
    let figureMap = JSON.parse(localStorage.getItem("figure-map"));

    // define figure specs by typesettingClass
    let figureWidthPreset = (figureModelSpecs) ? figureModelSpecs[0] : false;
    let figureHeightPreset = (figureModelSpecs) ? figureModelSpecs[1] : false;

    // pre-assign figure width and height:
    figure.style.width = (figureWidthPreset) ? figureWidthPreset : "auto";
    figure.style.height = (figureHeightPreset) ? figureHeightPreset : "auto";

    // override figure styles with styles saved in figureMap
    let figureId = (figure.id) ? figure.id : figure.getAttribute("data-id");
    if (figureMap) {
        if (figureMap[figureId]["style"]) {
            figure.style.cssText = figureMap[figureId]["style"];
        }
    }

    // add figure typesetting class to figure:
    figure.classList.add(typesettingClass);

    // add given positionClass to figure:
    if (figureMap[figureId]["positionClass"]) {
        figure.classList.add(figureMap[figure.id]["positionClass"]);
    }
}

function addVirtualMarginToFloatingFigure(figure, contexts) {

    if(/float/.test(figure.className)) {
        let clientSize = calculateClientSizeOfFigure(figure, contexts);
        let marginBottomDeclaredMm = getPropertyFromStylesheet(".float", "margin-bottom");

        // convert marginBottom from mm to px (1mm = 3.7795 px : default margin)
        let marginBottomPx = (marginBottomDeclaredMm) ? marginBottomDeclaredMm.slice(0, -2) * 3.78 : 38;
        let virtualMargin = clientSize["clientHeightCalculated"] - marginBottomPx;

        // set calculate margins as inline-style
        figure.style.marginBottom = "-" + virtualMargin * 0.60 + "px";
    }
    else {
        figure.style.marginBottom = "10mm";
    }
}

function toggleFigureClasses(figure, toggleCase) {

    let addClass;
    let removeClass;
    let typesettingClass = figure.classList[typesettingClassListKey];

    if(toggleCase === "figureClass") {
        switch (true) {
            case (/overmargin/.test(typesettingClass)):
                removeClass = typesettingClass;
                addClass = "regular";
                break;
            case (/regular/.test(typesettingClass)):
                removeClass =  typesettingClass;
                addClass = "inset";
                break;
            case (/inset/.test(typesettingClass)):
                removeClass =  typesettingClass;
                addClass = "float-w-col-4";
                break;
            case (/float/.test(typesettingClass)):
                removeClass = typesettingClass;
                addClass = "overmargin";
                break;
        }
    }

    if(toggleCase === "figureColumnWidth") {
        switch (true) {
            case (/float-w-col-2/.test(typesettingClass)):
                removeClass = typesettingClass;
                addClass = "float-w-col-4";
                break;
            case (/float-w-col-4/.test(typesettingClass)):
                removeClass = typesettingClass;
                addClass = "float-w-col-6";
                break;
            case (/float-w-col-6/.test(typesettingClass)):
                removeClass = typesettingClass;
                addClass = "float-w-col-2";
                break;
        }
    }

    if(toggleCase === "figureCaption") {
        switch (true) {
            case (typesettingClass === "regular"):
                removeClass = "regular";
                addClass = "regular-bottom";
                break;
            case (typesettingClass === "regular-bottom"):
                removeClass = "regular-bottom";
                addClass = "regular";
                break;
            case (typesettingClass === "overmargin"):
                removeClass = "overmargin";
                addClass = "overmargin-bottom";
                break;
            case (typesettingClass === "overmargin-bottom"):
                removeClass = "overmargin-bottom";
                addClass = "overmargin";
                break;
        }
    }

    // replace classes and reassign layout specs:
    figure.classList.toggle(addClass);
    figure.classList.remove(removeClass);
    assignLayoutSpecsToFigure(figure, addClass);

    // save changes in figureMap:
    let figureId = (figure.id) ? figure.id : figure.getAttribute("data-id");
    let figureMap = JSON.parse(localStorage.getItem("figure-map"));
    figureMap[figureId]["typesettingClass"] = addClass;
    figureMap[figureId]["style"] = false;
    localStorage.setItem("figure-map", JSON.stringify(figureMap));

    // reload document
    setTimeout(function(){
       window.location.reload();
    }, 2000);
}

// test transforming
function reassignLayoutSpecsByGivenClass(figure, addClass) {

    if(figure && addClass) {
        let figureMap = JSON.parse(localStorage.getItem("figure-map"));
        if(figure && !figureMap[figure.id]["typesettingClass"]) {
            figure.classList.toggle(addClass);
            figure.classList.remove(figure.classList[typesettingClassListKey]);
            assignLayoutSpecsToFigure(figure, addClass);
        }
    }
}

/* ---------------------------------------------
Optimize element positions after page rendering
-----------------------------------------------*/

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
        element.title = element.className;
    }
}

function classifyElementPositionOnPage(pageElement) {

    let pageContent = pageElement.querySelector(".pagedjs_page_content");
    let elementsOfPage = pageContent.querySelectorAll("p.content-paragraph,.title,table,ul,figure");
    let lastIndex = elementsOfPage.length - 1;

    for (let i = 0; i < elementsOfPage.length; i++) {
        let element = elementsOfPage[i];
        if (element.matches("figure") || /title/.test(element.className)) {
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
            element.title = element.className;
        }
    }
}

function adjustLayoutOfElements(sourceNode, contexts) {

    let bottomAreaNoHeadlinePx = contexts["pageContentHeight"] / 9;
    let bottomAreaNoTitleAppendixPx = contexts["pageContentHeight"]-100;
    let bottomAreaNoTablePx = contexts["pageContentHeight"] / 7;

    if(/title/.test(sourceNode.className)) {
        // add top-margins to headlines and push them to next page:
        if(contexts["remainingSpace"] < bottomAreaNoHeadlinePx) {
            sourceNode.style.marginTop = contexts["remainingSpace"] + 50 + "px";
        }
        // remove top-padding from headlines set after figure element:
        if(contexts["elementSetBefore"].tagName === "FIGURE") {
            sourceNode.style.paddingTop = 0;
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
}

function adjustElementPositionOnPage(pageElement) {

    let pageContent = pageElement.querySelector(".pagedjs_page_content");
    let elementsOfPage = pageContent.querySelectorAll("p,.title,table,ul,figure,figCaption, pre");

    for (let i = 0; i < elementsOfPage.length; i++) {
        let element = elementsOfPage[i];
        let firstElement = elementsOfPage[0];

        //  push figures on top of each page
        if (element.matches("figure") && i !== 0) {

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

function initProgressBar(processStage) {

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

function makeElementsInteractive(pageElement) {

    const interactElements = "figure,figCaption";
    let pageContent = pageElement.querySelector(".pagedjs_page_content");
    let elementsOfPage = pageContent.querySelectorAll(interactElements);

    for (let i = 0; i < elementsOfPage.length; i++) {
        let element = elementsOfPage[i];
        if (element.matches("figure")) {
            element.classList.add("resizable");
            element.classList.add("draggable");
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
                        height: `${event.rect.height}px`,
                        transform: `translate(${x}px, ${y}px)`
                    });

                    Object.assign(event.target.dataset, {x, y});

                    // save styles:
                    saveInteractStylesInFigureMap(event.target);
                }
            },
            modifiers: [
                interact.modifiers.aspectRatio({
                    ratio: "preserve"
                }),
            ],
        });

    interact('.draggable')
        .draggable({
            // enable inertial throwing
            inertia: true,
            // enable autoScroll
            autoScroll: true,

            listeners: {
                // call this function on every dragmove event
                move: dragMoveListener,

                // call this function on every dragend event
                end(event) {
                    var textEl = event.target.querySelector('p')

                    textEl && (textEl.textContent =
                        'moved a distance of ' +
                        (Math.sqrt(Math.pow(event.pageX - event.x0, 2) +
                            Math.pow(event.pageY - event.y0, 2) | 0))
                            .toFixed(2) + 'px');
                }
            }
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
            string = string.replace(url, '<a target="_blank" href="' + url + '">' + url + "</a>");
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

    let scrollArray = [];
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
};
