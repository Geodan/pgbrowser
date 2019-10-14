


class AttributeStats {
    constructor() {
        this.stats = {
            table: "", // name of attribute source
            column: "", // attribute name
            datatype: "", // database datatype, 'varchar', 'numeric', 'int8', 'timestamptz' ...
            numvalues: 0, // number of most frequent values, max 101
            values: [{ // array of most frequent values + null values, ordered by count
                count: 0, // count of values
                value: null // value
            }], // array of values, ordered by frequency
            percentiles: [{
                from: 'lowestvalue',
                to: 'highestvalue',
                count: 0, // number of values in this percentile
                percentile: 1 // percentile order number
            }], // array of percentiles, max 100
            uniquevalues: false, // true if all values are unique
        }
        /*this.classSpecs = {        
            classType: 'mostfrequent', // mostfrequent, quantile, interval
            classCount: 1, // number of classes,
            colorSchemeType: 'qual', // qual, seq, div
            classes: [{
                from: 'lowestvalue',
                to: 'highestvalue',
                color: 'red',
                label: 'label', // class label
            }] // array of classes
        }*/
    }

    setStats(stats) {
        this.stats = stats;
    }
}

function roundToPrecision(number, precision, direction) {
    let negative = (number < 0);
    if (negative) {
        number = -number;
        direction = -direction;
    }
    let roundFunc = (direction < 0 ? Math.floor : direction === 0 ? Math.round : Math.ceil);
    let exponent = (number === 0)?1:Math.floor(Math.log10(number));
    let decimals = (exponent < precision)? precision - exponent : 0;
    let fraction = number / Math.pow(10,exponent);
    return Number((Math.pow(10, exponent) * roundFunc(fraction * Math.pow(10, precision)) / Math.pow(10, precision) * (negative ? -1 : 1)).toFixed(decimals));
}

export function getIntervalClassTicks (min, max, classCount) {
    let niceMin = roundToPrecision(min, 2, -1);
    let niceMax = roundToPrecision(max, 2, 1);
    let interval = (niceMax - niceMin) / classCount;
    let result = [];
    for (let i = 0; i < classCount; i++) {
        result.push(roundToPrecision(niceMin + i * interval, 2, -1))
    }
    return {
        min: niceMin,
        max: niceMax,
        classes: result
    };
}

/**
 * @description
 * creates array of class objects {from, to, label, paintValue}
 * @param {object} stats
 * Input attribute data statistics.
 * @param {number} classCount
 * (Maximum) number of classes to generate
 * @param {string} classType
 * Type of classification: 'mostfrequent' or 'quantile' or 'interval'
 * @param {array} paintValues
 * Array of paintValues (colors or linewidths or circle radii) to assign to classes
 * @returns {array}
 * Array of class obects [{from, to, label, paint}]
 */
export function classify(stats, classCount, classType, paintValues) {
    let resultClasses = [];
    if (paintValues.length < classCount) {
        classCount = paintValues.length;
    }
    switch(classType) {
        case 'mostfrequent':
            let classValues = stats.values.filter(value=>value.value !== null);
            let needsSlice = classValues.length > classCount;
            if (needsSlice) {
                classValues = classValues.slice(0, classCount - 1);
                let classValuesRowCount = classValues.reduce((result, value)=>result+value.count,0);
                classValues.push({
                    value:"__other__", 
                    count: stats.rowCount - classValuesRowCount
                })
            }
            classValues.forEach((value, index) => {
                resultClasses.push({from: value.value, to: value.value, label: value.value, paint: paintValues[index]});
            });
            break;
        case 'quantile':
            let percentileBreaks = stats.percentiles.reduce((result, percentile)=>{
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
            if (classCount > percentileBreaks.length) {
                classCount = percentileBreaks.length;
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
            percentileBreaks.forEach((brk, index)=>{
                resultClasses.push({from: brk.from, to: brk.to, label: `${brk.from} - ${brk.to}`, paint: paintValues[index]})
            })
            break;
        case 'interval':
            let min = stats.percentiles[0].from;
            let max = stats.percentiles.length > 1 ? stats.percentiles[stats.percentiles.length - 1].to : min;
            if (typeof min === "number") {
                let classTicks = getIntervalClassTicks(min, max, classCount);
                classTicks.classes.forEach((classStart, index)=>{
                    let legendFrom = classStart;
                    let legendTo = (index === classCount - 1 ? classTicks.max : classTicks.classes[index + 1]);
                    if (stats.datatype === 'int4' || stats.datatype === 'int8') {
                        legendFrom = Math.floor(legendFrom);
                        legendTo = Math.floor(legendTo);
                    }
                    resultClasses.push({from: legendFrom, to: legendTo, label: `${(legendFrom)} - ${legendTo}`, paint: paintValues[index]});                    
                })
            }
            break;
        default: 
            resultClasses.push({from:'', to:'', label: `unsupported classType: ${classType}`, paint: paintValues[0]});
    }
    return resultClasses;
}

export default classify;
