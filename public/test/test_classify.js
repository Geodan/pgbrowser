import {getColorSchemes} from '../colorbrewer.js';
import colorBrewer from '../colorbrewer.js';
import {classify} from '../classify.js';
import '../map-legend.js';
import '../map-graph.js';
import '../map-legend-config.js';

describe('colorbrewer', ()=>{
    it('testing colorbrewer getColorSchemes', () => {
        let sets = getColorSchemes(22,'div');
        assert.equal(sets.length, 9, 'number of sets');
        assert.equal(sets[0].colors.length, 11, 'number of colors');
        sets = getColorSchemes(1, 'div');
        assert.equal(sets[0].colors.length, 1, 'single color');
        let color = sets[0].colors[0];
        sets = getColorSchemes(1, 'div', true);
        assert.notEqual(sets[0].colors[0], color, 'single color reversed');
        sets = getColorSchemes("2", 'seq', false);
        assert.equal(sets[0].colors.length, 2, 'two colors');
        color = sets[0].colors[0];
        sets = getColorSchemes(2, 'seq', true);
        assert.equal(sets[0].colors[1], color, 'two colors reversed, first and last color should be equal');
        sets = colorBrewer(3, 'qual', false);
        assert.equal(sets[0].colors.length, 3, 'three colors');
        color = sets[0].colors[0];
        sets = colorBrewer(3, 'qual', true);
        assert.equal(sets[0].colors[2], color, 'three colors reversed, first and last should be equal');
        sets = colorBrewer(4, 'seq', false, {blind: 'ok', print: 'ok', screen: 'ok', copy: 'ok'});
        assert.equal(sets.length, 1, 'number of seq sets for all usages');
        assert.equal(sets[0].blind, 'ok', "blind usage should be ok");
        assert.equal(sets[0].print, 'ok', "print usage should be ok");
        assert.equal(sets[0].screen, 'ok', "screen usage should be ok");
        assert.equal(sets[0].copy, 'ok', "copy usage should be ok");
        sets = colorBrewer(5, 'seq', false, {blind: 'maybe', print: 'maybe', screen: 'maybe', copy: 'maybe'});
        assert.equal(sets.length, 1, "number of seq sets for 'maybe' usage");
        assert.equal(sets[0].blind, 'ok', "blind usage should be ok");
        assert.equal(sets[0].print, 'maybe', "print usage should be ok");
        assert.equal(sets[0].screen, 'maybe', "screen usage should be ok");
        assert.equal(sets[0].copy, 'maybe', "copy usage should be ok");
        sets = colorBrewer(5, 'seq', false, {blind: 'bad', print: 'bad', screen: 'bad', copy: 'bad'});
        assert.equal(sets.length, 18, "number of seq sets for 'bad' usage");
        sets = colorBrewer(5, 'seq', false);
        assert.equal(sets.length, 18, "number of seq sets for unspecified usage");
    })
});

describe('classify', ()=>{
    let legend;
    let schemes = getColorSchemes(11, 'qual', false);
    let stats = {"table":"cbs.buurt2017","column":"k_0tot15jaar","datatype":"int4","uniquevalues":100,"allvaluesunique":false,"values":[{"count":1018,"value":0},{"count":666,"value":5},{"count":578,"value":10},{"count":506,"value":15},{"count":495,"value":20},{"count":396,"value":25},{"count":350,"value":30},{"count":315,"value":35},{"count":256,"value":40},{"count":249,"value":50},{"count":241,"value":55},{"count":213,"value":45},{"count":198,"value":65},{"count":187,"value":60},{"count":164,"value":100},{"count":161,"value":70},{"count":155,"value":80},{"count":152,"value":75},{"count":142,"value":90},{"count":141,"value":85},{"count":135,"value":125},{"count":133,"value":110},{"count":128,"value":95},{"count":123,"value":115},{"count":123,"value":140},{"count":122,"value":135},{"count":109,"value":120},{"count":107,"value":130},{"count":98,"value":145},{"count":97,"value":150},{"count":97,"value":155},{"count":95,"value":160},{"count":93,"value":175},{"count":91,"value":105},{"count":89,"value":165},{"count":89,"value":255},{"count":86,"value":180},{"count":86,"value":185},{"count":85,"value":195},{"count":85,"value":205},{"count":84,"value":235},{"count":79,"value":170},{"count":79,"value":215},{"count":77,"value":190},{"count":77,"value":200},{"count":77,"value":225},{"count":77,"value":245},{"count":76,"value":220},{"count":76,"value":240},{"count":75,"value":260},{"count":75,"value":270},{"count":74,"value":210},{"count":69,"value":230},{"count":68,"value":265},{"count":68,"value":280},{"count":67,"value":290},{"count":65,"value":250},{"count":65,"value":300},{"count":62,"value":275},{"count":62,"value":295},{"count":62,"value":350},{"count":61,"value":315},{"count":57,"value":305},{"count":57,"value":310},{"count":52,"value":325},{"count":51,"value":330},{"count":50,"value":365},{"count":48,"value":390},{"count":47,"value":335},{"count":45,"value":285},{"count":45,"value":320},{"count":44,"value":370},{"count":44,"value":410},{"count":43,"value":345},{"count":43,"value":385},{"count":41,"value":340},{"count":41,"value":435},{"count":41,"value":465},{"count":40,"value":360},{"count":40,"value":380},{"count":39,"value":405},{"count":38,"value":355},{"count":38,"value":425},{"count":37,"value":420},{"count":36,"value":375},{"count":36,"value":430},{"count":33,"value":400},{"count":33,"value":440},{"count":33,"value":455},{"count":33,"value":460},{"count":32,"value":415},{"count":32,"value":445},{"count":30,"value":395},{"count":30,"value":535},{"count":28,"value":450},{"count":28,"value":505},{"count":28,"value":530},{"count":27,"value":480},{"count":26,"value":485},{"count":26,"value":495}],"percentiles":[{"from":0,"to":0,"count":133,"percentile":1},{"from":0,"to":0,"count":133,"percentile":2},{"from":0,"to":0,"count":133,"percentile":3},{"from":0,"to":0,"count":133,"percentile":4},{"from":0,"to":0,"count":133,"percentile":5},{"from":0,"to":0,"count":133,"percentile":6},{"from":0,"to":0,"count":133,"percentile":7},{"from":0,"to":5,"count":133,"percentile":8},{"from":5,"to":5,"count":132,"percentile":9},{"from":5,"to":5,"count":132,"percentile":10},{"from":5,"to":5,"count":132,"percentile":11},{"from":5,"to":5,"count":132,"percentile":12},{"from":5,"to":10,"count":132,"percentile":13},{"from":10,"to":10,"count":132,"percentile":14},{"from":10,"to":10,"count":132,"percentile":15},{"from":10,"to":10,"count":132,"percentile":16},{"from":10,"to":10,"count":132,"percentile":17},{"from":10,"to":15,"count":132,"percentile":18},{"from":15,"to":15,"count":132,"percentile":19},{"from":15,"to":15,"count":132,"percentile":20},{"from":15,"to":20,"count":132,"percentile":21},{"from":20,"to":20,"count":132,"percentile":22},{"from":20,"to":20,"count":132,"percentile":23},{"from":20,"to":20,"count":132,"percentile":24},{"from":20,"to":25,"count":132,"percentile":25},{"from":25,"to":25,"count":132,"percentile":26},{"from":25,"to":25,"count":132,"percentile":27},{"from":25,"to":30,"count":132,"percentile":28},{"from":30,"to":30,"count":132,"percentile":29},{"from":30,"to":30,"count":132,"percentile":30},{"from":30,"to":35,"count":132,"percentile":31},{"from":35,"to":35,"count":132,"percentile":32},{"from":35,"to":40,"count":132,"percentile":33},{"from":40,"to":40,"count":132,"percentile":34},{"from":40,"to":45,"count":132,"percentile":35},{"from":45,"to":45,"count":132,"percentile":36},{"from":45,"to":50,"count":132,"percentile":37},{"from":50,"to":50,"count":132,"percentile":38},{"from":50,"to":55,"count":132,"percentile":39},{"from":55,"to":60,"count":132,"percentile":40},{"from":60,"to":60,"count":132,"percentile":41},{"from":60,"to":65,"count":132,"percentile":42},{"from":65,"to":70,"count":132,"percentile":43},{"from":70,"to":70,"count":132,"percentile":44},{"from":70,"to":75,"count":132,"percentile":45},{"from":75,"to":80,"count":132,"percentile":46},{"from":80,"to":85,"count":132,"percentile":47},{"from":85,"to":90,"count":132,"percentile":48},{"from":90,"to":95,"count":132,"percentile":49},{"from":95,"to":100,"count":132,"percentile":50},{"from":100,"to":105,"count":132,"percentile":51},{"from":105,"to":110,"count":132,"percentile":52},{"from":110,"to":115,"count":132,"percentile":53},{"from":115,"to":120,"count":132,"percentile":54},{"from":120,"to":125,"count":132,"percentile":55},{"from":125,"to":130,"count":132,"percentile":56},{"from":130,"to":140,"count":132,"percentile":57},{"from":140,"to":145,"count":132,"percentile":58},{"from":145,"to":150,"count":132,"percentile":59},{"from":150,"to":155,"count":132,"percentile":60},{"from":155,"to":165,"count":132,"percentile":61},{"from":165,"to":170,"count":132,"percentile":62},{"from":170,"to":180,"count":132,"percentile":63},{"from":180,"to":185,"count":132,"percentile":64},{"from":185,"to":195,"count":132,"percentile":65},{"from":195,"to":205,"count":132,"percentile":66},{"from":205,"to":210,"count":132,"percentile":67},{"from":210,"to":220,"count":132,"percentile":68},{"from":220,"to":230,"count":132,"percentile":69},{"from":230,"to":235,"count":132,"percentile":70},{"from":235,"to":245,"count":132,"percentile":71},{"from":245,"to":255,"count":132,"percentile":72},{"from":255,"to":265,"count":132,"percentile":73},{"from":265,"to":270,"count":132,"percentile":74},{"from":270,"to":280,"count":132,"percentile":75},{"from":280,"to":295,"count":132,"percentile":76},{"from":295,"to":305,"count":132,"percentile":77},{"from":305,"to":315,"count":132,"percentile":78},{"from":315,"to":330,"count":132,"percentile":79},{"from":330,"to":345,"count":132,"percentile":80},{"from":345,"to":355,"count":132,"percentile":81},{"from":355,"to":370,"count":132,"percentile":82},{"from":370,"to":390,"count":132,"percentile":83},{"from":390,"to":405,"count":132,"percentile":84},{"from":405,"to":425,"count":132,"percentile":85},{"from":425,"to":440,"count":132,"percentile":86},{"from":440,"to":460,"count":132,"percentile":87},{"from":460,"to":485,"count":132,"percentile":88},{"from":485,"to":515,"count":132,"percentile":89},{"from":515,"to":545,"count":132,"percentile":90},{"from":545,"to":575,"count":132,"percentile":91},{"from":575,"to":615,"count":132,"percentile":92},{"from":615,"to":655,"count":132,"percentile":93},{"from":655,"to":710,"count":132,"percentile":94},{"from":710,"to":770,"count":132,"percentile":95},{"from":770,"to":845,"count":132,"percentile":96},{"from":850,"to":955,"count":132,"percentile":97},{"from":960,"to":1120,"count":132,"percentile":98},{"from":1120,"to":1420,"count":132,"percentile":99},{"from":1430,"to":4670,"count":132,"percentile":100}]};
    let classCount = 11;
    beforeEach(()=>{
        legend = document.createElement('div');
        let svg = `<svg width="15" height="${classCount * 15}">${
            schemes[1].colors.map((color, index)=>`<rect fill="${color}" width="15" height="15" y="${index * 15}"></rect>`).join('\n')
        }</svg>`;
        legend.innerHTML = svg;
        document.body.appendChild(legend);
    });
    afterEach(()=>{
        document.body.removeChild(legend);
    });
    it('testing classifications', ()=>{
        let classInfo = classify(stats, classCount, 'mostfrequent', schemes[1].colors);
        assert.equal(classInfo.classes[5].label, 25, 'label for class[5] should be 25');
        classInfo = classify(stats, 11, 'interval', schemes[1].colors);
        assert.equal(classInfo.classes[5].label, '2120 - 2540', "label for class[5] should be '2120 - 2540'");
    });
})

describe('Legend', () => {
    let stats = {"table":"cbs.buurt2017","column":"k_0tot15jaar","datatype":"int4","datarowcount":13208,"nullrowcount":0,"uniquevalues":100,"allvaluesunique":false,"values":[{"count":1018,"value":0},{"count":666,"value":5},{"count":578,"value":10},{"count":506,"value":15},{"count":495,"value":20},{"count":396,"value":25},{"count":350,"value":30},{"count":315,"value":35},{"count":256,"value":40},{"count":249,"value":50},{"count":241,"value":55},{"count":213,"value":45},{"count":198,"value":65},{"count":187,"value":60},{"count":164,"value":100},{"count":161,"value":70},{"count":155,"value":80},{"count":152,"value":75},{"count":142,"value":90},{"count":141,"value":85},{"count":135,"value":125},{"count":133,"value":110},{"count":128,"value":95},{"count":123,"value":115},{"count":123,"value":140},{"count":122,"value":135},{"count":109,"value":120},{"count":107,"value":130},{"count":98,"value":145},{"count":97,"value":150},{"count":97,"value":155},{"count":95,"value":160},{"count":93,"value":175},{"count":91,"value":105},{"count":89,"value":165},{"count":89,"value":255},{"count":86,"value":180},{"count":86,"value":185},{"count":85,"value":195},{"count":85,"value":205},{"count":84,"value":235},{"count":79,"value":170},{"count":79,"value":215},{"count":77,"value":190},{"count":77,"value":200},{"count":77,"value":225},{"count":77,"value":245},{"count":76,"value":220},{"count":76,"value":240},{"count":75,"value":260},{"count":75,"value":270},{"count":74,"value":210},{"count":69,"value":230},{"count":68,"value":265},{"count":68,"value":280},{"count":67,"value":290},{"count":65,"value":250},{"count":65,"value":300},{"count":62,"value":275},{"count":62,"value":295},{"count":62,"value":350},{"count":61,"value":315},{"count":57,"value":305},{"count":57,"value":310},{"count":52,"value":325},{"count":51,"value":330},{"count":50,"value":365},{"count":48,"value":390},{"count":47,"value":335},{"count":45,"value":285},{"count":45,"value":320},{"count":44,"value":370},{"count":44,"value":410},{"count":43,"value":345},{"count":43,"value":385},{"count":41,"value":340},{"count":41,"value":435},{"count":41,"value":465},{"count":40,"value":360},{"count":40,"value":380},{"count":39,"value":405},{"count":38,"value":355},{"count":38,"value":425},{"count":37,"value":420},{"count":36,"value":375},{"count":36,"value":430},{"count":33,"value":400},{"count":33,"value":440},{"count":33,"value":455},{"count":33,"value":460},{"count":32,"value":415},{"count":32,"value":445},{"count":30,"value":395},{"count":30,"value":535},{"count":28,"value":450},{"count":28,"value":505},{"count":28,"value":530},{"count":27,"value":480},{"count":26,"value":485},{"count":26,"value":495}],"percentiles":[{"from":0,"to":0,"count":133,"percentile":1},{"from":0,"to":0,"count":133,"percentile":2},{"from":0,"to":0,"count":133,"percentile":3},{"from":0,"to":0,"count":133,"percentile":4},{"from":0,"to":0,"count":133,"percentile":5},{"from":0,"to":0,"count":133,"percentile":6},{"from":0,"to":0,"count":133,"percentile":7},{"from":0,"to":5,"count":133,"percentile":8},{"from":5,"to":5,"count":132,"percentile":9},{"from":5,"to":5,"count":132,"percentile":10},{"from":5,"to":5,"count":132,"percentile":11},{"from":5,"to":5,"count":132,"percentile":12},{"from":5,"to":10,"count":132,"percentile":13},{"from":10,"to":10,"count":132,"percentile":14},{"from":10,"to":10,"count":132,"percentile":15},{"from":10,"to":10,"count":132,"percentile":16},{"from":10,"to":10,"count":132,"percentile":17},{"from":10,"to":15,"count":132,"percentile":18},{"from":15,"to":15,"count":132,"percentile":19},{"from":15,"to":15,"count":132,"percentile":20},{"from":15,"to":20,"count":132,"percentile":21},{"from":20,"to":20,"count":132,"percentile":22},{"from":20,"to":20,"count":132,"percentile":23},{"from":20,"to":20,"count":132,"percentile":24},{"from":20,"to":25,"count":132,"percentile":25},{"from":25,"to":25,"count":132,"percentile":26},{"from":25,"to":25,"count":132,"percentile":27},{"from":25,"to":30,"count":132,"percentile":28},{"from":30,"to":30,"count":132,"percentile":29},{"from":30,"to":30,"count":132,"percentile":30},{"from":30,"to":35,"count":132,"percentile":31},{"from":35,"to":35,"count":132,"percentile":32},{"from":35,"to":40,"count":132,"percentile":33},{"from":40,"to":40,"count":132,"percentile":34},{"from":40,"to":45,"count":132,"percentile":35},{"from":45,"to":45,"count":132,"percentile":36},{"from":45,"to":50,"count":132,"percentile":37},{"from":50,"to":50,"count":132,"percentile":38},{"from":50,"to":55,"count":132,"percentile":39},{"from":55,"to":60,"count":132,"percentile":40},{"from":60,"to":60,"count":132,"percentile":41},{"from":60,"to":65,"count":132,"percentile":42},{"from":65,"to":70,"count":132,"percentile":43},{"from":70,"to":70,"count":132,"percentile":44},{"from":70,"to":75,"count":132,"percentile":45},{"from":75,"to":80,"count":132,"percentile":46},{"from":80,"to":85,"count":132,"percentile":47},{"from":85,"to":90,"count":132,"percentile":48},{"from":90,"to":95,"count":132,"percentile":49},{"from":95,"to":100,"count":132,"percentile":50},{"from":100,"to":105,"count":132,"percentile":51},{"from":105,"to":110,"count":132,"percentile":52},{"from":110,"to":115,"count":132,"percentile":53},{"from":115,"to":120,"count":132,"percentile":54},{"from":120,"to":125,"count":132,"percentile":55},{"from":125,"to":130,"count":132,"percentile":56},{"from":130,"to":140,"count":132,"percentile":57},{"from":140,"to":145,"count":132,"percentile":58},{"from":145,"to":150,"count":132,"percentile":59},{"from":150,"to":155,"count":132,"percentile":60},{"from":155,"to":165,"count":132,"percentile":61},{"from":165,"to":170,"count":132,"percentile":62},{"from":170,"to":180,"count":132,"percentile":63},{"from":180,"to":185,"count":132,"percentile":64},{"from":185,"to":195,"count":132,"percentile":65},{"from":195,"to":205,"count":132,"percentile":66},{"from":205,"to":210,"count":132,"percentile":67},{"from":210,"to":220,"count":132,"percentile":68},{"from":220,"to":230,"count":132,"percentile":69},{"from":230,"to":235,"count":132,"percentile":70},{"from":235,"to":245,"count":132,"percentile":71},{"from":245,"to":255,"count":132,"percentile":72},{"from":255,"to":265,"count":132,"percentile":73},{"from":265,"to":270,"count":132,"percentile":74},{"from":270,"to":280,"count":132,"percentile":75},{"from":280,"to":295,"count":132,"percentile":76},{"from":295,"to":305,"count":132,"percentile":77},{"from":305,"to":315,"count":132,"percentile":78},{"from":315,"to":330,"count":132,"percentile":79},{"from":330,"to":345,"count":132,"percentile":80},{"from":345,"to":355,"count":132,"percentile":81},{"from":355,"to":370,"count":132,"percentile":82},{"from":370,"to":390,"count":132,"percentile":83},{"from":390,"to":405,"count":132,"percentile":84},{"from":405,"to":425,"count":132,"percentile":85},{"from":425,"to":440,"count":132,"percentile":86},{"from":440,"to":460,"count":132,"percentile":87},{"from":460,"to":485,"count":132,"percentile":88},{"from":485,"to":515,"count":132,"percentile":89},{"from":515,"to":545,"count":132,"percentile":90},{"from":545,"to":575,"count":132,"percentile":91},{"from":575,"to":615,"count":132,"percentile":92},{"from":615,"to":655,"count":132,"percentile":93},{"from":655,"to":710,"count":132,"percentile":94},{"from":710,"to":770,"count":132,"percentile":95},{"from":770,"to":845,"count":132,"percentile":96},{"from":850,"to":955,"count":132,"percentile":97},{"from":960,"to":1120,"count":132,"percentile":98},{"from":1120,"to":1420,"count":132,"percentile":99},{"from":1430,"to":4670,"count":132,"percentile":100}]};
    console.log(stats);

    let schemes = getColorSchemes(11, 'qual', false);
    let classCount = 11;
    let classInfo = classify(stats, classCount, 'mostfrequent', schemes[1].colors);
    let legend, legendconfig, nodatagraph, valuesgraph, quantilegraph, mostfrequentgraph;
    beforeEach(() => {
        function handleLegendConfigChange(e) {
            let settings = e.detail;
            classCount = settings.classCount;
            classInfo = classify(stats, settings.classCount, settings.classType, settings.colors);
            legend.updateLegend('fill', classInfo);
            nodatagraph.updateGraph('nodata', stats, classInfo);
            valuesgraph.updateGraph('values', stats, classInfo);
            quantilegraph.updateGraph('quantile', stats, classInfo);
            mostfrequentgraph.updateGraph('mostfrequent', stats, classInfo);
        }
        legend = document.createElement('map-legend');
        document.body.appendChild(legend);
        nodatagraph = document.createElement('map-graph');
        nodatagraph.setAttribute('id','nodatagraph')
        document.body.appendChild(nodatagraph);
        valuesgraph = document.createElement('map-graph');
        valuesgraph.setAttribute('id','valuesgraph');
        document.body.appendChild(valuesgraph);
        quantilegraph = document.createElement('map-graph');
        quantilegraph.setAttribute('id','quantilegraph');
        document.body.appendChild(quantilegraph);
        mostfrequentgraph = document.createElement('map-graph');
        mostfrequentgraph.setAttribute('id','mostfrequentgraph');
        document.body.appendChild(mostfrequentgraph);
        legendconfig = document.createElement('map-legend-config');
        legendconfig.onchange = handleLegendConfigChange
        document.body.appendChild(legendconfig);
    })
    it('testing legend', () =>{
        legend.updateLegend('fill', classInfo);
        nodatagraph.updateGraph('nodata', stats, classInfo);
        valuesgraph.updateGraph('values', stats, classInfo);
        quantilegraph.updateGraph('quantile', stats, classInfo);
        mostfrequentgraph.updateGraph('mostfrequent', stats, classInfo);
    })
})

