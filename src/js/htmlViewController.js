/** -------------------------------------
 * html view script libraries 
 * @type {Constants}
---------------------------------------*/
const htmlViewScriptLibrary = {
    "highlightJs": {
        "type": "text/javascript",
        "src-remote": "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js",
        "src-local": "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js",
    },
    "highlightJsCss": {
        "type": "text/css",
        "src-remote": "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/default.min.css",
        "src-local": "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/default.min.css",
    },
    "leaflet": {
        "type": "text/javascript",
        "src-remote": "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
        "src-local": "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
    },
    "leafletCss": {
        "type": "text/css",
        "src-remote": "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
        "src-local": "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    },
    "fontAwesome": {
        "type": "text/css",
        "src-remote": "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css",
        "src-local": "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css" // "src/css/font-awesome-min.css"
    }
} 
/** ---------------------------------
 * document state event listener:
 * @type {EventListenerObject}
 ------------------------------------*/
 document.addEventListener("readystatechange", (event) => {

    if (event.target.readyState === "interactive") {
        
        // document is single HTML downloaded or html view from xml
        let isSingleHTMLFile;
        if(document.querySelector('meta[name="--from-xml"]') === null) {
            isSingleHTMLFile = true;
        } else isSingleHTMLFile = false;

        // add third-party libraries and stylesheets:
        if(isSingleHTMLFile) {
            // addScriptToDocumentHead("highlightJs");
            addScriptToDocumentHead("highlightJsCss");
            addScriptToDocumentHead("leaflet");
            addScriptToDocumentHead("leafletCss");
            addScriptToDocumentHead("fontAwesome");
        }
     
        // remove fallback-styles:
        let fallbackStyles = document.querySelector("#fallback-styles");
        if(fallbackStyles !== null) {fallbackStyles.remove();}

        // add poster image as background image:
        let posterImage = document.querySelector("#poster-image > img");
        let mainWrapper = document.querySelector("#main-wrapper");
        let backgroundStyles = "background: url(" + posterImage.src + ") #ffffff; " +
        "background-blend-mode: luminosity; background-size:65%;"
        mainWrapper.style = backgroundStyles;
    }

    if (event.target.readyState === "complete") {
        focusTocTargetsOnHoverSection();
        showSelectedPanel("contents");
        setTimeout(() => {
            // highlight anchor targets:
            let anchors = document.querySelectorAll(
                "a.fig-ref,a.bib-ref,a.fn-ref,a.ext-ref,a.box-ref,a.index-ref");
            highlightAnchorTargets(anchors);
            // add background-image moving effect:
            if(document.querySelector("#abstract-navigation") !== null) {
                document.querySelector("#abstract-navigation")
                    .addEventListener("mouseover", event => {
                        document.querySelector("#main-wrapper").style.backgroundSize = "80%";
                        document.querySelector("#main-wrapper").style.transition = "all 5s";
                });
            }
        }, 500);
    }
});

/** ------------
 FUNCTIONS
 --------------*/
 /**
 * show selected panel (navigation)
 * @param {String} selectedPanel: panelName, e.g. "figures"
 * @returns {void} triggers functions and manages css-classes in DOM
 */
function showSelectedPanel(selectedPanel) {

    let panelAnchors = document.querySelectorAll(".panel-anchors");
    panelAnchors.forEach((panelAnchor) => {
        let panelName = panelAnchor.id.slice(2); 
        let panel = document.querySelector("#" + panelName);
  
        if(selectedPanel && panel !== null) {
            if(panelName === selectedPanel) {
                // highlight anchor in nav.panel
                panelAnchor.classList.add("active");
                panel.classList.replace("hidden", "active");
          
                // initMaps during panel-display:
                if(selectedPanel === "locations") {
                    setTimeout(initMaps(".map"), 500);
                }
            }
            else {
                panel.classList.replace("active", "hidden");
                panelAnchor.classList.remove("active");
            }
        };
    });
}

 /**
 * open abstract box (navigation)
 * @param {JSON} event: onclick event object 
 * @returns {void} changes display of related elements in DOM by assigning
 * classes and css-style-properties
 */
function openAbstractBox(event) {

    // define ids, states and selected box:
    let boxId = event.target.textContent;
    let isActive = (/active/.test(event.target.className)) ? true : false;
    let selectedBox = document.querySelector("#" + boxId);

    // get all boxes and btns from DOM
    let allBoxes = document.querySelectorAll(".abstract-box");
    let allBtns = document.querySelectorAll(".abstract-button");

    // remove classes for all btns and boxes:
    allBtns.forEach(btn => {btn.classList.remove("active");});
    allBoxes.forEach(box => {box.style.display = "none";});

    // open box selected:
    if(!isActive) {
        event.target.classList.add("active");
        selectedBox.style.display = "block";
    }
    // close selected box if active already:
    else {selectedBox.style.display = "none";}
}

 /**
 * init(ialize) map containers for leaflet
 * @param {String} selector css-selector of map container(s)
 * @returns {void} handles over mapId and coords to createMap()
 */
function initMaps(selector) {

    let maps = document.querySelectorAll(selector);
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

 /**
 * create leaflet maps
 * @param {String} mapId: ids of map elements (divs with class 'map')
 * @param {Array} coordinates: array wit long and lat values
 * @returns {void} instantiates leaflet maps (e.g. mapLayers and marker)
 */
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

 /**
 * focus toc-targets when hover over section
 * @returns {void} classes of targeted toc elements will be changed
 * if the come into viewport (detected by intersection observer)
 */
function focusTocTargetsOnHoverSection() {

    const options = {threshold: 1,};
    const observer = new IntersectionObserver(sections => {
        sections.forEach(section => {

            // get target reference by section headline:
            let headline = section.target.firstElementChild;
            let targetRefId;
            if(headline != null) {
                targetRefId = headline.getAttribute("href");
            } else (targetRefId = null);
    
            // query target:
            let target;
            if(targetRefId !== null && !targetRefId.includes(' ')) {        
                 target = document.querySelector(targetRefId);
            } else target = null;

            // reference comes into viewport (at bottom)
            if (section.isIntersecting) { 
                 // handle target:
                 if(target !== null) {
                     target.classList.toggle('active');
                     target.scrollIntoView({
                         behavior: "smooth",
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

    // track all section elements:
    document.querySelectorAll("section")
        .forEach((element) => {observer.observe(element);
    });
}

 /**
 * highlight (internal) targets of anchors when clicked
 * @param {NodeList} anchors: nodeList of internal anchors
 * @returns {void} adds a click-event listener that displays
 * the panels of the anchor-targets and highlights the anchor
 * targets itself (by scrollIntoView and css-classes)
 */
function highlightAnchorTargets(anchors) {
    let targetRef;
    let targetPanelName;

    if(anchors !== undefined && anchors.length) {
        anchors.forEach((anchor) => {
            // when clicked
            anchor.addEventListener("click", event => {
                // define target
                targetRef = anchor.getAttribute("href");
                targetPanelName= definePanelNameByTargetId(targetRef);
                // show panel first:
                showSelectedPanel(targetPanelName);
                // query target:
                let target;
                if(targetRef !== null && !targetRef.includes(' ')) {        
                    target = document.querySelector(targetRef);
                } else {target = null;}

                if(target !== null) {
                     // give panel a bit of time to change
                    setTimeout(() => { 
                        target.classList.toggle('active');
                        target.classList.add('highlight');
                        target.scrollIntoView({
                            behavior: "smooth",
                            block: "center"
                        });
                    }, 500);
                }
                // reset the color after a short delay
                setTimeout(() => {
                    target.classList.remove("highlight");
                }, 3000);
                });
        });
    }
}

 /**
 * define panel name based on ids of href-targets
 * @param {String} targetId: href-value of anchors pointing
 * to internal targets (#targetId)
 * @returns {String} panelName: name of the panel,
 * default: "contents"
 */
function definePanelNameByTargetId(targetId) {

    let panelName;
    switch (true) {
        case (/#f-/.test(targetId)):
            panelName = "figures";
            break;
        case (/#fn-/.test(targetId)):
            panelName = "notes";
            break;
        case (/#ref-/.test(targetId)):
            panelName = "references";
            break;
        case (/#target-gazetteer/.test(targetId)):
            panelName = "locations";
            break;
        case (/#target-arachne/.test(targetId)):
            panelName = "arachne";
            break;
        case (/#target-field/.test(targetId)):
            panelName = "field";
            break;
        default:
            panelName = "contents";
            break;
    }
    return(panelName);
}

 /**
 * add <script>- or <link>-element to document head
 * @param {String} scriptName: name of the script, 
 * defined in htmlViewScriptLibrary (constant)
 * @returns {void} appends script or link to document head
 */
function addScriptToDocumentHead(scriptName) {

    let type;
    if(htmlViewScriptLibrary[scriptName] !== undefined) {
        type = htmlViewScriptLibrary[scriptName]["type"];
    } else type = false;
    
    if(type === "text/javascript") {
        let script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = htmlViewScriptLibrary[scriptName]["src-local"];
        if(scriptName === "htmlViewController") {
            script.defer = true;
        }
        document.head.appendChild(script);
    }
    else if(type === "text/css") {
        let cssLink = document.createElement('link');
        cssLink.type = 'text/css';
        cssLink.rel = 'stylesheet';
        cssLink.href = htmlViewScriptLibrary[scriptName]["src-local"];
        document.head.appendChild(cssLink);
    }
    else {
        console.warn("ScriptName [" + scriptName + "] not defined in scriptLibary")
    }
}



