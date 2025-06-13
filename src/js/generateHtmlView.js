/** -----------------------------------
* Create main DOM-elements as constants
----------------------------------------*/
// initialize navigationPanels array:
const navigationPanelsDocument = [];

// navigation element to switch between each panel
const navHeader = document.createElement("div");
navHeader.id = "nav-header";

// wrapper for textContent and panelWrapper
const mainWrapper = document.createElement("div");
mainWrapper.id = "main-wrapper";

// wrapper containing the text-content (main-text)
const textContentWrapper = document.createElement("div");
textContentWrapper.id = "text-content-wrapper";
textContentWrapper.classList.add("column");

// wrapper containing all panels (figures, referenceList)
const panelWrapper = document.createElement("div");
panelWrapper.id = "panel-wrapper";
panelWrapper.classList.add("column");

/** --------------------------------------
 * window document state event listener:
 * @type {document}
 * @type {EventListenerObject}
 --------------------------------------*/
 document.addEventListener("readystatechange", (event) => {

    if (event.target.readyState === "complete") {

        // get content-body:
        let contentBody = document.querySelector("#content-body");

        // create additional document elements:
        let doiElement = createDoiElement();
        let titleHeader = createTitleHeader(contentBody);
        let abstractSection = getAbstractSection(contentBody);
        titleHeader.appendChild(abstractSection);

        // create content panel (ToC):
        const panelContents = createPanel("contents", false);
        navigationPanelsDocument.push("contents");
        let posterImage = contentBody.querySelector("#poster-image");
        if (posterImage) {
            posterImage.classList.add("cover-image");
            panelContents.appendChild(posterImage);
        }
      
        // extract supplement links from anchors:
        let anchors = document.querySelectorAll( // exclude weblinks and zenon-links
            "a.ext-ref:not([data-specific-use='weblink']):not([data-specific-use='zenon']"
        ); 
        let supplementsLinks = extractSupplementsLinks(anchors);
        let numSupplements = countSupplementLinks(supplementsLinks);
        
        // create content and supplementary panels:
        createContentPanels(contentBody);
        createSupplementPanels(numSupplements);
        // fetch supplementary data from external sources:
        fetchExternalData(supplementsLinks);

        // create meta-panel:
        let panelMeta = createPanel("metadata", "Metadata", false);
        panelWrapper.appendChild(panelMeta);
        navigationPanelsDocument.push("metadata");
      
        // create imprint section:
        let front = document.querySelector(".front");
        let imprintSection;
        if(front !== null) {
            imprintSection = createImprintSection(front);
            panelMeta.appendChild(imprintSection);
        }

        // create imprint section:
        let metaSection = createMetaSection(front);
        panelMeta.appendChild(metaSection);

        // remove <front> and <body>
        if(contentBody.querySelector(".front")) {
            contentBody.querySelector(".front").remove();
        }
        if(contentBody.querySelector(".back")) {
            contentBody.querySelector(".back").remove();
        }

        // create ToC-list and add to panel contents
        let tocList = createToCByHeadlines(contentBody);
        panelContents.appendChild(tocList);
        panelWrapper.appendChild(panelContents);
     
        // add content to textContentWrapper
        textContentWrapper.append(doiElement);
        textContentWrapper.append(titleHeader);
        textContentWrapper.append(contentBody);

        // add wrapper to document-body:
        mainWrapper.appendChild(navHeader);
        mainWrapper.appendChild(textContentWrapper);
        mainWrapper.appendChild(panelWrapper);
        document.body.appendChild(mainWrapper);
        createPanelNavigation(navigationPanelsDocument);

        // define image scaling:
        document.querySelectorAll('img:not(.iDAI-icon)').forEach(function(img) {
            img.onerror = function(){this.style.display='none';};
            img.setAttribute("loading", "lazy");
            scaleImage(img);
        });

        // add document index:
        if(addDocumentIndex) {
            let indexSection = createDocumentStats(numSupplements)
            panelMeta.appendChild(indexSection);
        }

        // init additional js-functions:
        checkQualityOfUrls();
        showSelectedPanel("contents");
        createIndexOfInternalReferences("figure", "fig-ref");
        createIndexOfInternalReferences(".reference", "bib-ref");

        // fade-in:
        document.body.classList.add("fade-in");
    }
});

/**
 * create imprint section to display journal information related to imprint
 * @param {DocumentFragment} front html-element with xml-front elements
 * @returns {HTMLElement} imprintSection: enhanced with imprint information  
 */
function createImprintSection(front) {

    // prepare imprint elements:
    let imprintSection = document.createElement("div");
    imprintSection.classList.add("imprint-section");
    let imprintSectionTitle = document.createElement("h3");
    imprintSectionTitle.classList.add("title", "panel-title", "section-title")
    imprintSectionTitle.textContent = "Imprint";
    imprintSection.appendChild(imprintSectionTitle);

    // journal title:
    let journalTitle;
    let journalDOI;
    if(front.querySelector(".journal-title") !== null) {
        journalTitle = front.querySelector(".journal-title");
        // add journal DOI:
        let journalDOILink;
        if(front.querySelector(".journal-id[journal-id-type='doi']") !== null) {
            journalDOI = front.querySelector(".journal-id[journal-id-type='doi']");
            journalDOILink = document.createElement("a");
            journalDOILink.id = "journal-doi-link";
            journalDOILink.href = journalDOI.innerText;
            journalDOILink.textContent = journalTitle.textContent;
            journalTitle.innerHTML = journalDOILink.outerHTML;
        } else {
            journalTitle.innerHTML = journalTitle.innerText;
        }
        imprintSection.appendChild(journalTitle);
    }

    // publisher:
    let publisher;
    if(front.querySelector(".publisher") !== null) {
        publisher = front.querySelector(".publisher");
        imprintSection.appendChild(publisher);
    }

    return (imprintSection);
}

/**
 * create meta section to display xml related metadata (xml-front) as details-
 * element containing preformatted xml-code 
 * @param {DocumentFragment} front html-element with xml-front elements
 * @returns {HTMLElement} metaSection enhanced with meta information  
 */
function createMetaSection(front) {

    // create elements:
    let metaSection = document.createElement("div");
    metaSection.id = "meta-section";
    let metaSectionTitle = document.createElement("h3");
    metaSectionTitle.classList.add("title", "panel-title", "section-title")
    metaSectionTitle.textContent = "Document Metadata";
    metaSection.appendChild(metaSectionTitle);

    // add link to source:
    if(front.querySelector(".article-id[pub-id-type='doi'") !== null) {
        let sourceNotice = document.createElement("div");
        sourceNotice.id = "source-notice";
        sourceNotice.innerHTML = "Please follow the DOI-link to obtain further information relating to this article:"
        
        let doiElement = createDoiElement();
        doiElement.id = "source-link-imprint";
        sourceNotice.appendChild(doiElement);
        metaSection.appendChild(sourceNotice);
    }    

    // append preformatted xml-code of <journal-meta> and <article-meta>:
    let journalMetaCode = document.querySelector("#journal-meta-preformatted");
    let articleMetaCode = document.querySelector("#article-meta-preformatted");
    metaSection.appendChild(journalMetaCode);
    metaSection.appendChild(articleMetaCode);

    return(metaSection);
}

/** -----------------------------
* Generate HTML view of document
--------------------------------*/
/**
 * create title header
 * @param {HTMLElement} contentBody: div-container with article text and metadata 
 * @returns {HTMLElement} titleHeader with title, subtitle and author information
 */
function createTitleHeader(contentBody) {

    // get title page information:
    let title = contentBody.querySelector(".article-title");
    let subtitle = contentBody.querySelector(".subtitle");
    let authors = contentBody.querySelectorAll(".contrib[contrib-type='author']");
    let contributors = contentBody.querySelectorAll(".contrib[contrib-type='co-author']");
    let lang = document.documentElement.lang;

    // transform author information to String:
    let authorsCollection = [];
    let givenName;
    let surName;
    for (let i = 0; i < authors.length; i++) {
        if(authors[i].querySelector(".given-names") !== null) {
            givenName = authors[i].querySelector(".given-names").textContent;
        }
        if(authors[i].querySelector(".surname") !== null) {
            surName = authors[i].querySelector(".surname").textContent;
        }
        authorsCollection.push(givenName + " " + surName);
    }

    // transform contributors information to String:
    let contributorsCollection = [];
    let givenNameContributor;
    let surNameContributor;
    for (let i = 0; i < contributors.length; i++) {
        if(contributors[i].querySelector(".given-names") !== null) {
            givenNameContributor = contributors[i].querySelector(".given-names").textContent;
        }
        if(contributors[i].querySelector(".surname") !== null) {
            surNameContributor = contributors[i].querySelector(".surname").textContent;
        }
        contributorsCollection.push(givenNameContributor + " " + surNameContributor);
    }

    // create titleHeader elements:
    let titleHeader = document.createElement("div");
    titleHeader.id = "page-header";
    let titleElement = document.createElement("h1");
    titleElement.className = "page-title";
    let subtitleElement = document.createElement("h1");
    subtitleElement.className = "page-subtitle";
    let authorsElement = document.createElement("h1");
    authorsElement.className = "page-authors";
    let contributorsElement = document.createElement("p");
    contributorsElement.className = "page-contributors";

    // fill titleHeader elements with content:
    titleElement.innerHTML = (title) ? title.textContent : "[Kein Titel]";
    subtitleElement.innerHTML = (subtitle) ? subtitle.textContent : "";
    authorsElement.innerHTML = (authorsCollection.length) ? authorsCollection.join(", ") : "[Keine Autoren]";
    if(contributorsCollection.length && lang !== undefined) {
        contributorsElement.innerHTML = contributorsPrepositions[lang] + " " + contributorsCollection.join(", ");
    }

    // append elements to titleHeader:
    titleHeader.append(titleElement);
    titleHeader.append(subtitleElement);
    titleHeader.append(authorsElement);
    titleHeader.append(contributorsElement);

    return (titleHeader);
}

/**
 * create DOI element, added as first element on top of page
 * @returns {HTMLElement} doiElement: div with anchor as child and doi as href
 * and textContent
 */
function createDoiElement() {

    // get documentId (= DOI), saved in localStorage 
    let documentId = getDocumentStateProperty("documentId");
    let doi = (documentId) ? documentId : "no-doi-assigned";

    // create elements:
    let doiElement = document.createElement("div");
    doiElement.id = "doi-link";
    let doiAnchor = document.createElement("a");
    doiAnchor.id = "doi-anchor";
    doiAnchor.target = "_blank";
    doiAnchor.href = doi;
    doiAnchor.textContent = doi;
    doiElement.appendChild(doiAnchor);

    return (doiElement);
}

/**
 * create abstract section (for abstract and trans-abstract in each language)
 * @param {HTMLElement} contentBody: div-container with article text and metadata 
 * @returns {HTMLElement} abstractSection: div with abstract titles as nav elements 
 * and abstract-text in box container (opened/closed by click-function)
 */
function getAbstractSection(contentBody) {

    // create abstract-section:
    let abstractSection = document.createElement("div");
    abstractSection.id = "abstracts-section";

    // abstract box navigation:
    let abstractNav = document.createElement("div");
    abstractNav.id = "abstract-navigation";
    
    // query abstract content
    let abstracts = contentBody.querySelectorAll(".abstract, .trans-abstract");
    if(abstracts.length) {
        abstracts.forEach(function(abstract) {
            // get abstract lang and abstract title:
            let abstractLang = abstract.getAttribute("lang");
            let abstractTitleElement;
            let abstractTitle;
            if(abstract.querySelector(".title") !== null) {
                abstractTitleElement = abstract.querySelector(".title");
                abstractTitle = abstractTitleElement.textContent.trim();
            } 
            else {
                abstractTitleElement = false;
                abstractTitle = "No-abstract-title";
            }

            // get abstract text:
            let abstractTextElement;
            if(abstract.querySelector(".abstract-text") !== null) {
                abstractTextElement = abstract.querySelector(".abstract-text");
            } else {abstractTextElement = abstract.querySelector("p");}
          
            // create abstract elements view:
            if(abstractTextElement !== null) {
              
                if(abstractLang !== null) {
                    // add lang:attribute to abstract text element:
                    abstractTextElement.setAttribute("lang", abstractLang);

                    // create abstract nav buttons:
                    let abstractBtn = document.createElement("button");
                    abstractBtn.classList.add("abstract-button");
                    abstractBtn.textContent = abstractTitle;
                    abstractBtn.setAttribute("onclick", "openAbstractBox(event);");
                    abstractNav.appendChild(abstractBtn);

                    // create abstract tab box:
                    let abstractBox = document.createElement("div");
                    abstractBox.classList.add("abstract-box")
                    abstractBox.id = abstractTitle;
                    abstractBox.appendChild(abstractTextElement);
                    abstractSection.appendChild(abstractBox);
                }
            }
        });
        abstractSection.insertAdjacentElement("afterbegin", abstractNav);
     
    }
    return(abstractSection);
}

/**
 * create content panels (figures, footnotes, references)
 * @param {HTMLElement} contentBody: div-container with article text and metadata 
 * @returns {void} panels will appended to panelWrapper (constant)
 */
function createContentPanels(contentBody) {

    // create panel figures:
    let figureSection = contentBody.querySelector(".figure-section");
    if (figureSection !== null && figureSection.querySelectorAll("figure").length) {
        figureSection = reorderFigureElements(figureSection);
        let panel = createPanel("figures", false, figureSection);
        panelWrapper.appendChild(panel);
        navigationPanelsDocument.push("figures");
    }

    // create panel footnotes:
    let footnoteSection = contentBody.querySelectorAll(".footnotes-section")[0];
    if(footnoteSection) {

        let footnotes = footnoteSection.querySelectorAll(".footnote");
        addFootnoteToTextAnchor(footnotes);

        let bibRefs = footnoteSection.querySelectorAll("a.bib-ref");
        titleOfResourcesAsToolTip(bibRefs);
     
        let panel = createPanel("notes", false, footnoteSection);
        panelWrapper.appendChild(panel);
        navigationPanelsDocument.push("notes");
    }

    // create panel references:
    let referenceSection = contentBody.querySelectorAll(".reference-section")[0];
    if(referenceSection) {
        let references = referenceSection.querySelectorAll(".reference");
        references.forEach(reference => {
            let citation = reference.querySelector(".mixed-citation");
            // extract zenon-Links out of reference:
            let zenonReference = citation.querySelector("a[data-specific-use='zenon']");
            let zenonLink = createZenonLink(zenonReference);
            // urlify url-strings in references:
            citation.innerHTML = URLifyString(citation.innerText);
            // re-append zenon-links at the end of reference
            if(zenonLink) {citation.appendChild(zenonLink);}
              
        });
        let panel = createPanel("references", "References", referenceSection);
        panelWrapper.appendChild(panel);
        navigationPanelsDocument.push("references");
    }
}

/**
 * create zenon link (if available) as separate anchor element 
 * @param {HTMLElement} zenonReference: zenon-anchor extracted from reference
 * @returns {HTMLElement} zenonLink: new anchor element
 */
function createZenonLink(zenonReference) {
    let zenonLink;
    if(zenonReference !== null) {
        zenonLink = document.createElement("a");
        zenonLink.classList.add("zenon-link");
        zenonLink.target = "_blank";
        zenonLink.href = zenonReference.href;
        zenonLink.textContent = "iDAI.bibligraphy/Zenon";
    }
    else {zenonLink = false;}
    return(zenonLink);
}

/**
 * add anchor linking between fn-label and footnote-link in main text
 * @param {HTMLCollection} footnotes: footnote-elements from footnote-section
 * @returns {void} nToTextAnchor will appended to fn-label
 */

function addFootnoteToTextAnchor(footnotes) {
          
    footnotes.forEach(footnote => {
        let label = footnote.querySelector(".label");
        if(footnote.id !== undefined) {
            let hrefSelector = "[href='#" + footnote.id + "']"; 
            let textToFnAnchor = document.querySelector(".fn-ref" + hrefSelector);
            if(textToFnAnchor !== null) {
                let parent = textToFnAnchor.parentElement;
                let fnToTextAnchor = document.createElement("a");
                fnToTextAnchor.classList.add("index-ref");
                fnToTextAnchor.textContent = label.textContent;
                fnToTextAnchor.href = "#" + parent.id;
                label.textContent = "";
                label.appendChild(fnToTextAnchor);
            }
        }
    });
}

/**
 * create supplement panels (iDAI.world-panels and information panel)
 * @param {object} numSupplements: amout of references to objects of 
 * supported iDAI.world systems 
 * @returns {void} panels will appended to panelWrapper (constant)
 */
function createSupplementPanels(numSupplements) {
  
    // create panel for gazetteer locations:
    if(numSupplements["gazetteer"]) {
        let panel = createPanel("locations", "Locations", false);
        appendFetchStateBarToPanel(panel, "gazetteer");
        panelWrapper.appendChild(panel);
        navigationPanelsDocument.push("locations");
    }

    // create panel for field objects:  
    if(numSupplements["field"]) {
        let panel = createPanel("field", "Objects from iDAI.field", false);
        appendFetchStateBarToPanel(panel, "field");
        panelWrapper.appendChild(panel);
        navigationPanelsDocument.push("field");
    } 

    // create panel for arachne objects:       
    if(numSupplements["arachne"]) {
        let panel = createPanel("arachne", "Objects from iDAI.objects/arachne", false);
        appendFetchStateBarToPanel(panel, "arachne");
        panelWrapper.appendChild(panel);
        navigationPanelsDocument.push("arachne");
    }
}

/**
 * create panel element
 * @param {String} panelName: name of panel (e.g. "references")
 * @param {String} defaultTitle: default title of panel, if not given by xml
 * @param {HTMLElement} content: content of each section
 * @returns {HTMLElement}: panel div with panel title and content
 */
function createPanel(panelName, defaultTitle = false, content = false) {

    // create panel element:
    let panel = document.createElement("div");
    panel.classList.add("panel", "resource-view", "hidden");
    panel.id = panelName;
  
    // add panel content
    if(content) {panel.appendChild(content);}

    // add panel title:
    if(panelName !== "contents" && panelName !== "metadata") {
        let title = panel.querySelector(".title");
        if(title === null) {
            title = document.createElement("h3");
            title.textContent = (defaultTitle) ? defaultTitle : "[No title]";
            title.classList.add("title", "panel-title", "section-title");
            panel.insertAdjacentElement("afterbegin", title);
        } else {
            title.classList.add("panel-title");
        }
    }
    return(panel);
}

/**
 * count elements and display stats tables
 * @param {object} numSupplements: amout of references to objects of 
 * supported iDAI.world systems 
 * @returns {HTMLElement} indexSection enhanced with document statistics
 */
function createDocumentStats(numSupplements) {

    // create section elements
    let indexSection = document.createElement("div");
    indexSection.id = "index-section";
    let indexSectionTitle = document.createElement("h3");
    indexSectionTitle.classList.add("title", "panel-title", "section-title")
    indexSectionTitle.textContent = "Document Statistics";
    indexSection.appendChild(indexSectionTitle);

    // get elements to be counted:
    let paragraphs = document.querySelectorAll(".content-paragraph");
    let sections = document.querySelectorAll("section");
    let figures = document.querySelectorAll("figure");
    let notes = document.querySelectorAll(".footnote");
    let references = document.querySelectorAll(".reference");

    // count chars of all paragraphs (without whitespace)
    let paragraphAllChars = 0;
    paragraphs.forEach(function(paragraph) {
        paragraphAllChars += paragraph.innerText.trim().length;
    });

    // count chars of all footnotes (without whitespace)
    let footnoteAllChars = 0;
    notes.forEach(function(note) {
        footnoteAllChars += note.innerText.trim().length;
    });

    // count weblinks (exluding links in ref-list and supplementary References)
    let otherWebReferences = document.querySelectorAll("a.ext-ref[data-specific-use='weblink']");

    // add result as table data to infos panel: 
    let indexTable = document.createElement("table");
    indexTable.classList.add("index-table");

    let tableData =
        "<tr><td>Sections:</td><td class='value'>" + sections.length + "</td></tr>" +
        "<tr><td>Paragraphs:</td><td class='value'>" + paragraphs.length + "</td></tr>" +
        "<tr><td>- Characters (with whitespace)</td><td class='value'>" + paragraphAllChars + "</td></tr>" +
        "<tr><td>Foot-/Endnotes:</td><td class='value'>" + notes.length + "</td></tr>" +
        "<tr><td>- Characters (with whitespace)</td><td class='value'>" + footnoteAllChars + "</td></tr>" +
        "<tr><td>Figures:</td><td class='value'>" + figures.length + "</td></tr>" +
        "<tr><td>Bibliographical References:</td><td class='value'>" + references.length + "</td></tr>" +
        "<tr><td>Supplementary References:</td><td class='value'></td></tr>" +
        "<tr><td>- iDAI.gazetteer (Locations):</td><td class='value'>" + numSupplements["gazetteer"] + "</td></tr>" +
        "<tr><td>- iDAI.objects/arachne:</td><td class='value'>" + numSupplements["arachne"] + "</td></tr>" +
        "<tr><td>- iDAI.field:</td><td class='value'>" + numSupplements["field"] + "</td></tr>" +
        "<tr><td>Other Web References:</td><td class='value'>" + otherWebReferences.length + "</td></tr>"
    indexTable.innerHTML = tableData;

    // append table to index section:
    indexSection.appendChild(indexTable);

    return(indexSection);
}

/**
 * create index of internal references, e.g. bib-refs, fig-refs
 * @param {String} elementSelector: css selector of target element listed in panel area
 *  (e.g. ".reference")
 * @param {String} referenceSelector: css selector of referencing anchors in text area
 *  (e.g. ".bib-ref")
 * @returns {void} results will appended to each target element as internalIndexAnchor and
 * internalIndexBox
 */

function createIndexOfInternalReferences(elementSelector, referenceSelector) {
       
    // get element and referenceIndex by given selectors
    let elements = document.querySelectorAll(elementSelector);
    let elementsRefIndex = getReferenceIndex(elements, referenceSelector);

    // process each target element:
    elements.forEach(function(element) {
        if(element.id !== null && element.id !== "poster-image") {
            let refIndex = elementsRefIndex[element.id];
        
            // create details element for displaying results:
            let internalIndexBox = document.createElement("details");
            internalIndexBox.classList.add("internal-index-box");
           
            // create summary as button title:
            let internalIndexSummary = document.createElement("summary");
            internalIndexSummary.classList.add("internal-index-summary");
            internalIndexSummary.textContent = "Found in text (" + refIndex.totalNumber + ")";          
     
            // parse and list positive results in form of quotes:
            if(refIndex.totalNumber !== 0) {
                if(refIndex.refLinks.length) {
                    refIndex.quotes.forEach(entry => {
                        let listElement = document.createElement("li");
                        let labelAnchor = document.createElement("a");
                        labelAnchor.classList.add("index-ref");
                        labelAnchor.href = "#" + entry.id;
                        labelAnchor.innerHTML = "<i>&#9741;</i>";
                        
                        // add clipped text passage from entry:
                        let textQuote = document.createElement("span");
                        textQuote.classList.add("text-quote");
                        textQuote.innerHTML = entry.innerHTML;
              
                        listElement.appendChild(labelAnchor);
                        listElement.appendChild(textQuote);
                        internalIndexBox.appendChild(listElement);
                    });
                }
            // highlight negative results (to be avoided by editorial policy)
            } else {
                internalIndexSummary.classList.add("warning-box");
            }
            // append results to target element:
            internalIndexBox.appendChild(internalIndexSummary); 
            element.appendChild(internalIndexBox);
        }
    });   
}

/**
 * get reference index for given target elements (e.g. .references, figures)
 * @param {HTMLCollection} elements: target element listed in panel area
 *  (e.g. ".reference")
 * @param {String} referenceSelector: css selector of referencing anchors in text area
 *  (e.g. ".bib-ref")
 * @returns {JSON} referenceIndex with totalNumber, refLinks and quotes
 */
function getReferenceIndex(elements, referenceSelector) {

    let referenceIndex = {};
    
    elements.forEach(function(element) {
        // exclude elements with missing ids and poster-image
        if(element.id !== null && element.id !== "poster-image") {
            let refLinks = [];
            let quotes = [];

            // define selector for reference anchor for given type, e.g. fig-ref:
            let refSelector = "a." + referenceSelector + "[href='#" + element.id + "']";
            
            // query referenceElements:
            let referenceElements = document.querySelectorAll(refSelector);

            // filter out elements in text-quote-span (containing copies of the original elements):
            referenceElements = Array.from(referenceElements)
                .filter(el => !el.parentElement.classList.contains("text-quote"))

            // process referenceElements:
            if(referenceElements.length) {
                // get links and quotes from closest parent:
                referenceElements.forEach(refElement => {
                    let closestParentIds = [];
                    let closestParentElement = refElement.closest("*[id]");
                    if(closestParentElement !== null) {
                        closestParentIds.push(closestParentElement.id);
                    }
                    refLinks.push(closestParentIds);
                    quotes.push(refElement.parentElement);
                });
            }
            // collect all values as reference stats:
            let referenceStats = {
                "totalNumber": referenceElements.length,
                "refLinks": refLinks,
                "quotes": quotes,
            };
            // add reference stats of each element:
            referenceIndex[element.id] = referenceStats;
        }
    });
    return(referenceIndex);
}

/**
 * add title of resources (references) as tool-tip of bib-refs
 * @param {NodeList} bibRefs: anchor, short reference
 * @returns {void} bibliographic titles will added directly
 */
function titleOfResourcesAsToolTip(bibRefs) {
  
    bibRefs.forEach(function(bibRef) {
        let refTarget; // href to bibliographic reference (id)
        let target; // bibliographic reference (element)

        if(bibRef.href !== null && bibRef.href) {
            refTarget = bibRef.getAttribute("href");
            // exclude ids with whitespace separator:
            if(!refTarget.includes(' ')) {
                target = document.querySelector(refTarget);
                let bibTitle; // bib reference as full citation
                if(target !== null) {
                    bibTitle = target.querySelector("p");
                    // trim valid bibTitles
                    if(bibTitle !== null && bibTitle.textContent) {
                        bibTitle = bibTitle.textContent.trim();
                        bibTitle = bibTitle.replace(/[\n\r]+|[\s]{2,}/g, ' ');
                    } else ( bibTitle = "No title found");
                    // add bibTitle as tooltip (title-attribute)
                    bibRef.title = bibTitle;
                }
            }
            else {console.warn("'" + refTarget + "' is not a valid selector");}
        }
    });
}

/**
 * create table of Contents (ToC) by headlines
 * @param {HTMLElement} contentBody: div-container with article text and metadata 
 * @returns {HTMLElement} tocList: <ul> with tocListItems (li) and anchors
 */
function createToCByHeadlines(contentBody) {

    let headlines = contentBody.querySelectorAll(".title");
    let tocList = document.createElement("ul");
    tocList.id = "toc-list";

    if (headlines !== null && headlines.length > 0) {
        for (let i = 0; i < headlines.length; ++i) {
            // get level in hierarchy:
            let level = headlines[i].getAttribute("level");
            let levelClass = "level-" + level; 

            // create tocList items and anchors:
            let tocListItem = document.createElement("li");
            tocListItem.classList.add("heading-ref", levelClass);
            let tocEntry = document.createElement("a");
            tocEntry.classList.add("heading-ref-a");

            // define ids and inline hrefs:
            let titleId = "title-" + i;
            let tocId = "toc-" + i;
            headlines[i].id = titleId;
            tocEntry.id = tocId;
            headlines[i].setAttribute("href", "#" + tocId);
            tocEntry.setAttribute("href", "#" + titleId);
            
            // append content and children
            tocEntry.innerHTML = headlines[i].innerHTML;
            tocListItem.appendChild(tocEntry);
            tocList.appendChild(tocListItem);    
        }
    }
    return(tocList);
}

/**
 * create panelNavigation (nav) for given panel-names
 * @param {Array} navigationPanelsDocument: given panel-names
 * @returns {void} panelNavigation will appended to navHeader
 */

function createPanelNavigation(navigationPanelsDocument) {

    // create panelNavigation and panelNavigationList
    let panelNavigation = document.createElement("nav");
    panelNavigation.classList.add("panel-navigation");
    let panelNavigationList = document.createElement("ul");

    // create elements for each panel name:
    if(navigationPanelsDocument.length > 0) {
        navigationPanelsDocument.forEach((panelName) => { 
            let li = document.createElement("li");
            li.classList.add("nav-" + panelName);
            let a = document.createElement("a");
            a.classList.add("panel-anchors");
            a.id = "a-" + panelName;
            a.innerHTML = navIcons[panelName];
            a.href = "#" + panelName;
            a.setAttribute("onclick", "showSelectedPanel('" + panelName + "')");
            li.appendChild(a);
            panelNavigationList.appendChild(li);
        });
    }
    // append panelNavigation to navHeader
    panelNavigation.appendChild(panelNavigationList);
    navHeader.appendChild(panelNavigation);
}

/**
 * reorder elements within <figure>-container, e.g. altText, label and attribution
 * @param {HTMLElement} figureSection: div with figures
 * @returns {HTMLElement} figureSection with reordered figure elements
 */

function reorderFigureElements(figureSection) {

    let figures = figureSection.querySelectorAll("figure");
    if(figures.length) {
        figures.forEach(figure => {
            let label = figure.querySelector(".label");
            let figCaption = figure.querySelector("figcaption");
            let attribution = figure.querySelector(".attribution");
            let license = figure.querySelector(".license");
            let img = figure.querySelector("img");

            if(figCaption !== null) {
                if(img !== null && figCaption.querySelector("p[id]") !== null) {
                    /* use figCaption due to the absence of dedicated alternative texts,
                    that are helpfully describing the image motif (=> "Barrierefreiheit") */
                    let altText = figCaption.querySelector("p[id]").textContent;
                    img.alt = altText;
                }
                if(label !== null) {
                    figCaption.insertAdjacentElement("afterbegin", label);
                }
                if(attribution !== null) {
                    figCaption.insertAdjacentElement("beforeend", attribution);
                } 
                if(license !== null) {
                    figCaption.insertAdjacentElement("beforeend", license);
                }  
            }
        });
    }
    return(figureSection);
}

/** ---------------------------------
* supplementary data related function
--------------------------------------*/
/**
 * append fetch-state-bar to panel
 * @param {HTMLElement} panel div with panel title and content
 * @param {String} dataSourceId name of dataSource, e.g. "arachne",
 * used as id-part for each fetchStateBar (div)
 * @returns {void} fetchStateBar will appended to panel
 */

function appendFetchStateBarToPanel(panel, dataSourceId) {
    
    let fetchStateBar = document.createElement("div");
    fetchStateBar.id = "fetch-state-" + dataSourceId;
    fetchStateBar.classList.add("warning-box");
    panel.appendChild(fetchStateBar); 
}

/**
 * extract supplement links (inlcuding location data)
 * @param {NodeList} anchors specified as supplement links
 * @returns {array} supplementsLinks: array enriched with urlProperties
 */
function extractSupplementsLinks(anchors) {

    let supplementsLinks = [];
    let selfHost= window.location.host;
        
    // parse anchors:
    let targetPrefix; 
    for (let i = 0; i < anchors.length; ++i) {
        // exclude empty and internal links
        if(anchors[i].href !== "" && anchors[i].host !== selfHost) {
            
            // define id of referencing anchor
            let refAnchorId = "data-ref-" + i + 1;
            anchors[i].id = refAnchorId;
            
            // parse url:
            let url = new URL(anchors[i].href);
            let apiRefUrl = getApiRefUrl(url);
            
            if(apiRefUrl.apiUrl) {
                // define url properties
                let urlProperties = {
                    'url': url,
                    'apiUrl': apiRefUrl.apiUrl,
                    'apiSource': apiRefUrl.apiSource,
                    'refAnchorId': refAnchorId,
                    "refText": anchors[i].textContent
                };
                supplementsLinks.push(urlProperties);

                // define target-prefix by apiSource: 
                if(/gazetteer/.test(apiRefUrl.apiSource)) {
                    targetPrefix = "gazetteer";
                }
                if(/arachne/.test(apiRefUrl.apiSource)) {
                    targetPrefix = "arachne";
                }
                if(/field/.test(apiRefUrl.apiSource)) {
                    targetPrefix = "field";
                }
            }
            // set #target-prefix-id as href-attribute to anchor: 
            anchors[i].href = "#target-" + targetPrefix + "-" + refAnchorId;
        }
    }
    return(supplementsLinks);
}

/**
 * count supplement links (for document index)
 * @param {array} supplementsLinks: array enriched with urlProperties
 * @returns {array} numSupplements: array with amount of links, sorted
 * by source system (e.g. gazetter, arachne)
 */
function countSupplementLinks(supplementsLinks) {

    // init object:
    let numSupplements = {
        "arachne": 0,
        "gazetteer": 0,
        "field": 0,
    }
    // count each supplement link:
    supplementsLinks.forEach(supplementsLink => {
        if(/gazetteer/.test(supplementsLink.apiSource)) {
            numSupplements["gazetteer"] = numSupplements["gazetteer"] + 1;
        }
        if(/arachne/.test(supplementsLink.apiSource)) {
            numSupplements["arachne"] = numSupplements["arachne"] + 1;
        }
        if(/field/.test(supplementsLink.apiSource)) {
            numSupplements["field"] = numSupplements["field"] + 1;
        }
    });

    return(numSupplements);
}

/**
 * get url of supplement link referencing to data api
 * @param {object} url-interface object from given anchor-href
 * @returns {json} apiRefUrl: json with url properties
 */
function getApiRefUrl(url) {

    let apiRefUrl = {};
    if(url.protocol !== "https") {url.protocol = "https";}

    let objectId;
    switch (true) {
        case (/arachne.dainst.org/.test(url.hostname)):
            apiRefUrl.apiUrl = url.origin + "/data" + url.pathname;
            apiRefUrl.apiSource = "arachne";
            break;
        case (/gazetteer.dainst.org/.test(url.hostname)):
            objectId = url.pathname.split("/")[2];
            if(objectId !== undefined) {
                apiRefUrl.apiUrl = "https://gazetteer.dainst.org/doc/" + objectId;
                apiRefUrl.apiSource = "gazetteer";
            }
            break;
        case (/field.idai.world/.test(url.hostname)):
            objectId = url.pathname.split("/")[3];;
            if(objectId !== undefined) {
                apiRefUrl.apiUrl = "https://field.idai.world/api/documents/" + objectId;
                apiRefUrl.apiSource = "field";
            }
            break;
        default:
            apiRefUrl.apiUrl = false;
            apiRefUrl.apiSource = false;
            break;
    }
    return(apiRefUrl);
}

/**
 * (async) fetch external (supplement) data
 * @param {array} supplementsLinks: array enriched with urlProperties
 * @returns {void} stores the fetched results in supplementLinks and 
 * handles it over to renderExternalData()
 */
async function fetchExternalData(supplementsLinks) {

    let handleError = function() {
        return new Response(JSON.stringify({
            code: 400,
            message: "fetch-error"
        }));
    };

    // fetch external data:
    for (let i = 0; i < supplementsLinks.length; ++i) {
        let apiRefUrl = supplementsLinks[i]["apiUrl"];
        let response = await fetch(apiRefUrl, {
            headers:{
                accept: 'application/json'
            }
        }).catch(handleError);

        let result;
        if(response.status === 200) {
            result = await response.json();
            // check results:
            if(result["code"] === 400 || result["code"] === 300) {
                supplementsLinks[i]["result"] = false;
            }
            else {
                supplementsLinks[i]["result"] = result;
            }
            // display fetch progress state in fetch-state-bar:
            let querySelector = "#fetch-state-" + supplementsLinks[i]["apiSource"];
            let fetchState = "Fetching data from: " + apiRefUrl;
            document.querySelector(querySelector).innerText = fetchState;
        }
        else {supplementsLinks[i]["result"] = false;}
    }

    // render external data:
    renderExternalData(supplementsLinks);
}

/**
 * render fetched results of external (supplement) data
 * @param {array} supplementsLinks: array enriched with urlProperties and 
 * fetched results
 * @returns {void} the results are handled over to function for parsing
 * and display
 */
function renderExternalData(supplementsLinks) {

    let result;
    let values = {};

    // process each supplement link:
    for (let i = 0; i < supplementsLinks.length; ++i) {
        values["refText"] = supplementsLinks[i]["refText"].trim();
        values["refAnchorId"] = supplementsLinks[i]["refAnchorId"];
        values["apiUrl"] = supplementsLinks[i]["apiUrl"];
        values["url"] = supplementsLinks[i]["url"];
 
        // check result:
        result = supplementsLinks[i]["result"];
        values["hasResult"] = (result) ? true : false;

        // parse results:
        switch (true) {
            case (/gazetteer/.test(supplementsLinks[i]["apiSource"])):
                values["parsed"] = parseGazetteerData(result);
                displayGazetteerData(values);
                break;
            case (/arachne/.test(supplementsLinks[i]["apiSource"])):
                values["parsed"] = parseArachneData(result);
                displayArachneData(values);
                break;
            case (/field/.test(supplementsLinks[i]["apiSource"])):
                values["parsed"] = parseFieldData(result);
                displayFieldData(values);
                break;
        }
    }
}

/**
 * parse data from iDAI.gazetteer (location data)
 * @param {array} data: results fetched from apiSource
 * @returns {json} json storing the parsed result (e.g. prefName,
 * location data)
 */
function parseGazetteerData(data) {

    return {
        "provenance": (data.provenance !== undefined) ? data.provenance: false,
        "location": (data.prefLocation !== undefined) ? data.prefLocation: false,
        "prefName": (data.prefName !== undefined) ? data.prefName: false,
        "gazId":  (data.gazId !== undefined) ? data.gazId: false,
        "url": (data["@id"] !== undefined) ? data["@id"] : false
    };
}

/**
 * parse supplementary data from iDAI.objects (arachne)
 * @param {array} data: results fetched from apiSource
 * @returns {json} json storing the parsed result (e.g. title,
 * images)
 */
function parseArachneData(data) {

    return {
        "type": (data.type !== undefined) ? data.type : false,
        "title": (data.title !== undefined) ? data.title : false,
        "subtitle": (data.subtitle !== undefined) ? data.subtitle : false,
        "images": ( data.images !== undefined) ? data.images : false,
        "url": (data["@id"] !== undefined) ? data["@id"] : false
    };
}

/**
 * parse supplementary data from iDAI.field
 * @param {array} data: results fetched from apiSource
 * @returns {json} json storing the parsed result (e.g. description,
 * imageSource)
 */
function parseFieldData(data) {

    // parse descriptionObject (has language key)
    let shortDescription = (data.resource.shortDescription !== undefined) ? data.resource.shortDescription : false;
    if(shortDescription[Object.keys(shortDescription)[0]] !== undefined) {
        shortDescription = shortDescription[Object.keys(shortDescription)[0]];
    }
    let group = data.resource.groups.find(group => group.fields.map(field => field.name).includes('isDepictedIn'));
    let targets = group ? group.fields.find(field => field.name === 'isDepictedIn').targets : false;

    let imageSource = false;
    if(targets) {
        // extract first image of resource
        let categoryName = targets[0].resource.category.name;
        if(categoryName == "Photo" || categoryName == "Drawing") {
            let primaryImageId = targets[0].resource.id;
            let imageApiUrl = "https://field.idai.world/api/images/" + data.project + "/" + primaryImageId + ".jp2";
            let imageSpecs = "/x/full/!500,500/0/default.jpg"; // watch out: https://iiif.io/api/image/2.0/
            imageSource = imageApiUrl + imageSpecs;
        }
    }

    return {
        "project": data.project,
        "shortDescription": shortDescription,
        "imageSource": imageSource
    };
}

/**
 * display of parsed location data from iDAI.gazetteer
 * @param {array} values: parsed (gazetteer) data
 * @returns {void} elements containing data are added
 * to the document as externalObject (html elements)
 */
function displayGazetteerData(values) {

    let externalObject = createExternalObjectElement("gazetteer");
    let objectName = externalObject.querySelector(".object-name");
    let objectData = externalObject.querySelector(".object-data");
    let objectVisualization = externalObject.querySelector(".object-visualization");
    let dataSourceLink = externalObject.querySelector(".data-source-link"); 

    // enrich elements with parsed data values:
    if(values["hasResult"]) {
        let data = values["parsed"];

        if(values.refText) {
            objectName.innerText = values.refText;
        }
        if(data.prefName.title !== undefined) {
            objectData.innerText = data.prefName.title;
        }
        if(data.url) {
            dataSourceLink.innerText = data.url;
            dataSourceLink.href = data.url;
        }
        if(values["refAnchorId"]) {
            objectVisualization.id = "target-gazetteer-" + values["refAnchorId"];
        }

        // create map:
        let map = document.createElement("div");
        map.id = "map-" + values["refAnchorId"];
        map.classList.add("map");

        // assign coordinates:
        if(values["parsed"].location) {
            if(values["parsed"].location.coordinates) {
                coords = values["parsed"].location.coordinates;
                map.setAttribute("longitude" , coords[0]);
                map.setAttribute("latitude" , coords[1]);
            }
            else {
                console.warn("Notice for editors: " + 
                "place has shape-coordinates only", values["parsed"])
            }
        }
        objectVisualization.appendChild(map);
    }
    else {
        objectName.classList.add("warning-text");
        objectData.classList.add("warning-box");
        objectName.innerText = "'" + values.refText + "' could not be fetched!";
        objectData.innerText = "Checkout url of xlink:href: " + values["apiUrl"];
    }

    // append elements to #locations
    document.querySelector('#locations').appendChild(externalObject);
}

/**
 * display of parsed supplementary data from iDAI.objects (arachne)
 * @param {array} values: parsed (arachne) data
 * @returns {void} elements containing data are added
 * to the document as externalObject (html elements)
 */
function displayArachneData(values) {

    let externalObject = createExternalObjectElement("arachne");
    let objectName = externalObject.querySelector(".object-name");
    let objectData = externalObject.querySelector(".object-data");
    let objectVisualization = externalObject.querySelector(".object-visualization");
    let dataSourceLink = externalObject.querySelector(".data-source-link");

    if(values["hasResult"]) {
        let data = values["parsed"];
        if(values.refText) {
            objectName.innerText = values.refText;
        }
        if(data.title) {
            objectData.innerText = data.title;
            if(data.subtitle) {
                objectData.innerText += ", " + data.subtitle;
            }
            if(data.type) {
                objectData.innerText += ", [" + data.type + "]";
            }
        }
        if(data.url) {
            dataSourceLink.innerText = data.url;
            dataSourceLink.href = data.url;
        }

        if(values["refAnchorId"]) {
            objectVisualization.id = "target-arachne-" + values["refAnchorId"];
        }
        // create object-image
        if (data.images && data.images.length) {
            let url = "https://arachne.dainst.org/data/image/" + data.images[0].imageId;
            createExternalObjectImage(url, objectVisualization);
        }
        // link to arachne for displaying 3D models:
        else if(data.type === "3D-Modelle") {
            objectVisualization.innerText = "[Follow the link to arachne.dainst.org to view the 3D-model]";
        }
        // no visualizations available
        else {
            objectVisualization.innerText = "[No images available]";
        }
    }
    else {
        objectName.classList.add("warning-text", "warning-box");
        objectName.innerText = "'" + values.refText + "' could not be fetched!";
        objectData.innerText = "Checkout url of xlink:href: " + values["apiUrl"];
    }

    // append elements to #archne:
    document.querySelector('#arachne').append(externalObject);
}

/**
 * display of parsed supplementary data from iDAI.field
 * @param {array} values: parsed (field) data
 * @returns {void} elements containing data are added
 * to the document as externalObject (html elements)
 */
function displayFieldData(values) {

    let externalObject = createExternalObjectElement("field");
    let objectName = externalObject.querySelector(".object-name");
    let objectData = externalObject.querySelector(".object-data");
    let objectVisualization = externalObject.querySelector(".object-visualization");
    let dataSourceLink = externalObject.querySelector(".data-source-link");

    if(values["hasResult"]) {
        let data = values["parsed"];
        if(values.refText) {
            objectName.innerText = values.refText;
        }
        if(data.shortDescription) {
            objectData.innerText = data.shortDescription;
        }
        if(values["url"]) {
            dataSourceLink.innerText = values["url"];
            dataSourceLink.href = values["url"];
        }
        if(values["refAnchorId"]) {
            objectVisualization.id = "target-field-" + values["refAnchorId"];
        }
        // create object-image
        if (data.imageSource) {
            let url = data.imageSource;
            createExternalObjectImage(url, objectVisualization);
        }
        else {
            objectVisualization.innerText = "[No images available]";
        }
    }
    else {
        objectName.classList.add("warning-text");
        objectData.classList.add("warning-box");
        objectName.innerText = "'" + values.refText + "' could not be fetched!";
        objectData.innerText = "Checkout url of xlink:href: " + values["apiUrl"];
    }

    // append elements to #objects:
    document.querySelector('#field').append(externalObject);
}

/**
 * create elements for external data (supplements)
 * @param {String} source: short name of the source system, 
 * e.g. field, arachne, used as className for each externalObject
 * @returns {HTMLElement} externalObject, <details>-element with
 * multiple childs (e.g. object-visualization)
 */
function createExternalObjectElement(source) {

    // details-element for html-native open/close option
    let externalObject = document.createElement("details");
    externalObject.classList.add("external-object");
    externalObject.classList.add(source);

    // summary to display the (data) object name
    let objectName = document.createElement("summary");
    objectName.classList.add("object-name");

    // wrapper div to add specific object data
    let objectData = document.createElement("div");
    objectData.classList.add("object-data");
    
    // wrapper div to add images and other other visualizations
    let objectVisualization = document.createElement("div");
    objectVisualization.classList.add("object-visualization");
    
    // wrapper div to add data source url
    let dataSourceInfo = document.createElement("div");
    dataSourceInfo.classList.add("data-source-info");
    let sourceLink = document.createElement("a");
    sourceLink.classList.add("data-source-link");
    sourceLink.target = "_blank";
    dataSourceInfo.appendChild(sourceLink);

    // add all childs
    externalObject.appendChild(objectName);
    externalObject.appendChild(objectData);
    externalObject.appendChild(dataSourceInfo);
    externalObject.appendChild(objectVisualization);

    // remove fetchStateBar:
    document.querySelector("#fetch-state-" + source).style.display = "none";

    return(externalObject);
}

/**
 * async: read external image data and create img-element
 * @param {String} url: image url of the source system
 * @param {HTMLElement} objectVisualization: div as child of
 * externalObjectElement
 * @returns {void} reads image data as dataUrl (base64-format) 
 * and appends it to the objectVisualization container
 */
async function createExternalObjectImage(url, objectVisualization) {

    let objectImage = document.createElement("img");
    objectImage.classList.add("object-image");
    objectImage.loading = "lazy";
    objectImage.setAttribute("data-zoomable", true);
    objectImage.setAttribute("onerror", 
        "this.onerror=null;this.parentElement.innerText='[Could not load image!]'");
    
    let base64data;
    fetch(url, {method: 'GET'})
    .then((response) => response.blob())
    .then((blob) => {
        let reader = new FileReader();
        reader.readAsDataURL(blob); 
        reader.onloadend = function() {
            base64data = reader.result;                
            objectImage.src = base64data;
            objectImage.onload = function () {
                scaleImage(objectImage);
            };
            objectVisualization.appendChild(objectImage);
        }
    })
}







