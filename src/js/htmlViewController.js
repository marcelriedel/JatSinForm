/** --------------------------------------
 * document state event listener:
 * @type {EventListenerObject}
 --------------------------------------*/
 document.addEventListener("readystatechange", (event) => {

    if (event.target.readyState === "interactive") {

	    // leafletCssLink:
        let leafletCssLink = document.createElement('link');
        leafletCssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        leafletCssLink.type = 'text/css';
        leafletCssLink.rel = 'stylesheet';
        document.head.appendChild(leafletCssLink);

        // leaflet
        let leaflet = document.createElement('script');
        leaflet.type = 'text/javascript';
        leaflet.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        document.head.appendChild(leaflet);
		
		// highlightJS-script:
		let highlightJsScript = document.createElement('script');
		highlightJsScript.type = 'text/javascript';
		highlightJsScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js';
		document.head.appendChild(highlightJsScript);

		// highlightJS-CSS:
		let highlightJsCSSLink = document.createElement('link');
		highlightJsCSSLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/default.min.css';
		highlightJsCSSLink.type = 'text/css';
		highlightJsCSSLink.rel = 'stylesheet';
		document.head.appendChild(highlightJsCSSLink);

		// font awesome 4 icons:
		let fontAwesomeCSSLink = document.createElement('link');
		fontAwesomeCSSLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css';
		fontAwesomeCSSLink.type = 'text/css';
		fontAwesomeCSSLink.rel = 'stylesheet';
		document.head.appendChild(fontAwesomeCSSLink);

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

function showSelectedPanel(selectedPanel) {

    let panelAnchors = document.querySelectorAll(".panel-anchors");
    panelAnchors.forEach((panelAnchor) => {
        let panelName = panelAnchor.id.slice(2); 
        let panel = document.querySelector("#" + panelName);

        if(selectedPanel && panel !== null) {
            if(panelName === selectedPanel) {
                panelAnchor.classList.add("active");
                panel.classList.replace("hidden", "active");
                // initMaps during panel-display:
                if(selectedPanel === "locations") {
                    setTimeout(initMaps, 500);
                }
                /* init zoom of medium-zoom-lib:
                mediumZoom('[data-zoomable]', {
                    background: 'rgb(255 255 255 / 0%);',
                    scrollOffset: 0,
                })
                */
            }
            else {
                panelAnchor.classList.remove("active");
                panel.classList.replace("active", "hidden");
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
    if(/#f-/.test(targetRef)) {
        panelName = "figures";
    }
    if(/#fn-/.test(targetRef)) {
        panelName = "notes";
    }
    if(/#ref-/.test(targetRef)) {
         panelName = "references";
    }
    if(/#target-gazetteer/.test(targetRef)) {
        panelName = "locations";
    }
    if(/#target-arachne/.test(targetRef)) {
        panelName = "arachne";
    }
    if(/#target-field/.test(targetRef)) {
        panelName = "field";
    }
    return(panelName);
}


