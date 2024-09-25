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

        // create title header
        let titlePage = createTitleHeader(contentBody);

        // create abstract sections:
        let abstractSection = getAbstractSection(contentBody);

        // create panelContents always by default:
        const panelContents = createPanel("contents", false);
        navigationPanelsDocument.push("contents");
    
        // add posterImage to panelContents:
        let posterImage = contentBody.querySelector("#poster-image");
        if (posterImage) {
            posterImage.classList.add("cover-image");
            panelContents.appendChild(posterImage);
        }

        // add tocList to panelContents:
        let tocList = createToCByHeadlines(contentBody);
        panelContents.appendChild(tocList);
        additionalResourcesWrapper.appendChild(panelContents);

        // panel figures:
        let figureSection = contentBody.querySelectorAll(".figure-section")[0];
        if (figureSection) {
            let panel = createPanel("figures", figureSection);
            additionalResourcesWrapper.appendChild(panel);
            navigationPanelsDocument.push("figures");
        }
        // panel references:
        let referenceSection = contentBody.querySelectorAll(".reference-section")[0]
        if(referenceSection) {
            let panel = createPanel("references", referenceSection);
            additionalResourcesWrapper.appendChild(panel);
            navigationPanelsDocument.push("references");
        }

        // panel footnotes:
        let footnoteSection = contentBody.querySelectorAll(".footnotes-section")[0];
        if(footnoteSection) {
            let panel = createPanel("notes", footnoteSection);
            additionalResourcesWrapper.appendChild(panel);
            navigationPanelsDocument.push("notes");
        }

        // extract supplement links (objects and locations):
        let supplementLinksCollection = extractSupplementLinks();
       
        // panel locations:
        if(supplementLinksCollection["locations"].length) {
            let panel = createPanel("locations", false);
            fetchExternalData(supplementLinksCollection["locations"]);
            additionalResourcesWrapper.appendChild(panel);
            navigationPanelsDocument.push("locations");
        }

        // panel supplement data:       
        if(supplementLinksCollection["objects"].length) {
            const supplementSection = document.createElement("div");
            supplementSection.id = "supplement-section";
            fetchExternalData(supplementLinksCollection["objects"]);

            let panel = createPanel("objects", supplementSection);
            additionalResourcesWrapper.appendChild(panel);
            navigationPanelsDocument.push("objects");
        }

        // hide <front>
        contentBody.querySelector(".front").style.display = "none";
     
        // add content to textContentWrapper
        textContentWrapper.append(titlePage);
        textContentWrapper.append(contentBody);
        textContentWrapper.append(abstractSection);
        
        // add wrapper to document-body:
        mainWrapper.appendChild(textContentWrapper);
        mainWrapper.appendChild(additionalResourcesWrapper);
        document.body.appendChild(navHeader);
        document.body.appendChild(mainWrapper);
        addPanelNavigationTonavHeader(navigationPanelsDocument);

        // define image rendering:
        document.querySelectorAll('img').forEach(function(img){
            img.onerror = function(){this.style.display='none';}; 
            img.setAttribute("loading", "lazy");
        });

        document.head.appendChild(stylesCssLink);
        document.body.classList.add("fade-in");

        showSelectedPanel("locations"); // fix: needs preload!
        focusTargetsOnHoverReferences();
        checkQualityOfUrls();

        console.log(document.documentElement);
    }
});

/* FUNCTIONS
--------------*/
function createPanel(panelName, content = false) {

    let panel = document.createElement("div");
    panel.classList.add("panel", "resource-view", "hidden");
    panel.id = panelName;
    if(content) {
        panel.appendChild(content);
    }
    let title = panel.querySelector(".title");
    if(title !== null) {
        title.remove();
    }
    return(panel);
}

function addPanelNavigationTonavHeader(navigationPanelsDocument) {
    
    if(navigationPanelsDocument.length > 0) {
        let contextToggles = document.createElement("nav");
        contextToggles.classList.add("context-toggles");
        let uList = document.createElement("ul");

        navigationPanelsDocument.forEach((panelName) => { 
            let li = document.createElement("li");
            let a = document.createElement("a");
            a.classList.add("panel-anchors");
            a.id = "a-" + panelName;
            a.innerHTML = panelName;
            a.addEventListener("click", function() {
                showSelectedPanel(panelName);
            });
            li.appendChild(a);
            uList.appendChild(li);
        });
        contextToggles.appendChild(uList);
        navHeader.appendChild(contextToggles);
    }
}

function createTitleHeader(contentBody) {

    // get title page information:
    let title = contentBody.querySelector(".article-title");
    let subtitle = contentBody.querySelector(".subtitle");
    let authors = contentBody.querySelectorAll(".contrib[contrib-type='author']");
    let contributors = contentBody.querySelectorAll(".contrib[contrib-type='co-author']");

    // transform author information to String:
    let authorsCollection = [];
    for (let i = 0; i < authors.length; i++) {
        let givenName = authors[i].querySelector(".given-names").textContent;
        let surName = authors[i].querySelector(".surname").textContent;
        authorsCollection.push(givenName + " " + surName);
    }

    // transform contributors information to String:
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
    contributorsElement.innerHTML = (contributorsCollection.length) ? contributorsCollection.join(", ") : "";

    // append elements to titlePage:
    titlePage.append(authorsElement);
    titlePage.append(titleElement);
    titlePage.append(subtitleElement);
    titlePage.append(contributorsElement);

    return (titlePage);
}

function getAbstractSection(contentBody) {

    let abstractSection = document.createElement("div");
    abstractSection.id = "abstracts-section";

    let abstracts = contentBody.querySelectorAll(".abstract, .trans-abstract,.kwd-group");
    if(abstracts.length) {
        abstracts.forEach(function(abstract) {
            if(abstract) {
                abstractSection.appendChild(abstract);
            }
        });
    }
    return(abstractSection);
}

function createToCByHeadlines(contentBody) {

    let headlines = contentBody.querySelectorAll(".title");
    let tocList = document.createElement("ul");
    tocList.classList.add("toc-list");

    if (headlines && headlines.length > 0) {
        for (let i = 0; i < headlines.length; ++i) {
            // define headline level by classList:
            let level;
            if(/.main-title/.test(headlines[i].classList)) {
                level = 1;
            }
            if(/.section-title/.test(headlines[i].classList)) {
                level = 2;
            }
            if(/.subsection-title/.test(headlines[i].classList)) {
                level = 3;
            }

            // create tocList items and anchors:
            let tocListItem = document.createElement("li");
            tocListItem.classList.add("heading-ref", "level-" + level);
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
        if(selectedPanel && panel !== null) {
            if(panelName === selectedPanel) {
                panelAnchor.classList.add("active");
                panel.classList.replace("hidden", "active");
            }
            else {
                panelAnchor.classList.remove("active");
                panel.classList.replace("active", "hidden");
            }
        };
    });
}

function focusTargetsOnHoverReferences() {

    const options = {
        threshold: 1,
    };

    const observer = new IntersectionObserver(references => {
        references.forEach(reference => {
            // get target reference:
            let targetRefId = reference.target.getAttribute("href");
            if (reference.intersectionRatio > 0) { 
                // query target:         
                let target = document.querySelector(targetRefId);
                // handle target:
                if(target !== null) {
                    target.classList.toggle('active');
                    target.classList.toggle('fade-in');
                    target.scrollIntoView({
                        behavior: "auto",
                        block: "center"
                    });

                    // avoid scrolling underneath the nav-header:
                    let scrolledY = window.scrollY;
                    if(scrolledY) {window.scroll(0, window.scrollY - "6vh");}
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
                };

                // filter links by apiSource:
                if(/gazetteer/.test(apiRefUrl.apiSource)) {
                    supplementLinksCollection["locations"].push(urlProperties);
                }
                else {
                    supplementLinksCollection["objects"].push(urlProperties);
                }   
            }
            // set #target-id as href-attribute to anchor: 
            anchors[i].href = "#target-" + refAnchorId;
        }
    }
    return(supplementLinksCollection);
}

function getApiRefUrl(url) {

    let apiRefUrl = {};
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
        case (/field.idai.world\/document/.test(url.hostname)):
            apiRefUrl.apiUrl = "Folgt";
            apiRefUrl.apiSource = "field";
            break;
    }
    return(apiRefUrl);
}

async function fetchExternalData(supplementsLinks) {

    let handleError = function(error) {
        return new Response(JSON.stringify({
            code: 400,
            message: error
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

        if (response.status === 200) {
            let result = await response.json();
            supplementsLinks[i]["result"] = result;
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
    let source;
    let refAnchorId;
    let values = {};

    for (let i = 0; i < supplementsLinks.length; ++i) {
        result = supplementsLinks[i]["result"];
        refAnchorId = supplementsLinks[i]["refAnchorId"];
        source = supplementsLinks[i]["apiSource"];

        if(result) {      
            values["available"] = true;
            values["refAnchorId"] = refAnchorId;

            switch (true) {
                case (/gazetteer/.test(source)):
                    values["parsed"] = parseGazetteerData(result);
                    displayGazetteerData(values);
                    break;

                case (/arachne/.test(source)):
                    values["parsed"] = parseArachneData(result);
                    displayArachneData(values);
                    break;
            }
        }
    }
}

function parseGazetteerData(data) {
    return {
        "provenance": data.provenance,
        "location": data.prefLocation,
        "prefName": data.prefName,
        "gazId": data.gazId,
        "url": data["@id"]
    };
}

function parseArachneData(data) {
    return {
        "title": data.title,
        "subtitle": data.subtitle,
        "images": data.images
    };
}

function displayGazetteerData(values) {

    let additionalDataElement = document.createElement("div");
    additionalDataElement.classList.add("additional-elements");
    document.querySelector('#locations').append(additionalDataElement);

    let prefName = document.createElement("p");
    prefName.classList.add("object-name");

    let map = document.createElement("div");
    map.style.height = "300px";
    map.style.background = "gray";

    let dataSourceInfo = document.createElement("div");
    dataSourceInfo.classList.add("data-source-info");
    dataSourceInfo.innerText = "Data source: ";
    let sourceLink = document.createElement("a");
    sourceLink.classList.add("data-source-link");
    sourceLink.target = "_blank";
    dataSourceInfo.appendChild(sourceLink);
  
    if(values["parsed"]) {
        let data = values["parsed"];
        if(data.prefName.title !== undefined) {
            prefName.innerText = data.prefName.title;
        }
        if(values["refAnchorId"]) {
            map.id = "target-" + values["refAnchorId"];
        }
        if(data.url) {
            sourceLink.innerText = data.url,
            sourceLink.href = data.url;
        }
    } 
 
    // append elements to #locations
    additionalDataElement.appendChild(prefName);
    additionalDataElement.appendChild(map);
    additionalDataElement.appendChild(dataSourceInfo);
    document.querySelector('#locations').appendChild(additionalDataElement);

    // init each map (appended to #locations-panel before):
    if(values["parsed"] && values["refAnchorId"]) {
        if(values["parsed"].location && values["parsed"].location.coordinates.length) {
            let coords = values["parsed"].location.coordinates;
            let mapId = "target-" + values["refAnchorId"];
            initMap(mapId, coords);
        }
    }
}

function displayArachneData(values) {

    let supplementElement = document.createElement("details");
    supplementElement.classList.add("supplement-element");

    let supplementTitle = document.createElement("summary");
    let supplementImage = document.createElement("img");
    supplementImage.classList.add("supplement-image");
    supplementImage.loading = "lazy";

    if(values["parsed"]) {
        let data = values["parsed"];

        if(data.title) {
            supplementTitle.innerText = data.title;
            supplementElement.appendChild(supplementTitle);
        }
        if (data.images && data.images.length) {
            supplementImage.src = "https://arachne.dainst.org/data/image/" + data.images[0].imageId;
            supplementElement.appendChild(supplementImage);
        }
        if (values.subtitle) {
          
        }
    }
    else {
        supplementTitle.innerText = "Data could not be fetched. Checkout source-link!";
        supplementElement.appendChild(supplementTitle);
    }

    document.querySelector('#supplement-section').append(supplementElement);
}

function initMap(mapId, coordinates) {

    // set tile layers:
    let mapLayer = L.tileLayer.wms("https://tile.openstreetmap.de/{z}/{x}/{y}.png", {
        tiled: true,
        format: "image/jpeg",
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });
    // define locations:
    let location = {lat: coordinates[1], lng: coordinates[0]};
    
    // instantiate map:
    map = L.map(document.querySelector("#" + mapId), {
        zoom: 8,
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
    L.marker(location).addTo(map);   // add a marker to location
}







