import {getColorSchemes} from '../colorbrewer.js';
import {classify} from '../classify.js';
import '../map-legend.js';
import '../map-graph.js';
import '../map-legend-config.js';

function textStats(stats) {
    document.querySelector('#textstats').innerHTML = `
    <b>min:</b> ${stats.percentiles.length?stats.percentiles[0].from:null} <b>max:</b> ${stats.percentiles.length?stats.percentiles[stats.percentiles.length-1].to:null} <b>count:</b> ${stats.nullrowcount+stats.datarowcount} ${!stats.nullrowcount?"(no-data: 0)":!stats.datarowcount?"(only no-data)":`(data: ${stats.datarowcount}, no-data: ${stats.nullrowcount})`}, <b>all unique:</b> ${stats.allvaluesunique?"yes":"no"}
    `
}

const spinnerIcon = `<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
width="24px" height="30px" viewBox="0 0 24 30" style="enable-background:new 0 0 50 50;" xml:space="preserve">
<rect x="0" y="10" width="4" height="10" fill="#333" opacity="0.2">
<animate attributeName="opacity" attributeType="XML" values="0.2; 1; .2" begin="0s" dur="0.6s" repeatCount="indefinite" />
<animate attributeName="height" attributeType="XML" values="10; 20; 10" begin="0s" dur="0.6s" repeatCount="indefinite" />
<animate attributeName="y" attributeType="XML" values="10; 5; 10" begin="0s" dur="0.6s" repeatCount="indefinite" />
</rect>
<rect x="8" y="10" width="4" height="10" fill="#333"  opacity="0.2">
<animate attributeName="opacity" attributeType="XML" values="0.2; 1; .2" begin="0.15s" dur="0.6s" repeatCount="indefinite" />
<animate attributeName="height" attributeType="XML" values="10; 20; 10" begin="0.15s" dur="0.6s" repeatCount="indefinite" />
<animate attributeName="y" attributeType="XML" values="10; 5; 10" begin="0.15s" dur="0.6s" repeatCount="indefinite" />
</rect>
<rect x="16" y="10" width="4" height="10" fill="#333"  opacity="0.2">
<animate attributeName="opacity" attributeType="XML" values="0.2; 1; .2" begin="0.3s" dur="0.6s" repeatCount="indefinite" />
<animate attributeName="height" attributeType="XML" values="10; 20; 10" begin="0.3s" dur="0.6s" repeatCount="indefinite" />
<animate attributeName="y" attributeType="XML" values="10; 5; 10" begin="0.3s" dur="0.6s" repeatCount="indefinite" />
</rect>
</svg>`

function uuidv4() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
  }
  

function showSpinner(){
    let mapSpinner = document.querySelector('#mapspinner');
    if (mapSpinner.innerHTML === '') {
        mapSpinner.innerHTML = spinnerIcon;
    }
    mapSpinner.classList.remove('hide');
}

function hideSpinner() {
    document.querySelector('#mapspinner').classList.add('hide');
}

function updateLayerJsonDisplay() {
    const layerjson = map.getStyle().layers.filter(l=>l.id==='attrlayer')[0];
    layerjson.source = map.getSource(layerjson.source).serialize();
    layerjson.id = uuidv4();
    let jsonString = JSON.stringify(layerjson, null, null);
    jsonString = jsonString
        .replace('{"id"',     '{\n    "id"')
        .replace(',"type"',   ',\n    "type"')
        .replace('"source":', '\n    "source":')
        .replace('{"type"',   '{\n        "type"')
        .replace('"tiles"',   '\n        "tiles"')
        .replace('"bounds"',  '\n        "bounds"')
        .replace('"source-layer"', '\n    "source-layer"')
        .replace('"paint":{', '\n    "paint":{\n')
        .replace(/"(.*)-color":\[/g, '    "$1-color":\[\n')
        .replace('"case"', '        "case"')
        .replace(/"#([0-9a-f]{6})",/g, '"#$1",\n        ')
        .replace(/}$/, '\n}');
    document.querySelector("#layerjson").innerHTML = `<pre>${jsonString}</pre>`;
}

let map;

function initMap(color)
{
    const urlParams = new URLSearchParams(window.location.search);
    const fullTableName = urlParams.get('table');
    const geomType = urlParams.get('geomtype');
    const geomColumn = urlParams.get('geom_column');
    const attrName = urlParams.get("column");
    const sldLayer = urlParams.get("sldlayer");
    
    const mapDefinition = {
        container: 'map',
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
    // set map extent to bboxll boundingbox defined by bboxll parameter
    const bboxll = urlParams.get('bboxll');
    if (bboxll) {
        mapDefinition.bounds = JSON.parse(bboxll);
    }
    // create the mapbox-gl map
    map = new mapboxgl.Map(mapDefinition);

    map.on("dataloading", showSpinner);
    map.on("styledata", showSpinner);
    map.on("idle", ()=>{if (map.areTilesLoaded()) {hideSpinner()}});

    map.on('load', () => {
        // add the attribute layer
        let layerType, paint;
        switch (geomType) {
            case 'MULTIPOLYGON':
            case 'POLYGON':
                layerType = 'fill';
                paint = {
                    "fill-color": color,
                    "fill-outline-color": "white",
                    "fill-opacity": 0.8
                }
                break;
            case 'MULTILINESTRING':
            case 'LINESTRING':
                layerType = 'line';
                paint = {
                    "line-color": color,
                    "line-width": 1
                }
                break;
            case 'MULTIPOINT':
            case 'POINT': 
                layerType = "circle";
                paint = {
                    "circle-radius": 5,
                    "circle-color": color,
                    "circle-stroke-color": "white",
                    "circle-stroke-width" : 1
                }
                break;
            default: 
                break;
        }
        if (!layerType) {
            // layerType not one of 'fill', 'line', 'circle'
            document.querySelector("#layerjson").innerHTML = `Field geom of type: '${geomType}' not supported<br>Supported types: (MULTI-) POINT/LINE/POLYGON<p>`
        } else {
            let sldParams = ""
            if (sldLayer) {
                sldParams = `&sldlayer=${encodeURIComponent(sldLayer)}`
            }
            const baseUrl = new URL(`/data`, window.location.href).href;
            const layer = {
                "id": "attrlayer",
                "type": layerType,
                "source": {
                    "type": "vector",
                    "tiles": [`${baseUrl}/${fullTableName}/mvt/{z}/{x}/{y}?geom_column=${encodeURIComponent(geomColumn)}&columns=${encodeURIComponent(attrName)}&include_nulls=0${sldParams}`],
                },
                "source-layer": fullTableName,
                "paint": paint,
                //"filter": ['has', attrName]
            }
            if (mapDefinition.bounds) {
                let b = mapDefinition.bounds;layer.source.bounds = [b[0][0],b[0][1],b[1][0],b[1][1]];
            }
            map.addLayer(layer);
        }
    })
    // get feature information from features under mouse cursor and display
    map.on('mousemove', function (e) {
        var features = map.queryRenderedFeatures(e.point).map(function(feature){ return {layer: {id: feature.layer.id, type: feature.layer.type}, properties:(feature.properties)};});
        document.querySelector('#featureinfo').innerHTML = JSON.stringify(features.map(feature=>feature.properties), null, 2);
    });
}

// create a map layer definition from the legend and apply it to the map attribute layer
function updateMap(layerType, stats, classInfo, legendConfig) {
    let mapboxPaint;
    switch(classInfo.classType) {
        case 'mostfrequent':
            mapboxPaint = ["case"];
            classInfo.classes.forEach(classItem=>{
                if (classItem.from !== '__other__') {
                    mapboxPaint.push(['==', ["get", stats.column], classItem.from]);
                    mapboxPaint.push(classItem.paint);
                }
            })
            mapboxPaint.push(classInfo.classes[classInfo.classCount - 1].paint);
            break;
        case 'quantile':
            mapboxPaint = ["case"]
            classInfo.classes.forEach((classItem, index, arr)=>{
                let nextFrom = (index != arr.length-1)?arr[index+1].from:null;
                if (nextFrom > classItem.to) {
                    nextFrom = null;
                }
                let compare = (classItem.to !== nextFrom)?"<=":"<";
                if (typeof classItem.to == "boolean") {
                    compare = '!=';
                }
                if (stats.datatype === 'numeric') {
                    mapboxPaint.push([compare,["to-number", ["get", stats.column], 0],classItem.to],classItem.paint);
                } else if (stats.datatype === 'timestamptz' || stats.datatype === 'date') {
                    mapboxPaint.push([compare,["get", stats.column],classItem.to.toJSON()],classItem.paint);
                } else {
                    mapboxPaint.push([compare,["get", stats.column],classItem.to],classItem.paint);
                }
            });
            mapboxPaint.push(classInfo.classes[classInfo.classCount - 1].paint)
            break;
        case 'interval':
            if (classInfo.classCount) {
                mapboxPaint = ["case"];
                classInfo.classes.forEach((classItem, index)=>{
                    if (stats.datatype === 'numeric') {
                        // convert javscript string to number
                        mapboxPaint.push(["<", ["to-number",["get", stats.column], 0],classItem.to], classItem.paint);
                    } else {
                        mapboxPaint.push(["<", ["get", stats.column],classItem.to], classItem.paint);
                    }
                })
                mapboxPaint.push(classInfo.classes[classInfo.classCount - 1].paint);
            }
            break;
    }
    if (mapboxPaint) {
        let displayOutlines = legendConfig.outlines;
        switch (layerType) {
            case 'fill':
                map.setPaintProperty('attrlayer', 'fill-outline-color', displayOutlines? 'white':null);
                map.setPaintProperty('attrlayer', 'fill-color', 'yellow'); // fix for mapbox-gl update bug?
                break;
            case 'line':
                break;
            case 'circle':
                map.setPaintProperty('attrlayer', 'circle-stroke-width', displayOutlines? 1:0);
                map.setPaintProperty('attrlayer', 'circle-stroke-color', displayOutlines? 'white':null);
                break;
        }

        let colorprop = `${layerType}-color`;
        map.setPaintProperty('attrlayer', colorprop, mapboxPaint);

        updateLayerJsonDisplay();
    }
}

function updatePage(layerType, stats)
{
    textStats(stats);
    let legendConfig = document.querySelector("map-legend-config").getConfig();
    let classInfo = classify(stats, legendConfig.classCount, legendConfig.classType, legendConfig.colors);
    document.querySelector("#nodata").updateGraph('nodata', stats, classInfo);
    document.querySelector("#values").updateGraph('values', stats, classInfo);
    document.querySelector("#quantile").updateGraph('quantile', stats, classInfo);
    document.querySelector("#mostfrequent").updateGraph('mostfrequent', stats, classInfo);
    document.querySelector("map-legend").updateLegend(layerType, classInfo);
    if (map.loaded()) {
        updateMap(layerType, stats, classInfo, legendConfig);
    } else {
        map.once("load", ()=>updateMap(layerType, stats, classInfo, legendConfig));
    }
}

// enable or disable legend control elements based on attribute stats
function updateLegendControls(stats) {
    // enable or disable controls that apply to these statistics
    let settings = document.querySelector('map-legend-config');
    if (stats.nullValues) {
        settings.removeAttribute('nonulls');
    } else {
        settings.setAttribute('hasnulls', '')
    }
    // disable/enable equal interval
    if (stats.percentiles.length && typeof stats.percentiles[0].from !== 'string' && typeof stats.percentiles[0].from !== 'boolean') {
        settings.removeAttribute('noequal');
    } else {
        settings.setAttribute('noequal', '');
    }
    // disable/enable most frequent values
    if (stats.allvaluesunique) {
        settings.setAttribute('nomostfrequent', '');
    } else {
        settings.removeAttribute('nomostfrequent');
    }
}


async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const fullTableName = urlParams.get('table');
    const attrName = urlParams.get("column");
    const attrType = urlParams.get("columntype");
    const geomType = urlParams.get("geomtype");
    const geomColumn = urlParams.get('geom_column');
    const sldLayer = urlParams.get('sldlayer');
    document.querySelector('#tablename').innerHTML = `Table: ${fullTableName}<br>Geometry: ${geomColumn} (${geomType})`;
    document.querySelector('#columnname').innerHTML = `Attribute: ${attrName} (${attrType})`;
    document.querySelector('#back').innerHTML = `<a href="tableinfo.html?table=${fullTableName}&geom_column=${geomColumn}">Back to layer info</a>`;

    let layerType;
    switch (geomType) {
        case 'MULTIPOLYGON':
        case 'POLYGON':
            layerType = 'fill';            
            break;
        case 'MULTILINESTRING':
        case 'LINESTRING':
            layerType = 'line';
            break;
        case 'MULTIPOINT':
        case 'POINT': 
            layerType = "circle";
            break;
        default: 
            break;
    }

    let sldParams = sldLayer?`&sldlayer=${sldLayer}`:'';
    let response = await fetch(`data/${fullTableName}/colstats/${encodeURIComponent(attrName)}?geom_column=${encodeURIComponent(geomColumn)}${sldParams}`);

    const loadingElement = document.querySelector('#loader');
    loadingElement.innerHTML = "";
    if (!response.ok) {
        try {
            let json = response.json();
            loadingElement.innerHtml = json.error;
        } catch(err) {
            loadingElement.innerHTML = err.message;
        }
        return;
    }
    let stats = await response.json();
    if (stats.datatype === 'timestamptz' || stats.datatype === 'date') {
        stats.percentiles = stats.percentiles.map(percentile=>{
            percentile.from = percentile.from?new Date(percentile.from):null;
            percentile.to = percentile.to?new Date(percentile.to):null;
            return percentile;
        })
        stats.values = stats.values.map(value=>{
            value.value = value.value?new Date(value.value):null;
            return value;
        })
    }
    updateLegendControls(stats);
    initMap(document.querySelector('map-legend-config').getConfig().colors[0]);
    updatePage(layerType, stats);
    document.querySelector('map-legend-config').onchange = () => updatePage(layerType, stats);
}

init();