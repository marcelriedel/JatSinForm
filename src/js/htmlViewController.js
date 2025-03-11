/** -------------
* CONSTANTS
----------------*/
const mediaSmallScreen = "screen and (max-width: 924px)";

/** ----------------------------
 * media query event listener
* @type {EventListenerObject}
--------------------------------*/
const mediaQuerySmallScreen = window.matchMedia(mediaSmallScreen);
mediaQuerySmallScreen.addEventListener('change', event => {

    if (event.matches) {
        document.querySelector('.nav-text-content-wrapper').style = "display: inline-block !important;";
        showSelectedPanel("text-content-wrapper");
    } 
    else {
        // take what is selected or showSelectedPanel("contents");
        if(!document.querySelectorAll(".panel.active").length) {
            showSelectedPanel("contents");
        }
        document.querySelector('.nav-text-content-wrapper').style = "none !important;";
        document.querySelector("#text-content-wrapper").style = "height: 100vh";
        document.querySelector("#panel-wrapper").style = "height: 100vh";
    }

    /*
    let mainText =  document.querySelector("#text-content-wrapper");
    let panelWrapper =  document.querySelector("#panel-wrapper");
    if(mediaQuerySmallScreen.matches) {
        if(selectedPanel == "text-content-wrapper") {
            mainText.style = "height:100vh;";
            panelWrapper.style = "height:0;";
        }
        else {
            mainText.style = "height:0;";
            panelWrapper.style = "height:100vh;";
        }
    }
    */
})

/** ---------------------------------
 * document state event listener:
 * @type {EventListenerObject}
 ------------------------------------*/
 document.addEventListener("readystatechange", (event) => {

    if (event.target.readyState === "interactive") {
        // add background image:
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
            highlightAnchorTargets();
        
            // background-image moving effect:
            document.querySelector("#abstract-navigation").addEventListener("mouseover", event => {
                document.querySelector("#main-wrapper").style.backgroundSize = "80%";
                document.querySelector("#main-wrapper").style.transition = "all 5s";
            });
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
            if(selectedPanel === "text-content-wrapper") {
                /** how to handle the added text-content-wrapper panelAnchor? */
            }
            else if(panelName === selectedPanel) {
                // highlight anchor in nav.panel
                panelAnchor.classList.add("active");
                panel.classList.replace("hidden", "active");
          
                // initMaps during panel-display:
                if(selectedPanel === "locations") {
                    setTimeout(initMaps, 500);
                }
                // init zoom of medium-zoom-lib:
                mediumZoom('[data-zoomable]', {
                    background: 'rgb(255 255 255 / 0%);',
                    scrollOffset: 0,
                })
            }
            else {
                panel.classList.replace("active", "hidden");
                panelAnchor.classList.remove("active");
            }
        };
    });
}

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

function openInternalIndexBox(event) {

    let parent = event.target.parentElement;
    if(parent !== undefined && parent !== null) {
        let internalIndexBox = parent.querySelector(".internal-index-box");
        if(internalIndexBox !== null) {
            if(internalIndexBox.hidden) {
                internalIndexBox.hidden = false;
            }
            else {
                internalIndexBox.hidden = true;
            }
        } 
    }
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

function highlightAnchorTargets() {

    let targetRef;
    let targetPanel;

    let anchors = document.querySelectorAll(
        "a.fig-ref,a.bib-ref,a.fn-ref,a.ext-ref,a.index-ref");
    if(anchors !== undefined && anchors.length) {
        anchors.forEach((anchor) => {
            anchor.addEventListener("click", event => {
                targetRef = anchor.getAttribute("href");
                targetPanel= definePanelNameByTargetId(targetRef);
                showSelectedPanel(targetPanel);
               
                // query target:
                let target;
                if(targetRef !== null && !targetRef.includes(' ')) {        
                    target = document.querySelector(targetRef);
                } else {target = null;}

                if(target !== null) {
                    // give panel change a bit of time:
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

function definePanelNameByTargetId(targetRef) {

    let panelName;

    switch (true) {
        case (/#f-/.test(targetRef)):
            panelName = "figures";
            break;
        case (/#fn-/.test(targetRef)):
            panelName = "notes";
            break;
        case (/#ref-/.test(targetRef)):
            panelName = "references";
            break;
        case (/#target-gazetteer/.test(targetRef)):
            panelName = "references";
            break;
        case (/#target-arachne/.test(targetRef)):
            panelName = "references";
            break;
        case (/#target-field/.test(targetRef)):
            panelName = "references";
            break;
        default:
            panelName = "text-content-wrapper";
            break;
    }
    return(panelName);
}


