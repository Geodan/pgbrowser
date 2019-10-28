// downloaded from https://cdn.pika.dev/-/lit-element/2.2.1/dist-es2018/lit-element.min.js
import {LitElement, html, css} from './pika-lit-element.min.js';
import Chart from './node_modules/@ipregistry/chart.js/dist/Chart.esm.js';

/**
* @polymer
* @extends HTMLElement
*/
class MapGraph extends LitElement {
    static get properties() {
        return {
            classInfo: {type: Object, attribute: 'classinfo'},
            graphType: {type: String, attribute: 'graphtype'} // 'nodata', 'values', 'quantiles', 'mostfrequent'
        }
    }
    constructor() {
        super();
        this.classInfo = {};
        this.graphType = 'quantiles';
        this.graph = null;
    }
    static get styles() {
        return css`
            host: {
                display: inline-block;
            }
            div {
                display: inline-block;
                min-width: 350px;
                min-height: 150px;
            }
            canvas {
                width: 100%;
                height: 100%;
            }
        `
    }
    render() {
        return html`
            <!--link rel="stylesheet" type="text/css" href="../node_modules/@ipregistry/chart.js/dist/Chart.esm.js"-->
            <div><canvas></canvas></div>
        `
    }
    updateGraph(graphType, stats, classInfo) {
        let canvas = this.shadowRoot.querySelector('canvas');
        if (!canvas) {
            setTimeout(()=>this.updateGraph(graphType, stats, classInfo), 100);
            return;
        }
        if (graphType) {
            this.graphType = graphType;
        }
        this.classInfo = classInfo;
        if (this.graph) {
            this.graph.destroy();
            this.graph = null;
        }
        switch(this.graphType) {
            case 'nodata':
                this._noDataGraph(canvas, stats, classInfo);
                break;
            case 'values':
                this._valueGraph(canvas, stats, classInfo);
                break;
            case 'quantile':
                this._quantileGraph(canvas, stats, classInfo);
                break;
            case 'mostfrequent':
                this._mostfrequentGraph(canvas, stats, classInfo);
                break;
            default:
                console.error(`unknown graph type: ${this.graphType}`)
        }
    }
    _noDataGraph(canvas, stats, classInfo) {
        this.graph = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: ['no data','data',],
                datasets: [{
                    backgroundColor: ['lightgray', classInfo.classCount?classInfo.classes[classInfo.classCount - 1].paint:'red'],
                    borderColor: 'white',
                    borderWidth: 0,
                    data: [stats.nullrowcount, stats.datarowcount]
                }]
            }
        });
    }
    _valueGraph(canvas, stats, classInfo) {
        if (stats.percentiles.length && typeof(stats.percentiles[0].from) !== 'string') {
            this.graph = new Chart(canvas, {
                type: 'line',
                type: 'line',
            data: {
                labels: stats.percentiles.map((percentile, index, arr)=>Math.round((index/(arr.length - 1)) * 100)),
                datasets: [{
                    backgroundColor: classInfo.classes.length ? stats.percentiles.map((percentile)=>{
                        let classItem = classInfo.classType === 'mostfrequent' ? 
                            classInfo.classes.find(classItem=>percentile.to == classItem.to) : 
                                classInfo.classes.find(classItem=>percentile.to < classItem.to);
                        if (!classItem) {
                            classItem = classInfo.classes[classInfo.classes.length - 1];
                        }
                        return classItem.paint;
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
    }
    _quantileGraph(canvas, stats, classInfo) {
        let labels, data, backgroundColor;
        if (classInfo.classes) {
            // graph counts per legend class
            labels = classInfo.classes.map(c=>c.label);
            backgroundColor = classInfo.classes.map(c=>c.paint);
            data = classInfo.classes.map(c=>0);
            let totalCount = 0;
            classInfo.classes.forEach((classItem,index,arr)=>{
                let nextFrom = (index < arr.length - 1)?arr[index+1].from:null;
                if (nextFrom > classItem.to) {
                    nextFrom = null;
                }
                if (classInfo.classType === "mostfrequent") {
                    let valueInfo = stats.values.find(value=>value.value===classItem.from);
                    if (valueInfo) {
                        data[index] = valueInfo.count;
                        totalCount += valueInfo.count;
                    } else {
                        // other
                        data[index] = stats.datarowcount - totalCount;
                    }
                } else {
                    stats.percentiles.forEach(percentile=>{
                        if (classItem.from <= percentile.from && ((nextFrom !== null && percentile.to < nextFrom) || (nextFrom === null && percentile.to <= classItem.to))) {
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
        this.graph = new Chart(canvas, {
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
        });
    }
    _mostfrequentGraph(canvas, stats, classInfo) {
        let valuesSummary = stats.values.filter(value=>value.value !== null).slice(0,10);
        let valuesSummeryRowCount = valuesSummary.reduce((result, value)=>result+value.count,0);
        if (stats.datarowcount > valuesSummeryRowCount) {
            valuesSummary.push({
                value:"__other__", 
                count: stats.datarowcount - valuesSummeryRowCount
            })
        }
        this.graph = new Chart(canvas, {
            type: "horizontalBar",
            data: {
                labels: valuesSummary.map(value=>value.value),
                datasets: [
                    {
                        backgroundColor: classInfo.classes ? valuesSummary.map((value, valueIndex, valueArr)=>{
                            let classItem = classInfo.classes.find((classItem, ciIndex, ciArr)=>(value.value >= classItem.from && value.value < classItem.to) || 
                                (value.value === classItem.to && (ciIndex === ciArr.length - 1 || value.value !== ciArr[ciIndex+1].from)))
                            if (!classItem) {
                                if (value.value === '__other__' && valueIndex === valueArr.length - 1) {
                                    classItem = classInfo.classes.find(classItem=>classItem.to ==='__other__');
                                    if (!classItem) {
                                        classItem = {paint:'darkgray'};
                                    }
                                } else {
                                    classItem = classInfo.classes[classInfo.classCount - 1];
                                }
                            }
                            return classItem.paint;
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

window.customElements.define('map-graph', MapGraph);