/**
 * @description
 * gets an array of colorbrewer color schemes for the given number of classes and color scheme type
 * @param {number} numClasses
 * number of classes to get colors for
 * @param {string} schemeType
 * the color scheme type. Qualitative: 'qual' or divergent: 'div' or sequential: 'seq'
 * @param {boolean} reversed
 * true if colors in the scheme should be reversed in order
 * @param {Object<{blind:'bad', print:'bad', screen:'bad',copy:'bad'}>}
 * requested usage properties, 'bad': not important, 'maybe'
 * @returns {Array.<{colors:[]}>}
 * Array of color schemes [{colors:[]}]
 */
function getColorSchemes(numClasses, schemeType, reversed, usage) {
    let result = [{colors:['#ff0000']}];
    if (numClasses <= 2) {
        result = colorbrewer.filter(scheme=>scheme.type===schemeType)
            .map(scheme=>{
                let result = Object.assign({},scheme.sets[0]);
                let colors = result.colors.map(c=>c);
                result.colors = [colors[2]];
                if (numClasses === 2) {
                    result.colors.unshift(colors[0]);
                }
                result.name = scheme.name;
                result.type = scheme.type;
                return result;
            });
    }
    for (; numClasses > 2; numClasses--) {
        result = colorbrewer.filter(scheme=>scheme.type===schemeType && scheme.sets.length > numClasses - 3)
            .map(scheme=>{
                let result = Object.assign({}, scheme.sets[numClasses - 3]);
                result.name = scheme.name;
                result.type = scheme.type;
                return result;
            });
    }
    if (result.length) {
        if (reversed) {
            result.forEach(scheme=>scheme.colors = scheme.colors.map(c=>c).reverse())
        }
    }
    return result;
}


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
        this.classSpecs = {        
            classType: 'mostfrequent', // mostfrequent, quantile, interval
            classCount: 1, // number of classes,
            colorSchemeType: 'qual', // qual, seq, div
            classes: [{
                from: 'lowestvalue',
                to: 'highestvalue',
                color: 'red',
                label: 'label', // class label
            }] // array of classes
        }
    }

    setStats(stats) {
        this.stats = stats;
    }
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
function classify(stats, classCount, classType, paintValues) {
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

