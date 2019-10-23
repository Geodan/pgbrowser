import {getColorSchemes} from "./colorbrewer.js";
import classify, {getIntervalClassTicks} from "./classify.js";
import './classification-settings.js';

let map = null;
let globalStats = null;
let selectedColorScheme = 0;

// initialize page app
async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const fullTableName = urlParams.get('table');
    const attrName = urlParams.get("column");
    const attrType = urlParams.get("columntype");
    const geomType = urlParams.get('geomtype');
    const geomColumn = urlParams.get('geom_column');
    document.querySelector('#tablename').innerHTML = `Table: ${fullTableName}<br>Geometry: ${geomColumn} (${geomType})`;
    document.querySelector('#columnname').innerHTML = `Attribute: ${attrName} (${attrType})`;
    document.querySelector('#back').innerHTML = `<a href="tableinfo.html?table=${fullTableName}&geom_column=${geomColumn}">Back to layer info</a>`;
    document.querySelector('classification-settings').onchange = (e)=> {
        //console.log(e.detail);
        const classification = classify(globalStats, e.detail.classCount, e.detail.classType, e.detail.colors)
        console.log(classification);
    }
    initMap();
    
    let response = await fetch(`data/${fullTableName}/colstats/${attrName}?geom_column=${geomColumn}`);
    
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
    let json = await response.json();
    
    if (json.datatype === 'timestamptz' || json.datatype === 'date') {
        json.percentiles = json.percentiles.map(percentile=>{
            percentile.from = percentile.from?new Date(percentile.from):null;
            percentile.to = percentile.to?new Date(percentile.to):null;
            return percentile;
        })
        json.values = json.values.map(value=>{
            value.value = value.value?new Date(value.value):null;
            return value;
        })
    }
    globalStats = json;
    addRowCountNullValuesToStats(json);
    textStats(json);
    graphStats(json);
    updateLegendControls(json);
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

// initialize the geographic map
function initMap()
{
    const urlParams = new URLSearchParams(window.location.search);
    const fullTableName = urlParams.get('table');
    const geomType = urlParams.get('geomtype');
    const geomColumn = urlParams.get('geom_column');
    const attrName = urlParams.get("column");
    
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
                    "fill-color": "red",
                    "fill-outline-color": "white",
                    "fill-opacity": 0.8
                }
                break;
            case 'MULTILINESTRING':
            case 'LINESTRING':
                layerType = 'line';
                paint = {
                    "line-color": "red",
                    "line-width": 1
                }
                break;
            case 'MULTIPOINT':
            case 'POINT': 
                layerType = "circle";
                paint = {
                    "circle-radius": 5,
                    "circle-color": "red",
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
            const baseUrl = new URL(`/data`, window.location.href).href;
            const layer = {
                "id": "attrlayer",
                "type": layerType,
                "source": {
                    "type": "vector",
                    "tiles": [`${baseUrl}/${fullTableName}/mvt/{z}/{x}/{y}?geom_column=${geomColumn}&columns=${attrName}&include_nulls=0`],
                },
                "source-layer": fullTableName,
                "paint": paint,
                //"filter": ['has', attrName]
            }
            if (mapDefinition.bounds) {
                let b = mapDefinition.bounds;layer.source.bounds = [b[0][0],b[0][1],b[1][0],b[1][1]];
            }
            map.addLayer(layer);
            addLegendLine('red', fullTableName, layerType);
            updateLayerJsonDisplay();
            
        }
    })
    // get feature information from features under mouse cursor and display
    map.on('mousemove', function (e) {
        var features = map.queryRenderedFeatures(e.point).map(function(feature){ return {layer: {id: feature.layer.id, type: feature.layer.type}, properties:(feature.properties)};});
        document.querySelector('#featureinfo').innerHTML = JSON.stringify(features.map(feature=>feature.properties), null, 2);
    });
}

// display attribute layer defintion (json)
function updateLayerJsonDisplay() {
    const layerjson = map.getStyle().layers.filter(l=>l.id==='attrlayer')[0];
    layerjson.source = map.getSource(layerjson.source).serialize();
    document.querySelector("#layerjson").innerHTML = `<pre>${JSON.stringify(layerjson, null, 2)}</pre>`;
}

// initialize graphs
function prepareGraphColors(classType) {
    globalStats.graphColors = [];
    globalStats.classType = classType;
}

// add a class color to the graph 
function addGraphColors(color, from, to) {
    globalStats.graphColors.push({color: color, from: from, to: to});
}

let graphNoData = null;
let graphValues = null;
let graphQuantiles = null;
let graphMostFrequent = null;

// destroy old graphs
function destroyGraphs() {
    if (graphNoData) {
        graphNoData.destroy();
    }
    if (graphValues) {
        graphValues.destroy();
    }
    if (graphQuantiles) {
        graphQuantiles.destroy();
    }
    if (graphMostFrequent) {
        graphMostFrequent.destroy();
    }
}

// calculate quantiles based on percentile stats
function getQuantiles(percentiles, classCount) {
    // group together percentiles of same value
    let percentileBreaks = percentiles.reduce((result, percentile)=>{
        if (result.length === 0) {
            // result.push({...percentile});
            result.push(Object.assign({}, percentile));
            return result;
        }
        if (result[result.length - 1].from === percentile.from || (percentile.from instanceof Date && percentile.from.getTime() === result[result.length - 1].from.getTime())) {
            result[result.length - 1].to = percentile.to;
            result[result.length - 1].count += percentile.count;
            return result;
        }
        result.push(Object.assign({}, percentile)); 
        return result;
    },[]);
    
    if (classCount < percentileBreaks.length) {
        // reduce percentiles to fit classCount
        let totalRowCount = percentileBreaks.reduce((result, percentile)=>result+percentile.count, 0);
        let rowCountPerClass = totalRowCount / classCount;
        let sumRowCount = 0;
        let sumClassCount = 0
        percentileBreaks = percentileBreaks.reduce((result, percentile)=>{
            sumRowCount += percentile.count;
            if (sumRowCount > sumClassCount * rowCountPerClass && result.length < classCount) {
                // new class
                result.push(percentile);
                sumClassCount++;
            } else {
                result[result.length - 1].to = percentile.to;
                result[result.length - 1].count += percentile.count;                                    
            }
            return result;
        },[])
    }
    return percentileBreaks;
}

function addRowCountNullValuesToStats(stats) {
    stats.nullValues = stats.values.filter(value=>value.value === null).reduce((result, value)=>result+value.count,0);
    stats.rowCount = stats.percentiles.reduce((result, percentile)=>result + percentile.count, 0);
    return stats;
}

function textStats(stats) {
    document.querySelector('#textstats').innerHTML = `
    <b>min:</b> ${stats.percentiles.length?stats.percentiles[0].from:null} <b>max:</b> ${stats.percentiles.length?stats.percentiles[stats.percentiles.length-1].to:null} <b>count:</b> ${stats.nullValues+stats.rowCount} ${!stats.nullValues?"(no-data: 0)":!stats.rowCount?"(only no-data)":`(data: ${stats.rowCount}, no-data: ${stats.nullValues})`}, <b>all unique:</b> ${stats.uniquevalues?"yes":"no"}
    `        
}

// display graphs based on statistics
function graphStats(stats) {
    destroyGraphs();
    // doughnut data-nodata
    graphNoData = new Chart(document.querySelector('#graphnodata canvas'), {
        type: 'doughnut',
        data: {
            labels: ['no data','data',],
            datasets: [{
                backgroundColor: ['lightgray', 'red'],
                borderColor: 'white',
                borderWidth: 0,
                data: [stats.nullValues, stats.rowCount]
            }]
        }
    });
    // value graph
    if (stats.percentiles.length && typeof(stats.percentiles[0].from) !== 'string') {
        graphValues = new Chart(document.querySelector('#graphvalues canvas'), {
            type: 'line',
            data: {
                labels: stats.percentiles.map((percentile, index, arr)=>Math.round((index/(arr.length - 1)) * 100)),
                datasets: [{
                    backgroundColor: stats.graphColors? stats.percentiles.map((percentile)=>{
                        let color = stats.classType === 'mostfrequent' ? 
                            stats.graphColors.find(graphColor=>percentile.to == graphColor.to) : 
                                stats.graphColors.find(graphColor=>percentile.to < graphColor.to);
                        if (!color) {
                            color = stats.graphColors[stats.graphColors.length - 1];
                        }
                        return color.color;
                    }):'red',
                    //borderColor: 'lighgray',
                    data: stats.percentiles.map((percentile,index,arr)=>(index===arr.length-1)?percentile.to:percentile.from),
                    fill: false
                }]
            },
            options : {
                title: {
                    display: false,
                    text : 'some title'
                },
                legend: {
                    display: false
                },
                scales: {
                    yAxes: [
                        {
                            scaleLabel: {
                                display: true,
                                labelString: stats.column
                            }
                        }
                    ],
                    xAxes: [
                        {
                            scaleLabel: {
                                display: true,
                                labelString: 'percentage of rows',
                                padding: 0
                            }
                        }
                    ]
                }
            }
        })
    }
    // quantiles graph
    let labels, data, backgroundColor;
    if (stats.graphColors) {
        // graph counts per legend class
        labels = stats.graphColors.map(c=>`${c.from} - ${c.to}`);
        backgroundColor = stats.graphColors.map(c=>c.color);
        data = stats.graphColors.map(c=>0);
        let totalCount = 0;
        stats.graphColors.forEach((color,index,arr)=>{
            let nextFrom = (index < arr.length - 1)?arr[index+1].from:null;
            if (nextFrom > color.to) {
                nextFrom = null;
            }
            if (stats.classType === "mostfrequent") {
                let valueInfo = stats.values.find(value=>value.value===color.from);
                if (valueInfo) {
                    data[index] = valueInfo.count;
                    totalCount += valueInfo.count;
                } else {
                    // other
                    data[index] = stats.rowCount - totalCount;
                }
            } else {
                stats.percentiles.forEach(percentile=>{
                    if (color.from <= percentile.from && ((nextFrom !== null && percentile.to < nextFrom) || (nextFrom === null && percentile.to <= color.to))) {
                        data[index] += percentile.count;
                    }
                })
            }
        })
    } else {
        // graph 11 quantiles
        let quantileBreaks = getQuantiles(stats.percentiles, 11);
        labels = quantileBreaks.map(quantile=>`${quantile.from} - ${quantile.to}`);
        data = quantileBreaks.map(quantile=>quantile.count);
        backgroundColor = 'red'
    }
    graphQuantiles = new Chart(document.querySelector('#graphquantiles canvas'), {
        type: "horizontalBar",
        data: {
            labels: labels,
            datasets: [{
                backgroundColor: backgroundColor,
                data: data
            }]
        },
        options : {
            legend: {
                display: false,
            },
            scales: {
                xAxes: [
                    {
                        ticks: {
                            min: 0
                        }
                    }
                ]
            }
        }
    })
    // most frequent values graph
    if (!stats.uniquevalues) {
        const valuesSummary = stats.values.filter(value=>value.value !== null).slice(0,10);
        const valuesSummeryRowCount = valuesSummary.reduce((result, value)=>result+value.count,0);
        if (stats.rowCount > valuesSummeryRowCount) {
            valuesSummary.push({
                value:"other", 
                count: stats.rowCount - valuesSummeryRowCount
            })
        }
        graphMostFrequent = new Chart(document.querySelector('#graphmostfrequent canvas'), {
            type: "horizontalBar",
            data: {
                labels: valuesSummary.map(value=>value.value),
                datasets: [
                    {
                        backgroundColor: stats.graphColors? valuesSummary.map((value, valueIndex, valueArr)=>{
                            let color = stats.graphColors.find((gc, gcIndex, gcArr)=>(value.value >= gc.from && value.value < gc.to) || 
                                (value.value === gc.to && (gcIndex === gcArr.length - 1 || value.value !== gcArr[gcIndex+1].from)))
                            if (!color) {
                                if (value.value === 'other' && valueIndex === valueArr.length - 1) {
                                    color = stats.graphColors.find(graphColor=>graphColor.to ==='other');
                                    if (!color) {
                                        color = {color:'darkgray'};
                                    }
                                } else {
                                    color = stats.graphColors[stats.graphColors.length - 1];
                                }
                            }
                            return color.color;
                        }):'red',
                        data: valuesSummary.map(value=>value.count)
                    }
                ]
                
            },
            options : {
                legend: {
                    display: false,
                },
                scales: {
                    xAxes: [
                        {
                            ticks: {
                                min: 0
                            }
                        }
                    ]
                }
            }
        })
    }
}

// add a line to the legend (color + label)
function addLegendLine(color, label, type) {
    if (!type) {
        type = 'fill';
    }
    const legend = document.querySelector('#legend');
    let svg;
    switch (type) {
        case 'fill':
            svg = `<svg width="30" height="15">
                        <rect width="30" height="15" style="fill:${color};fill-opacity:1;stroke-width:1;stroke:#444"></rect>
                    </svg>`
            break;
        case 'line': 
            svg = `<svg width="30" height="15">
                    <line x1="0" y1="15" x2="30" y2="0" style="stroke:${color};stroke-width:${color.width};" />
                    </svg>`
            break;
        case 'circle':
            svg = `<svg width="12" height="12">
        <circle cx="6" cy="6" r="5" style="fill:${color};fill-opacity:1 stroke-width:1;stroke:white" />
    </svg>` 

    }
    const legendLine = document.createElement('div');
    legendLine.innerHTML = `<div> <span>${svg}</span> <span>${label}<span></div>`
    legend.appendChild(legendLine);
}

// make legend area empty or display 'please wait' message
function prepareLegend() {
    if (globalStats) {
        document.querySelector('#legend').innerHTML = '';
        return true;
    }
    let messageElem = document.querySelector('#legend.message');
    if (messageElem) {
        return false;
    }
    messageElem = document.createElement('div');
    messageElem.classList.add('message');
    messageElem.innerHTML = "waiting for stats, retry later...";
    return false;
}

// applies the (newly) selected colorscheme to map, legend and graphs
function selectColorScheme(schemeIndex)
{
    let schemeDiv = document.querySelector('#colorschemes');
    schemeDiv.querySelectorAll('div').forEach(div=>div.classList.remove('selected'));
    schemeDiv.querySelectorAll('div').forEach((div,index)=>{if (index === schemeIndex) {div.classList.add('selected')}});
    selectedColorScheme = schemeIndex;
    applyLegendToMap();
}

// display the available colorschemes for current scheme type and class number
function updateLegendColorSchemes() {
    let schemeDiv = document.querySelector('#colorschemes');
    schemeDiv.innerHTML = '';
    let classCount = Number(document.querySelector('#classcount').value);
    let schemeType = document.querySelector('input[name="colorscheme"]:checked').value;
    let reversed = document.querySelector('input[name="colorsreversed"]').checked;
    let schemes = getColorSchemes(classCount, schemeType, reversed);
    classCount = schemes[0].colors.length;
    if (selectedColorScheme > schemes.length - 1) {
        selectedColorScheme = schemes.length - 1;
    }
    schemes.forEach((scheme, schemeIndex) => {
        let ramp = document.createElement('div');
        if (schemeIndex === selectedColorScheme) {
            ramp.classList.add('selected');
            selectedColorScheme = schemeIndex;
        }
        let svg = `<svg width="15" height="${classCount * 15}">${
            scheme.colors.map((color, index)=>`<rect fill="${color}" width="15" height="15" y="${index * 15}"></rect>`).join('\n')
        }</svg>`;
        ramp.innerHTML = svg;
        ramp.onclick = ()=>selectColorScheme(schemeIndex);
        schemeDiv.appendChild(ramp);
    })
    applyLegendToMap();
}

// create a map layer definition from the legend and apply it to the map attribute layer
function applyLegendToMap() {
    let classType = document.querySelector('input[name="classtype"]:checked').value;
    let reversed = document.querySelector('input[name="colorsreversed"]').checked;
    if (prepareLegend()) {
        prepareGraphColors(classType);
        let classCount = Number(document.querySelector('#classcount').value);
        if (classCount < 1) {
            // special case, single classification
        } else {
            // classCount > 1
            let layerType = map.getLayer('attrlayer').type;
            let mapboxPaint;
            let schemeType = document.querySelector('input[name="colorscheme"]:checked').value;
            switch(classType) {
                case 'mostfrequent':
                    let schemes = getColorSchemes(classCount, schemeType, reversed);
                    classCount = schemes[0].colors.length;
                    let classValues = globalStats.values.filter(value=>value.value !== null);
                    let needsSlice = classValues.length > classCount;
                    if (needsSlice) {
                        classValues = classValues.slice(0, classCount - 1);
                        let classValuesRowCount = classValues.reduce((result, value)=>result+value.count,0);
                        classValues.push({
                            value:"other", 
                            count: globalStats.rowCount - classValuesRowCount
                        })
                    }
                    mapboxPaint = ["case"];
                    let getFieldValue;
                    if (globalStats.datatype === 'numeric') {
                        getFieldValue = ["to-number", ["get",`${globalStats.column}`], 0]
                    } else {
                        getFieldValue = ["get",`${globalStats.column}`]
                    }
                    classValues.forEach((value, index) => {
                        addLegendLine(schemes[selectedColorScheme].colors[index], value.value, layerType);
                        addGraphColors(schemes[selectedColorScheme].colors[index], value.value, value.value)
                        if (index < classValues.length - 1 || !needsSlice) {
                            if (typeof value.value === 'boolean') {
                                mapboxPaint.push(["==", getFieldValue, value.value])
                            } else {
                                mapboxPaint.push(["all", [">=", getFieldValue, value.value], ["<=", getFieldValue, value.value]])
                            }
                            mapboxPaint.push(schemes[selectedColorScheme].colors[index]);
                        }
                    });
                    let lastColor = schemes[selectedColorScheme].colors[classValues.length -1];
                    if (mapboxPaint.length > 2) {
                        mapboxPaint.push(lastColor);
                    } else {
                        mapboxPaint = lastColor; // single value
                    }
                    break;
                case 'quantile':
                    let percentileBreaks = globalStats.percentiles.reduce((result, percentile)=>{
                        if (result.length === 0) {
                            // result.push({...percentile});
                            result.push(Object.assign({}, percentile));
                            return result;
                        }
                        if (result[result.length - 1].from === percentile.from || (percentile.from instanceof Date && percentile.from.getTime() === result[result.length - 1].from.getTime())) {
                            result[result.length - 1].to = percentile.to;
                            result[result.length - 1].count += percentile.count;
                            return result;
                        }
                        result.push(Object.assign({}, percentile)); 
                        return result;
                    },[]);
                    let seqSchemes = getColorSchemes(classCount, schemeType, reversed);
                    classCount = seqSchemes[selectedColorScheme].colors.length;
                    if (classCount > percentileBreaks.length) {
                        classCount = percentileBreaks.length
                    } else {
                        let totalRowCount = percentileBreaks.reduce((result, percentile)=>result+percentile.count, 0);
                        let rowCountPerClass = totalRowCount / classCount;
                        let sumRowCount = 0;
                        let sumClassCount = 0
                        percentileBreaks = percentileBreaks.reduce((result, percentile)=>{
                            sumRowCount += percentile.count;
                            if (sumRowCount > sumClassCount * rowCountPerClass && result.length < classCount) {
                                // new class
                                result.push(percentile);
                                sumClassCount++;
                            } else {
                                result[result.length - 1].to = percentile.to;
                                result[result.length - 1].count += percentile.count;                                    
                            }
                            return result;
                        },[])
                    }
                    mapboxPaint = ["case"]
                    percentileBreaks.forEach((brk, index, arr)=>{
                        addLegendLine(seqSchemes[selectedColorScheme].colors[index], `${brk.from} - ${brk.to}`, layerType);
                        addGraphColors(seqSchemes[selectedColorScheme].colors[index], brk.from, brk.to);
                        let nextFrom = (index != arr.length-1)?arr[index+1].from:null;
                        if (nextFrom > brk.to) {
                            nextFrom = null;
                        }
                        let compare = (brk.to !== nextFrom)?"<=":"<";
                        if (typeof brk.to == "boolean") {
                            compare = '!=';
                        }
                        if (globalStats.datatype === 'numeric') {
                            mapboxPaint.push([compare,["to-number", ["get", `${globalStats.column}`], 0],brk.to],seqSchemes[selectedColorScheme].colors[index]);
                        } else if (globalStats.datatype === 'timestamptz') {
                            mapboxPaint.push([compare,["get", `${globalStats.column}`],brk.to.toJSON()],seqSchemes[selectedColorScheme].colors[index]);
                        } else {
                            mapboxPaint.push([compare,["get", `${globalStats.column}`],brk.to],seqSchemes[selectedColorScheme].colors[index]);
                        }
                    })
                    mapboxPaint.push(seqSchemes[selectedColorScheme].colors[classCount - 1])
                    break;
                case 'interval':
                    let min = globalStats.percentiles[0].from;
                    let max = globalStats.percentiles[globalStats.percentiles.length - 1].to;
                    if (typeof min === "number") {
                        let intervalSchemes = getColorSchemes(classCount, schemeType, reversed);
                        classCount = intervalSchemes[0].colors.length;
                        let classTicks = getIntervalClassTicks(min, max, classCount);
                        mapboxPaint = ["case"];
                        classTicks.classes.forEach((classStart, index)=>{
                            let legendFrom = classStart;
                            let legendTo = (index === classCount - 1 ? classTicks.max : classTicks.classes[index + 1]);
                            if (globalStats.datatype === 'int4' || globalStats.datatype === 'int8') {
                                legendFrom = Math.floor(legendFrom);
                                legendTo = Math.floor(legendTo);
                            }
                            addLegendLine(intervalSchemes[selectedColorScheme].colors[index], `${(legendFrom)} - ${legendTo}`, layerType);
                            addGraphColors(intervalSchemes[selectedColorScheme].colors[index], legendFrom, legendTo)
                            if (globalStats.datatype === 'numeric') {
                                // convert javscript string to number
                                mapboxPaint.push(["<", ["to-number",["get", globalStats.column], 0],legendTo], intervalSchemes[selectedColorScheme].colors[index]);
                            } else {
                                mapboxPaint.push(["<", ["get", globalStats.column],legendTo], intervalSchemes[selectedColorScheme].colors[index]);
                            }                                
                        })
                        mapboxPaint.push(intervalSchemes[selectedColorScheme].colors[classCount - 1])
                    }
                    break;
            }
            if (mapboxPaint) {
                let displayOutlines = document.querySelector('input[name="displayoutlines"]').checked;
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
                graphStats(globalStats);
            }
        }
    }
}

// enable or disable legend control elements based on attribute stats
function updateLegendControls(stats) {
    // enable or disable controls that apply to these statistics
    let settings = document.querySelector('classification-settings');
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
    if (stats.uniquevalues) {
        settings.setAttribute('nomostfrequent', '');
    } else {
        settings.removeAttribute('nomostfrequent');
    }
}

init();