'use strict';

const mapDefinition = {
    container: 'mapmap',
    "style": {
        "version": 8,
        "name": "DefaultBaseStyle",
        "id": "defaultbasestyle",
        "glyphs": `https://free.tilehosting.com/fonts/{fontstack}/{range}.pbf?key=`,
        "sources": {
            "osmgray": {
                "type":"raster",
                "tileSize":256,
                "tiles":[
                    "https://tiles.edugis.nl/mapproxy/osm/tiles/osmgrayscale_EPSG900913/{z}/{x}/{y}.png?origin=nw"
                ],
                "attribution":"&copy; <a href=\"https://www.openstreetmap.org/about\" target=\"copyright\">OpenStreetMap contributors</a>",
                "maxzoom":19
            }
        },
        "layers": [
            {
                "id": "osmgray",
                "type": "raster",
                "source": "osmgray"
            }
        ]
    }
}

let map;


function dragElement(elmnt) {
  var deltaX = 0, deltaY = 0, 
      dragStartX = 0, dragStartY = 0;
  if (document.getElementById(elmnt.id + "header")) {
    // if present, the header is where you move the DIV from:
    document.getElementById(elmnt.id + "header").onmousedown = dragMouseDown;
  } else {
    // otherwise, move the DIV from anywhere inside the DIV:
    elmnt.onmousedown = dragMouseDown;
  }

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    // get the mouse cursor position at startup:
    dragStartX = e.clientX - deltaX;
    dragStartY = e.clientY - deltaY;
    document.onmouseup = closeDragElement;
    // call a function whenever the cursor moves:
    document.onmousemove = elementDrag;
  }

  let prevHoveredSibling;
  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    // calculate the new cursor position:
    deltaX = e.clientX - dragStartX;
    deltaX = 0;
    deltaY = e.clientY - dragStartY;
    // set the element's new position:
    elmnt.style.top = deltaY + "px";
    elmnt.style.left = deltaX + "px";
    let hoveredSibling = findHoveredSibling(elmnt);
    if (hoveredSibling) {
        if (hoveredSibling.element.id === 'search') {
            console.log(`${hoveredSibling.element.id}, before: ${hoveredSibling.before}`);
        }
        hoveredSibling.element.style['border-top'] = hoveredSibling.before ? 'solid 4px black' : '';
        hoveredSibling.element.style['border-bottom'] = hoveredSibling.before ? '' : 'solid 4px black';
    } else {
        console.log('nohover');
    }
    if (prevHoveredSibling && prevHoveredSibling !== (hoveredSibling ? hoveredSibling.element : undefined)) {
        if (prevHoveredSibling.id === 'search') {
            console.log(`hoveredSibling: ${hoveredSibling?hoveredSibling.element.id: 'undefined'}, erasing ${prevHoveredSibling.id}`);
        }
        prevHoveredSibling.style['border-top'] = '';
        prevHoveredSibling.style['border-bottom'] = '';
    }
    prevHoveredSibling = hoveredSibling ? hoveredSibling.element : undefined;
  }

  function closeDragElement() {
    // stop moving when mouse button is released:
    document.onmouseup = null;
    document.onmousemove = null;
    if (prevHoveredSibling) {
        let siblings = Array.from(elmnt.parentElement.children);
        for (let i = 0; i < siblings.length; i++) {
            if (siblings[i] === prevHoveredSibling) {
                if (siblings[i].style['border-top'] !== '') {
                    elmnt.parentElement.insertBefore(elmnt, siblings[i]);
                } else {
                    if (i + 1 < siblings.length) {
                        elmnt.parentElement.insertBefore(elmnt, siblings[i+1])
                    } else {
                        elmnt.parentElement.insertBefore(elmnt, null);
                    }
                }
                elmnt.style.top = '';
                elmnt.style.left = '';
                deltaX = deltaY = 0;
                break;
            }
        }
        prevHoveredSibling.style['border-top'] = '';
        prevHoveredSibling.style['border-bottom'] = '';
        prevHoveredSibling = undefined;
    } else {
        // reset to original
        elmnt.style.top = elmnt.style.left = '';
        deltaX = deltaY = 0;
    }
  }
}

function findHoveredSibling(element) {
    let elementClientRect = element.getBoundingClientRect();
    let siblings = Array.from(element.parentElement.children)
        .filter(sibling=>sibling.classList.contains('header'))
        .filter(sibling=>sibling!==element)
        .filter(sibling=>{
            let siblingClientRect = sibling.getBoundingClientRect();
            return elementClientRect.top + elementClientRect.height > siblingClientRect.top 
                && elementClientRect.top < siblingClientRect.top + siblingClientRect.height;
        })
    if (siblings.length) {
        // todo: if divs have unequal heights, there may be more than one hovered sibling, pick 'best'
        let hoveredSibling = siblings[0];
        let hoveredSiblingClientRect = hoveredSibling.getBoundingClientRect();
        return {element: hoveredSibling, before: elementClientRect.top + elementClientRect.height/2 < hoveredSiblingClientRect.top + hoveredSiblingClientRect.height / 2}
    }
    return undefined;
}

function clickHeader(event) {
    let element = event.currentTarget;
    if (event.target === event.currentTarget || event.target.classList.contains("title")) {
        element.classList.toggle('active');
        let collapsible = element.querySelector(':scope > .collapsible');
        if (collapsible) {
            collapsible.classList.toggle('active');
        }
        if (element.id === 'map') {
            if (!map) {
                map = new mapboxgl.Map(mapDefinition);
                map.resize();
                map.on("moveend", () => {
                    document.querySelector('#mapcenterlng').value = map.getCenter().lng;
                    document.querySelector('#mapcenterlat').value = map.getCenter().lat;
                    document.querySelector('#mapzoom').value = map.getZoom();
                    document.querySelector('#mappitch').value = map.getPitch();
                    document.querySelector('#mapbearing').value = map.getBearing();
                })
            }
        }
    }
    event.stopPropagation();
}

async function init() {
    let headers = document.querySelectorAll('.header');
    for (let header of headers) {
        header.onclick = clickHeader
    }

    let draggableTools = document.querySelectorAll("#toolbar > div");
    draggableTools.forEach(tool => {
        dragElement(tool)
    })

    let dragTree = document.querySelector('#dragtree');
    try {
        let response = await fetch('./layers.json');
        if (response.ok) {
            let json = await response.json();
            let map = `<div class="collapsible" id="#map"></div>`
        }
    } catch(error) {
        dragTree.innerHTML = `${error.message}`;
    }
}

window.addEventListener("load", init)