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
            classInfo: {type: Array, attribute: 'classinfo'},
            graphType: {type: Array, attribute: 'graphtype'} // 'nodata', 'values', 'quantiles', 'mostfrequent'
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
                display: block;
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
                break;
            case 'quantile':
                break;
            case 'mostfrequent':
                break;
            default:
                console.error(`unknown graph type: ${this.graphType}`)
        }
    }
    _noDataGraph(canvas, stats, classInfo) {
        let nullValues = stats.values.filter(value=>value.value === null).reduce((result, value)=>result+value.count,0);
        let rowCount = stats.percentiles.reduce((result, percentile)=>result + percentile.count, 0);
        this.graph = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: ['no data','data',],
                datasets: [{
                    backgroundColor: ['lightgray', 'red'],
                    borderColor: 'white',
                    borderWidth: 0,
                    data: [nullValues, rowCount]
                }]
            }
        });
    }
}

window.customElements.define('map-graph', MapGraph);