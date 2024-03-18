/* config */
let journalStyles = "viewer-styles-AA"; // "viewer-styles-AA";

/* prepare DOM
* -------------*/
const root = document.querySelector(':root');

// create links to css
const StylesCssLink = document.createElement('link');
StylesCssLink.href = 'src/css/' + journalStyles + '.css';
StylesCssLink.type = 'text/css';
StylesCssLink.rel = 'stylesheet';

const LensCssLink = document.createElement('link');
LensCssLink.href = 'src/css/lens.css';
LensCssLink.type = 'text/css';
LensCssLink.rel = 'stylesheet';

const header = document.createElement("header");
header.setAttribute("id", "header");

const topBar = document.createElement("div");
topBar.setAttribute("id", "topBar");
topBar.classList.add("column");
topBar.innerHTML =
    "<div class='topbar-logo'>" +
    "   <img alt='logo' class='topbar-logo-img' src='./../assets/journal-styles/AA_Logo.png'></a>" +
    "</div>";

const menuBar = document.createElement("div");
menuBar.setAttribute("id", "menuBar");
menuBar.classList.add("column");
menuBar.innerHTML = "<div>" +
    "<div class='context-toggles'>" +
    "   <a onclick='toggleMenuBar(panelContents, \"contents\");' title='Contents' class='context-toggle contents active'><i class='fa fa-align-left'></i> Contents</a>" +
    "   <a onclick='toggleMenuBar(panelFigures, \"figures\");' title='Figures' class='context-toggle figures'><i class='fa fa-picture-o'></i> Figures</a>" +
    "   <a onclick='toggleMenuBar(panelSupplements, \"supplements\");' title='Supplements' class='context-toggle supplements'><i class='fa fa-link'></i> Supplements</a>" +
    "   <a onclick='toggleMenuBar(panelMaps, \"maps\");' title='Maps' class='context-toggle maps'><i class='fa fa-link'></i>Maps</a>" +
    "   <a onclick='toggleMenuBar(panelFootnotes, \"footnotes\");' title='Footnotes' class='context-toggle footnotes'><i class='fa fa-link'></i> Footnotes</a>" +
    "   <a onclick='toggleMenuBar(panelReferences, \"references\");' title='References' class='context-toggle references'><i class='fa fa-link'></i> References</a>" +
    "</div>";

const panelContents = document.createElement("div");
panelContents.classList.add("panel");
panelContents.classList.add("contents");
panelContents.classList.add("resource-view");
// panelContents.classList.add("hidden");

const panelSupplements = document.createElement("div");
panelSupplements.classList.add("panel");
panelSupplements.classList.add("supplements");
panelSupplements.classList.add("resource-view");
panelSupplements.classList.add("hidden");

const panelReferences = document.createElement("div");
panelReferences.classList.add("panel");
panelReferences.classList.add("references");
panelReferences.classList.add("resource-view");
panelReferences.classList.add("hidden");

const panelFigures = document.createElement("div");
panelFigures.classList.add("panel");
panelFigures.classList.add("figures");
panelFigures.classList.add("resource-view");
panelFigures.classList.add("hidden");

const panelFootnotes = document.createElement("div");
panelFootnotes.classList.add("panel");
panelFootnotes.classList.add("footnotes");
panelFootnotes.classList.add("resource-view");
panelFootnotes.classList.add("hidden");

const panelMaps = document.createElement("div");
panelMaps.classList.add("panel");
panelMaps.classList.add("Maps");
panelMaps.classList.add("resource-view");
panelMaps.classList.add("hidden");

// Test Leaflet:
panelMaps.innerHTML = "<div id='map' style='height: 60%;width: 100%;position: relative;'></div>";

// create text-content-wrapper
const textContentWrapper = document.createElement("div");
textContentWrapper.setAttribute("id", "text-content-wrapper");
textContentWrapper.classList.add("column");

// create additional-resources-wrapper
const additionalResourcesWrapper = document.createElement("div");
additionalResourcesWrapper.setAttribute("id", "additional-resources-wrapper");
additionalResourcesWrapper.classList.add("column");

// parse HTML DOM before load
document.onreadystatechange = function(e) {

    if (document.readyState === 'complete') {

        document.body.classList.add("fade-in");

        // add panels to resourcesWrapper
        additionalResourcesWrapper.appendChild(menuBar);
        additionalResourcesWrapper.append(panelContents);
        additionalResourcesWrapper.append(panelMaps);
        additionalResourcesWrapper.append(panelFigures);
        additionalResourcesWrapper.append(panelReferences);
        additionalResourcesWrapper.append(panelFootnotes);
        additionalResourcesWrapper.append(panelSupplements);

        // add styles to document
        document.head.appendChild(StylesCssLink);
        document.head.appendChild(LensCssLink);
    }
};

// parse document
window.onload = () => {

    // front, back, page-header and metadata
    let textBody = document.getElementsByClassName("content-body")[0];
    let titlePage = createTitlePage(textBody);

    // panelContents with posterImage:
    let posterImage = document.getElementById("poster-image");
    if (posterImage) {
        posterImage.classList.add("cover-image");
        panelContents.appendChild(posterImage);
    }

    createToCFromHeadings(document, "content-body");

    // figures
    let imagesContainer = document.getElementById("images-container");
    if (imagesContainer) {
        let imageSection = imagesContainer;
        // reorderImages(imageSection);
        panelFigures.innerHTML = imageSection.innerHTML;
    }

    // references
    let referenceSection = textBody.querySelector(".reference-section");
    if(referenceSection) {
        panelReferences.innerHTML = referenceSection.innerHTML;
        referenceSection.remove();
    }

    // footnotes
    let footnoteSection = textBody.querySelector(".footnotes-section");
    if(footnoteSection) {
        panelFootnotes.innerHTML = footnoteSection.innerHTML;
        footnoteSection.remove();
    }

    // add content
    textContentWrapper.append(titlePage);
    textContentWrapper.append(textBody);

    // add wrapper to document-body:
    document.body.appendChild(textContentWrapper);
    document.body.appendChild(additionalResourcesWrapper);

    let supplementLinkCollection = extractSupplementLinks(document);
    getSupplementData(supplementLinkCollection);

    // define image rendering:
    document.querySelectorAll('img').forEach(function(img){
        // replace broken image icon on error:
        img.onerror = function(){this.style.display='none';}; // could be replaced by template-img
        // add lazy load for images.
        img.setAttribute("loading", "lazy");
    });

    focusTocOnHoverHeadings();
    // focusFiguresOnHoverFigureReferences(); // not necessary?
    testLeaflet();
};

/* FUNCTIONS
--------------*/

function createTitlePage(content) {

    // get title page information:
    let title = content.querySelector(".article-title");
    let subtitle = content.querySelector(".subtitle");
    let authors = content.querySelectorAll(".contrib[contrib-type='author']");
    let contributors = content.querySelectorAll(".contrib[contrib-type='co-author']");

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

function testLeaflet() {

    // initialize the map
    let coordinatesCenter = [37.638043, 21.630599];
    let map = L.map("map").setView(coordinatesCenter, 12);

    L.tileLayer
        .wms("https://basemap.dainst.org/osm/wms?service=WMS", {
            layers: "osm:Vector--color-slow",
            tiled: true,
            format: "image/jpeg",
            attribution: '© basemap.dainst.org'
        }).addTo(map);

    L.control.scale().addTo(map);

    // Let’s add a marker
    var marker = L.marker([37.638043, 21.630599]).addTo(map);
}

function reorderImages(imageSection) {

    let figPanels = imageSection.getElementsByClassName("fig");

    for (let i = 0; i < figPanels.length; ++i) {

        let refId = figPanels[i].getElementsByTagName("a")[0].id;

        if(refId !== "poster-image") {
            let label = figPanels[i].getElementsByClassName("label")[0];
            let caption = figPanels[i].getElementsByClassName("caption")[0];
            let img = figPanels[i].getElementsByTagName("img")[0];
            let credits = figPanels[i].getElementsByClassName("attrib")[0];

            let figure = document.createElement("figure");
            figure.id = (refId) ? refId : false;
            let figureLabel = document.createElement("div");
            figureLabel.innerHTML = "<span className='imgNumber'>" + label.innerText + "</span>";
            let figCaption = document.createElement("figcaption");
            figCaption.innerHTML = caption.innerText + credits.innerText;

            figure.appendChild(figureLabel);
            figure.appendChild(img);
            figure.appendChild(figCaption);

            panelFigures.appendChild(figure);
        }
    }
}

function createToCFromHeadings(document, textBodyClassName) {

    let textBody = document.getElementsByClassName(textBodyClassName)[0];
    let headings = textBody.querySelectorAll("h1, h2, h3, h4, h5, h6");

    let tocList = document.createElement("ul");
    tocList.classList.add("toc-list");

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
    }
    panelContents.appendChild(tocList);
}

function extractSupplementLinks(document) {

    let textBody = document.getElementsByTagName('body')[0];
    const supplementLinkCollection = [];

    if (textBody) {
        let a = textBody.getElementsByTagName('a');
        for (let i = 0; i < a.length; ++i) {

            // remove invalid links out and push href as url to linkCollection
            if(a[i].href !== "" && !a[i].href.match(/(localhost)/)) {
                let url = new URL(a[i].href);
                let apiRefUrl = getApiRefUrl(url);

                if(apiRefUrl) {
                    let links = {
                        'url': url,
                        'apiRefUrl': apiRefUrl
                    };
                    supplementLinkCollection.push(links);
                }
            }
        }
    }
    return (supplementLinkCollection);
}

function getApiRefUrl(url) {

    let apiRefUrl;

    if (url.hostname === "arachne.dainst.org") {
        apiRefUrl = "https://arachne.dainst.org/data" + url.pathname; // e.g. + "/entity/7097972"
        return(apiRefUrl);
    }
    else {
        return(false);
    }

    /* CORS POLICY! API-keys? (field and gazetteer)

    if (url.hostname === "gazetteer.dainst.org") {
        https://gazetteer.dainst.org/doc/<placeId> // place weg!
        apiRefUrl = "https://gazetteer.dainst.org/doc" + url.pathname // e.g. 2095094
    }

    if (url.hostname === "field.idai.world") {
    // example: <a target="xrefwindow" href="https://field.idai.world/document/bourgou-online/45af2230-e3f6-40e6-7310-d22c575781fa">iDAI.field-HB3037-58</a>
    apiRefUrl = "https://field.idai.world/api/documents/" + url.pathname // e.g. c5e66f26-6689-0c27-0801-1b7df62f9989
    return(apiRefUrl);
    }

    // Chronontology: https://chronontology.dainst.org/info/api

    beispiel: https://chronontology.dainst.org/data/period/EfFq8qCFODK8

    */
}

async function getSupplementData(supplementLinkCollection) {

    // fetch supplement data
    for (let i = 0; i < supplementLinkCollection.length; ++i) {

        let apiRefUrl = supplementLinkCollection[i]["apiRefUrl"];
        const response = await fetch(apiRefUrl);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        let data = await response.json();
        supplementLinkCollection[i]["data"] = data;
    }
    // parse supplement data
    let parsedSupplementData = parseSupplementData(supplementLinkCollection);

    // render supplement data
    renderSupplementData(panelSupplements, parsedSupplementData);

}

function parseSupplementData(supplementLinkCollection) {

    let value;
    const supplementData = [];

    for (let i = 0; i < supplementLinkCollection.length; ++i) {
        value = supplementLinkCollection[i]["data"];

        let values = {
            'title': value.title,
            'subtitle': value.subtitle,
            'images': value.images
        };
        supplementData.push(values);
    }

    return(supplementData);
}

/*
function parseFieldData () {
    var ImageSource = false;
    var shortDescription = (res.resource.shortDescription !== undefined) ? res.resource.shortDescription : false;
    var group = res.resource.groups.find(group => group.fields.map(field => field.name).includes('isDepictedIn'));
    var targets = group ? group.fields.find(field => field.name === 'isDepictedIn').targets : false;

    // extract first image of resource:
    if(targets) {
        var categoryName = targets[0].resource.category.name;

        if(categoryName == "Photo" || categoryName == "Drawing") {
            var primaryImageId = targets[0].resource.id;
            var imageApiUrl = "https://field.idai.world/api/images/" + res.project + "/" + primaryImageId + ".jp2";
            var imageSpecs = "/x/full/!500,500/0/default.jpg"; // watch out: https://iiif.io/api/image/2.0/
            ImageSource = imageApiUrl + imageSpecs;
        }
    }
}

// render iDAI.field-data:

 if (type === 'field') {

      if (supplement.imageSource) {
        $supplements.append($(`<img class="supplement-image" loading="lazy" src="${supplement.imageSource}" >`));

        /* onerror="var imgSrc = $(this).attr('src');
        $(this).attr('src',imgSrc); console.log('src refreshed for ' + imgSrc);"
         */
    /*
       }
       if (supplement.shortDescription) {
           $supplements.append($(`<div class="supplement-title">${supplement.shortDescription}</div>`));
       }
       var $supplementsLink = $('<div class="supplement-link"></div>');
       $supplementsLink.append($('<span>Link to iDAI.field-web: </span>'));
       $supplementsLink.append($(`<a class="external" href="${url}" target="_blank" rel="noopener noreferrer"></a>`).text(url));
       $supplements.append($supplementsLink);
       }
   }

*/

function renderSupplementData(panelSupplements, supplementData) {

    let data = supplementData;

    for (let i = 0; i < data.length; ++i) {

        let supplementElement = document.createElement("details");
        supplementElement.classList.add("supplement-element");

        if (data[i].title) {
            supplementElement.innerHTML += "<summary>" + data[i].title + "</summary>";
        }
        if (data[i].images && data[i].images.length) {
            supplementElement.innerHTML += "<img class ='supplement-image' loading='lazy' src='https://arachne.dainst.org/data/image/" + data[i].images[0].imageId + "'>";
        }
        if (data[i].subtitle) {
            supplementElement.innerHTML += "<div class='supplement-subtitle'>" + data[i].subtitle + "</div>";
        }

        supplementElement.innerHTML += "<div class='supplement-link'><span>Link to iDAI.objects: </span>" +
            "<a href='https://arachne.dainst.org/data/entity/7097972' target='_blank'>" +
            "https://arachne.dainst.org/data/entity/7097972</a></div>";

        panelSupplements.append(supplementElement);
    }
}

function toggleMenuBar(panel, panelName) {

    // hide panelContent, active by default:
    panelContents.classList.add("hidden");
    document.getElementsByClassName("contents")[0].classList.remove("active");

    panelSupplements.classList.add("hidden");
    document.getElementsByClassName("supplements")[0].classList.remove("active");

    panelFigures.classList.add("hidden");
    document.getElementsByClassName("figures")[0].classList.remove("active");

    panelMaps.classList.add("hidden");
    document.getElementsByClassName("maps")[0].classList.remove("active");

    panelReferences.classList.add("hidden");
    document.getElementsByClassName("references")[0].classList.remove("active");

    panelFootnotes.classList.add("hidden");
    document.getElementsByClassName("footnotes")[0].classList.remove("active");

    // show selected panel:
    panel.classList.add("active");
    panel.classList.remove("hidden");
    document.getElementsByClassName(panelName)[0].classList.add("active");
}

function focusTocOnHoverHeadings() {

    const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
            const id = entry.target.getAttribute('id');
            if (entry.intersectionRatio > 0) {
                document.querySelector(`.heading-ref-a[href="#${id}"]`).parentElement.classList.add('active');

                // scroll to element;
                document.querySelector(`.heading-ref-a[href="#${id}"]`).scrollIntoView({
                    behavior: 'auto',
                    block: 'end'
                });

            } else {
                document.querySelector(`.heading-ref-a[href="#${id}"]`).parentElement.classList.remove('active');
            }
        });
    });

    // track all headlines
    document.querySelectorAll(".title").forEach((headline) => {
        observer.observe(headline);
    });
}

function focusFiguresOnHoverFigureReferences() {

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            const id = entry.target.getAttribute('href').substring(1); // remove #
            if (entry.intersectionRatio > 0) {
                document.querySelector("figure[id='" + id + "']").firstChild.classList.add('active');
                document.querySelector("figure[id='" + id + "']").firstChild.scrollIntoView({
                    behavior: 'auto',
                    block: 'start'
                });
            } else {
                document.querySelector("figure[id='" + id + "']").firstChild.classList.remove('active');
            }
        });
    });

    // Track all figure references (e.g. "Abb. 1") that have an `id` applied
    document.querySelectorAll("a[href^='#f-']").forEach((figureReferences) => {
        observer.observe(figureReferences);
    });

    /*
       let figureReferences = document.querySelectorAll("a[href^='#f-']");
    let imageRef = document.querySelector("a[href*='" + refId + "']");
    console.log(imageRef);
     */
}




