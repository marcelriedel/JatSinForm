/** ---------------------
* CONSTANTS
-------------------------*/
const autoscroll = true;

/* ------------------------
Define Application Scripts:
---------------------------*/
const stylesCssLink = document.createElement('link');
stylesCssLink.href = 'src/css/viewer-styles.css';
stylesCssLink.type = 'text/css';
stylesCssLink.rel = 'stylesheet';

/* -------------------------
Create Main Viewer Elements:
----------------------------*/
const mainWrapper = document.createElement("div");
mainWrapper.id = "main-wrapper";

const textContentWrapper = document.createElement("div");
textContentWrapper.id = "text-content-wrapper";
textContentWrapper.classList.add("column");

const additionalResourcesWrapper = document.createElement("div");
additionalResourcesWrapper.id = "additional-resources-wrapper";
additionalResourcesWrapper.classList.add("column");

const navHeader = document.createElement("div");
navHeader.id = "nav-header";
const navigationPanelsDocument = [];

/** --------------------------------------
 * document state event listener:
 * @type {document}
 * @type {EventListenerObject}
 --------------------------------------*/
 document.addEventListener("readystatechange", (event) => {

    if (event.target.readyState === "complete") {

        // get content-body
        let contentBody = document.querySelectorAll(".content-body")[0];

        // create additional document elements:
        let doiElement = createDoiElement();
        let titlePage = createTitleHeader(contentBody);
        let abstractSection = getAbstractSection(contentBody);

        // create content panel (ToC):
        const panelContents = createPanel("contents", false);
        navigationPanelsDocument.push("contents");
        let posterImage = contentBody.querySelector("#poster-image");
        if (posterImage) {
            posterImage.classList.add("cover-image");
            panelContents.appendChild(posterImage);
        }

        // create all content panels:
        createContentPanels(contentBody);

        // hide <front>
        contentBody.querySelector(".front").style.display = "none";
     
        // add content to textContentWrapper
        textContentWrapper.append(doiElement);
        textContentWrapper.append(titlePage);
        textContentWrapper.append(contentBody);
        textContentWrapper.append(abstractSection);
  
        // add wrapper to document-body:
        mainWrapper.appendChild(textContentWrapper);
        mainWrapper.appendChild(additionalResourcesWrapper);
        document.body.appendChild(navHeader);
        document.body.appendChild(mainWrapper);
        addPanelNavigationToNavHeader(navigationPanelsDocument);

        // create ToC-list and add to panel contents
        let tocList = createToCByHeadlines();
        panelContents.appendChild(tocList);
        additionalResourcesWrapper.appendChild(panelContents);

        // define image rendering:
        document.querySelectorAll('img').forEach(function(img){
            img.onerror = function(){this.style.display='none';};
            img.setAttribute("loading", "lazy");
            img.setAttribute("data-zoomable", true);

            /*
            let zoomistContainer = document.createElement("div");
            zoomistContainer.classList.add("zoomist-container");
            let zoomistWrapper = document.createElement("div");
            zoomistWrapper.classList.add("zoomist-wrapper");
            let zoomistImage = document.createElement("div");
            zoomistImage.classList.add("zoomist-image");
            zoomistWrapper.appendChild(zoomistImage);
            zoomistContainer.appendChild(zoomistWrapper);
            img.parentElement.appendChild(zoomistContainer);
            zoomistImage.appendChild(img);
            */

        });

        // add styles and fade-in
        document.head.appendChild(stylesCssLink);
        document.body.classList.add("fade-in");

        // init js-functions:
        focusTargetsOnHoverReferences();
        showPanelOfAnchorTarget();
        checkQualityOfUrls();
        mediumZoom('[data-zoomable]', {background: 'rgb(65 65 65)'});
        enhanceDocumentInfosTable();
        // default tab:
        showSelectedPanel("contents");

        /* can i query the image itself ?*/
        let zoomistElement = document.querySelector('.medium-zoom-overlay');
        new Zoomist(zoomistElement);
    }
});

/* FUNCTIONS
--------------*/

function createTitleHeader(contentBody) {

    // get title page information:
    let title = contentBody.querySelector(".article-title");
    let subtitle = contentBody.querySelector(".subtitle");
    let authors = contentBody.querySelectorAll(".contrib[contrib-type='author']");
    let contributors = contentBody.querySelectorAll(".contrib[contrib-type='co-author']");

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

    // create titlePage elements:
    let titlePage = document.createElement("div");
    titlePage.className = "page-header";

    let titleElement = document.createElement("h1");
    titleElement.className = "page-title";
   
    let subtitleElement = document.createElement("h1");
    subtitleElement.className = "page-subtitle";

    let authorsElement = document.createElement("h1");
    authorsElement.className = "page-authors";

    let contributorsElement = document.createElement("p");
    contributorsElement.className = "page-contributors";

    // fill titlePage elements with content:
    titleElement.innerHTML = (title) ? title.textContent : "[Kein Titel]";
    subtitleElement.innerHTML = (subtitle) ? subtitle.textContent : "";
    authorsElement.innerHTML = (authorsCollection.length) ? authorsCollection.join(", ") : "[Keine Autoren]";
    let lang = document.documentElement.lang;
    if(contributorsCollection.length && document.documentElement.lang) {
        contributorsElement.innerHTML = contributorsPrepositions[lang] + " " + contributorsCollection.join(", ");
    }

    // append elements to titlePage:
    titlePage.append(titleElement);
    titlePage.append(subtitleElement);
    titlePage.append(authorsElement);
    titlePage.append(contributorsElement);

    return (titlePage);
}

function createDoiElement() {
    let documentId = getDocumentStateProperty("documentId");
    let doi = (documentId) ? documentId : "no-doi-assigned";
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

function getAbstractSection(contentBody) {

    let abstractSection = document.createElement("div");
    abstractSection.id = "abstracts-section";
    
    let abstracts = contentBody.querySelectorAll(".abstract, .trans-abstract");
    if(abstracts.length) {
        abstracts.forEach(function(abstract) {
            let lang;
            let abstractTitle;
            let abstractText;
            if(abstract) {
                lang = abstract.getAttribute("lang");
                abstractTitle = abstract.querySelector(".title");
                abstractText = abstract.querySelector(".abstract-text");
                if(abstractText !== null && abstractTitle !== null) {
                    abstractTitle.setAttribute("lang", lang);
                    abstractText.setAttribute("lang", lang);
                    abstractSection.appendChild(abstractTitle);
                    abstractSection.appendChild(abstractText);
                }
            }
        });
    }
    return(abstractSection);
}

function createContentPanels(contentBody) {

    // extract supplement links (objects and locations):
    let supplementLinksCollection = extractSupplementLinks();
     
    // create panel figures:
    let figureSection = contentBody.querySelectorAll(".figure-section")[0];
    if (figureSection) {
        let panel = createPanel("figures", false, figureSection);
        additionalResourcesWrapper.appendChild(panel);
        navigationPanelsDocument.push("figures");
    }

    // create panel footnotes:
    let footnoteSection = contentBody.querySelectorAll(".footnotes-section")[0];
    if(footnoteSection) {
        let bibRefs = footnoteSection.querySelectorAll("a.bib-ref");
        addTitleOfResourcesToBibRefTitle(bibRefs);

        let panel = createPanel("notes", false, footnoteSection);
        additionalResourcesWrapper.appendChild(panel);
        navigationPanelsDocument.push("notes");
    }

    // create panel references:
    let referenceSection = contentBody.querySelectorAll(".reference-section")[0]
    if(referenceSection) {
        let panel = createPanel("references", false, referenceSection);
        additionalResourcesWrapper.appendChild(panel);
        navigationPanelsDocument.push("references");
    }

    // create panel locations:
    if(supplementLinksCollection["locations"].length) {
        let panel = createPanel("locations", "Locations", false);
        fetchExternalData(supplementLinksCollection["locations"]);
        additionalResourcesWrapper.appendChild(panel);
        navigationPanelsDocument.push("locations");
    }

    // create panel objects:       
    if(supplementLinksCollection["objects"].length) {
        let panel = createPanel("objects", "Objects", false);
        fetchExternalData(supplementLinksCollection["objects"]);
        additionalResourcesWrapper.appendChild(panel);
        navigationPanelsDocument.push("objects");
    }

    // create panel information:
    let information = true;
    if(information) {
        const informationSection = document.createElement("div");
        informationSection.id = "information-section"; 
        let infos = document.createElement("table");
        infos.id = "infos";
       
        let panel = createPanel("information", "Information", infos);
        additionalResourcesWrapper.appendChild(panel);
        navigationPanelsDocument.push("information");
    }
}

function enhanceDocumentInfosTable() {

    let paragraphs = document.querySelectorAll(".content-paragraph");
    let sections = document.querySelectorAll("section");
    let figures = document.querySelectorAll("figure");
    let notes = document.querySelectorAll(".footnote");
    let references = document.querySelectorAll(".reference");
    let data = document.querySelectorAll(".data-element");
    let locations = document.querySelectorAll(".location");

    let infos = document.querySelector("#infos");
    let tableData =
    "<tr><td>Paragraphs:</td><td>" + paragraphs.length + "</td></tr>" +
    "<tr><td>Sections:</td><td>" + sections.length + "</td></tr>" +
    "<tr><td>Figures:</td><td>" + figures.length + "</td></tr>" +
    "<tr><td>Notes:</td><td>" + notes.length + "</td></tr>" +
    "<tr><td>References:</td><td>" + references.length + "</td></tr>" +
    "<tr><td>Objects:</td><td>" + data.length + "</td></tr>" +
    "<tr><td>Locations:</td><td>"+ locations.length + "</td></tr>";
    infos.innerHTML = tableData;
}

function addTitleOfResourcesToBibRefTitle(bibRefs) {
  
    bibRefs.forEach(function(bibRef){
        let refTarget;
        let target;
        if(bibRef.href !== null && bibRef.href) {
            refTarget = bibRef.getAttribute("href");
            target = document.querySelector(refTarget);
            let bibTitle;
            if(target !== null) {
                bibTitle = target.querySelector("p");
                if(bibTitle !== null && bibTitle.textContent) {
                    bibTitle = bibTitle.textContent.trim();
                    bibTitle = bibTitle.replace(/[\n\r]+|[\s]{2,}/g, ' ');
                } else ( bibTitle = "No title found");
                bibRef.title = bibTitle;
            }
        }
    });
}

function createPanel(panelName, defaultTitle = false, content = false) {

    // create panel element:
    let panel = document.createElement("div");
    panel.classList.add("panel", "resource-view", "hidden");
    panel.id = panelName;
  
    // add panel conent
    if(content) {panel.appendChild(content);}

    // add panel title:
    if(panelName !== "contents") {
        let title = panel.querySelector(".title");
        if(title === null) {
            title = document.createElement("h3");
            title.textContent = (defaultTitle) ? defaultTitle : "[No title]";
            title.classList.add("title", "panel-title");
            panel.insertAdjacentElement("afterbegin", title);
        } else {title.classList.add("panel-title");}
    }
    return(panel);
}

function addPanelNavigationToNavHeader(navigationPanelsDocument) {
   
    if(navigationPanelsDocument.length > 0) {
        let contextToggles = document.createElement("nav");
        contextToggles.classList.add("context-toggles");
        let uList = document.createElement("ul");

        navigationPanelsDocument.forEach((panelName) => { 
            let li = document.createElement("li");
            let a = document.createElement("a");
            a.classList.add("panel-anchors");
            a.id = "a-" + panelName;
            a.innerHTML = navIcons[panelName];
            a.href = "#" + panelName;
            a.setAttribute("onclick", "showSelectedPanel('" + panelName + "')");

            li.appendChild(a);
            uList.appendChild(li);
        });
        contextToggles.appendChild(uList);
        navHeader.appendChild(contextToggles);
    }
}

function createToCByHeadlines() {

    let headlines = document.querySelectorAll(".title");
    let tocList = document.createElement("ul");
    tocList.id = "toc-list";

    if (headlines && headlines.length > 0) {
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

/* ---------------------------
Interactive Document Features:
* ----------------------------*/

function showSelectedPanel(selectedPanel) {

    let panelAnchors = document.querySelectorAll(".panel-anchors");
    panelAnchors.forEach((panelAnchor) => {
        let panelName = panelAnchor.id.slice(2); 
        let panel = document.querySelector("#" + panelName);
        if(selectedPanel !== undefined && panel !== null) {
            if(panelName === selectedPanel) {
                panelAnchor.classList.add("active");
                panel.classList.replace("hidden", "active");
                if(selectedPanel === "locations") {
                    // initMaps during panel-display:
                    setTimeout(initMaps, 500);
                }
            }
            else {
                panelAnchor.classList.remove("active");
                panel.classList.replace("active", "hidden");
            }
        };
    });
}

function showPanelOfAnchorTarget() {

    let targetRef;
    let panelName;
    let anchors = document.querySelectorAll(
        "a.fig-ref,a.bib-ref,a.fn-ref,a[id^='data-ref-']");
    if(anchors !== undefined && anchors.length) {
        anchors.forEach((anchor) => {
            anchor.addEventListener("click", event => {
                targetRef = anchor.getAttribute("href");
                if(/#f-/.test(targetRef)) {
                    panelName = "figures";
                }
                if(/#fn-/.test(targetRef)) {
                    panelName = "notes";
                }
                if(/#ref-/.test(targetRef)) {
                     panelName = "references";
                }
                if(/#target-locations/.test(targetRef)) {
                    panelName = "locations";
                }
                if(/#target-objects/.test(targetRef)) {
                    panelName = "objects";
                }
                
                showSelectedPanel(panelName);
            });
        });
    }
}

function focusTargetsOnHoverReferences() {

    const options = {
        threshold: 1,
    };

    const observer = new IntersectionObserver(references => {
        references.forEach(reference => {
            // get target reference:
            let targetRefId = reference.target.getAttribute("href");
            // query target:         
            let target = document.querySelector(targetRefId);
            // reference comes into viewport (at bottom)
            if (reference.isIntersecting) { 
                 // handle target:
                 if(target !== null) {
                     target.classList.toggle('active');
                     target.scrollIntoView({
                         behavior: "auto",
                         block: "center"
                     });
                 }
            } 
            // element leaves the viewport (at top)
            else {
                if(target !== null) {
                    target.classList.remove('active');
                }
            }
        }, options);
    });

    // track all referencing elements:
    document.querySelectorAll(".title, a.fig-ref,a.bib-ref,a.fn-ref,a[id^='data-ref-']")
        .forEach((element) => {
            observer.observe(element);
    });
}

function extractSupplementLinks() {

    let selfHost= window.location.host;
    let supplementLinksCollection = {
        "locations": [],
        "objects": []
    };
    let targetPrefix;      

    // query anchors:
    let anchors = document.querySelectorAll(
        // exclude weblinks
        "a.ext-ref:not([data-specific-use = 'weblink'])"); 
        
    // parse anchors:
    for (let i = 0; i < anchors.length; ++i) {
        // exclude empty and internal links
        if(anchors[i].href !== ""
        && anchors[i].host !== selfHost) {
            
            // define id of referencing anchor
            let refAnchorId = "data-ref-" + i + 1;
            anchors[i].id = refAnchorId;
            
            // parse url:
            let url = new URL(anchors[i].href);
            let apiRefUrl = getApiRefUrl(url);
            
            if(apiRefUrl) {
                // define url properties
                let urlProperties = {
                    'url': url,
                    'apiUrl': apiRefUrl.apiUrl,
                    'apiSource': apiRefUrl.apiSource,
                    'refAnchorId': refAnchorId,
                    "refText": anchors[i].textContent
                };

                // filter links by apiSource:
                if(/gazetteer/.test(apiRefUrl.apiSource)) {
                    targetPrefix = "locations";
                    supplementLinksCollection["locations"].push(urlProperties);
                }
                if(/arachne/.test(apiRefUrl.apiSource)) {
                    targetPrefix = "objects";
                    supplementLinksCollection["objects"].push(urlProperties);
                }
                /* Zenon-Links? 
                ----------------*/
            }
            // set #target-prefix-id as href-attribute to anchor: 
            anchors[i].href = "#target-" + targetPrefix + "-" + refAnchorId;
        }
    }
    return(supplementLinksCollection);
}

function getApiRefUrl(url) {

    let apiRefUrl = {};
    if(url.protocol !== "https") {url.protocol = "https";}

    switch (true) {
        case (/arachne.dainst.org/.test(url.hostname)):
            apiRefUrl.apiUrl = url.origin + "/data" + url.pathname;
            apiRefUrl.apiSource = "arachne";
            break;
        case (/gazetteer.dainst.org/.test(url.hostname)):
            let placeId = url.pathname.split("/")[2];
            if(placeId !== undefined) {
                apiRefUrl.apiUrl = "https://gazetteer.dainst.org/doc/" + placeId;
                apiRefUrl.apiSource = "gazetteer";
            }
            break;
        /*
        case (/field.idai.world\/document/.test(url.hostname)):
            apiRefUrl.apiUrl = "Folgt";
            apiRefUrl.apiSource = "field";
            break;
        */
    }
    return(apiRefUrl);
}

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

            if(result["code"] !== 400) {
                supplementsLinks[i]["result"] = result;
            }
            else {
                supplementsLinks[i]["result"] = false;
            }
        }
        else {
            supplementsLinks[i]["result"] = false;
        }
    }
    // render external data:
    renderExternalData(supplementsLinks);
}

function renderExternalData(supplementsLinks) {

    let result;
    let values = {};

    // process each supplement link:
    for (let i = 0; i < supplementsLinks.length; ++i) {
        values["refText"] = supplementsLinks[i]["refText"];
        values["refAnchorId"] = supplementsLinks[i]["refAnchorId"];
        values["apiUrl"] = supplementsLinks[i]["apiUrl"];
 
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
        }
    }
    enhanceDocumentInfosTable();
}

function parseArachneData(data) {
    return {
        "title": (data.title !== undefined) ? data.title : false,
        "subtitle": (data.subtitle !== undefined) ? data.subtitle : false,
        "images": ( data.images !== undefined) ? data.images : false,
        "url": (data["@id"] !== undefined) ? data["@id"] : false
    };
}

function parseGazetteerData(data) {
    return {
        "provenance": (data.provenance !== undefined) ? data.provenance: false,
        "location": (data.prefLocation !== undefined) ? data.prefLocation: false,
        "prefName": (data.prefName !== undefined) ? data.prefName: false,
        "gazId":  (data.gazId !== undefined) ? data.gazId: false,
        "url": (data["@id"] !== undefined) ? data["@id"] : false
    };
}

function createExternalObjectElement() {

    let externalObject = document.createElement("details");
    externalObject.classList.add("external-object");

    let objectName = document.createElement("summary");
    objectName.classList.add("object-name");

    let objectData = document.createElement("div");
    objectData.classList.add("object-data");
    
    let objectVisualization = document.createElement("div");
    objectVisualization.classList.add("object-visualization");
    
    let dataSourceInfo = document.createElement("div");
    dataSourceInfo.classList.add("data-source-info");

    let sourceLink = document.createElement("a");
    sourceLink.classList.add("data-source-link");
    sourceLink.target = "_blank";
    dataSourceInfo.appendChild(sourceLink);

    externalObject.appendChild(objectName);
    externalObject.appendChild(objectData);
    externalObject.appendChild(dataSourceInfo);
    externalObject.appendChild(objectVisualization);

    return(externalObject);

}

function displayArachneData(values) {

    let externalObject = createExternalObjectElement(".external-object");
    let objectName = externalObject.querySelector(".object-name");
    let objectData = externalObject.querySelector(".object-data");
    let objectVisualization = externalObject.querySelector(".object-visualization");
    let dataSourceLink = externalObject.querySelector(".data-source-link");

    if(values["hasResult"]) {
        let data = values["parsed"];

        console.log(data);
  
        if(values.refText) {
            objectName.innerText = values.refText;
        }
        if(data.title) {
            objectData.innerText = data.title;
            if(data.subtitle) {
                objectData.innerText += ", " + data.subtitle;
            }
        }
        if(data.url) {
            dataSourceLink.innerText = data.url;
            dataSourceLink.href = data.url;
        }
        if(values["refAnchorId"]) {
            objectVisualization.id = "target-objects-" + values["refAnchorId"];
        }

        // create object-image
        let objectImage = document.createElement("img");
        objectImage.classList.add("object-image");
        objectImage.loading = "lazy";
        objectImage.setAttribute("data-zoomable", true);

        if (data.images && data.images.length) {
            objectImage.src = "https://arachne.dainst.org/data/image/" + data.images[0].imageId;
        }
        else {
            objectVisualization.innerText = "[No images available]";
        }
        objectVisualization.appendChild(objectImage);
    }
    else {
        objectName.classList.add("warning-text");
        objectData.classList.add("warning-box");
        objectName.innerText = "'" + values.refText + "' could not be fetched!";
        objectData.innerText = "Checkout url of xlink:href: " + values["apiUrl"];
    }

    // append elements to #objects:
    document.querySelector('#objects').append(externalObject);
}

function displayGazetteerData(values) {

    let externalObject = createExternalObjectElement(".external-object");
    let objectName = externalObject.querySelector(".object-name");
    let objectData = externalObject.querySelector(".object-data");
    let objectVisualization = externalObject.querySelector(".object-visualization");
    let dataSourceLink = externalObject.querySelector(".data-source-link"); 

    // enrich elements with parsed data values:
    console.log( values["refText"], values["parsed"]);

    /* TO FIX:
    Why Musalla Mezarlığı (values) has values["parsed"] from Attalos-Haus? */

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
            objectVisualization.id = "target-locations-" + values["refAnchorId"];
        }

        // create map:
        let map = document.createElement("div");
        map.id = "map-" + values["refAnchorId"];
        map.classList.add("map");
        if(values["parsed"].location && values["parsed"].location.coordinates.length) {
            coords = values["parsed"].location.coordinates;
            map.setAttribute("longitude" , coords[0]);
            map.setAttribute("latitude" , coords[1]);
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

function initMaps() {

    let maps = document.querySelectorAll(".map");
    maps.forEach(map => {
        let coords = [];
        if(map.getAttribute("longitude") !== null && 
        map.getAttribute("latitude") !== null) {
            coords.push(map.getAttribute("longitude"));
            coords.push(map.getAttribute("latitude"));
        }
        // no coordinates available
        else {
          coords = false;
        }
        createMap(map.id, coords);
    });
}

function createMap(mapId, coordinates) {

    // set tile layers:
    let mapLayer = L.tileLayer.wms("https://tile.openstreetmap.de/{z}/{x}/{y}.png", {
        tiled: true,
        format: "image/jpeg",
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });

    // define map parameter:
    let location = (coordinates) ? {lat: coordinates[1], lng: coordinates[0]} : [0,0];
    let zoom = (coordinates) ? 8 : 1;

    // instantiate map:
    if(!document.querySelector("#" + mapId + " > .leaflet-pane")) {
        map = L.map(document.querySelector("#" + mapId), {
            zoom: zoom,
            doubleClickZoom: false,
            dragging: false,
            zoomSnap: false,
            trackResize: false,
            touchZoom: false,
            scrollWheelZoom: false,
            center: location,
        });
        mapLayer.addTo(map);             // show mapLayer by default
        L.control.scale().addTo(map);    // show dynamic scale (Maßstab)
      
        // add location marker:
        let marker = L.marker(location).addTo(map);
        if(!coordinates) {
            marker.bindPopup("No coordinates available.").openPopup();
        }
    }
}







