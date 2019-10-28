// downloaded from https://cdn.pika.dev/-/lit-element/2.2.1/dist-es2018/lit-element.min.js
import {LitElement, html, svg, css} from './pika-lit-element.min.js';

/**
* @polymer
* @extends HTMLElement
*/
class MapLegend extends LitElement {
    static get properties() {
        return {
            layerType: {type: String, attribute: 'layertype'}, // fill, circle, line
            classInfo: {type: Object, attribute: 'classinfo'}
        }
    }
    constructor() {
        super();
        this.classInfo = {classes:[]};
        this.layerType = 'fill';
    }
    static get styles() {
        return css`
            host: {
                display: inline-block;
            }
            #legend {
                display: inline-block;
                min-width: 250px;
                padding-left: 5px;
            }
        `
    }
    render() {
        return html`
            <div id="legend">
                ${this.classInfo.classes.map(classItem=>
                    this._renderLegendLine(classItem.paint, classItem.label))}
            </div>
        `
    }
    updateLegend(layerType, classInfo) {
        if (layerType) {
            this.layerType = layerType;
        }
        this.classInfo = classInfo;
    }
    // add a line to the legend (color + label)
    _renderLegendLine(color, label) {
        let legendSvg;
        switch (this.layerType) {
            case 'fill':
                legendSvg = svg`<svg width="30" height="15">
                            <rect width="30" height="15" style="fill:${color};fill-opacity:1;stroke-width:1;stroke:#444"></rect>
                        </svg>`
                break;
            case 'line': 
                legendSvg = svg`<svg width="30" height="15">
                        <line x1="0" y1="15" x2="30" y2="0" style="stroke:${color};stroke-width:${color.width};" />
                        </svg>`
                break;
            case 'circle':
                legendSvg = svg`<svg width="12" height="12">
            <circle cx="6" cy="6" r="5" style="fill:${color};fill-opacity:1 stroke-width:1;stroke:white" />
        </svg>` 
        }
        return html`<div><span>${legendSvg}<span><span>${label}</span></div>`
    }
}

window.customElements.define('map-legend', MapLegend);