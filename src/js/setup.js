/** generate figureConstellationKeys
 * ----------------------------------*/
const allTypesettingClasses = [
['false', 'float-w-col-2', 'float-w-col-4','float-w-col-6', 'inset', 'regular', 'regular-bottom', 'overmargin', 'overmargin-bottom'],
['false', 'float-w-col-2', 'float-w-col-4','float-w-col-6', 'inset', 'regular', 'regular-bottom', 'overmargin', 'overmargin-bottom'],
['false', 'float-w-col-2', 'float-w-col-4','float-w-col-6', 'inset', 'regular', 'regular-bottom', 'overmargin', 'overmargin-bottom']
];

// generate each possible typesettingClass constellation:
let constellationKeys = generateFigConstellationKeys(allTypesettingClasses, "#");
console.log("SETUP \n Generate figConstelleationKeys: ", constellationKeys);

let configurations;
let stats;
let json = "[{";
for (let i = 0; i < constellationKeys.length; i++) {

    let splits = constellationKeys[i].split('#');
    let indexFigBefore = 0;
    let indexCurrentFig = 1
    let indexNextFig = 2;
    let currentFigureSet;
    let nextFigureSet;

    // default:
    currentFigureSet = "[true, false]" + ",";
    nextFigureSet =  "[true, false]";

    // skip false-cases
    if(splits[indexCurrentFig] === "false"
    && splits[indexNextFig] === "false") {
        currentFigureSet = "[false, false]" + ",";
        nextFigureSet = "[false, false]";
    }
    if(splits[indexNextFig] === "false") {
        nextFigureSet = "[false, false]";
    }

    // avoid order: float and overmargin
    if(/float/.test(splits[indexFigBefore])
    && /overmargin/.test(splits[indexCurrentFig])) {
        currentFigureSet = "[false, false]" + ",";
    }
    // avoid order: float and overmargin
    if(/float/.test(splits[indexCurrentFig])
    && /overmargin/.test(splits[indexNextFig])) {
        nextFigureSet = "[false, false]";
    }
    // avoid collision of figCaptions (overmargin -> float)
    if(/overmargin/.test(splits[indexFigBefore])
    && /float/.test(splits[indexCurrentFig])) {
        currentFigureSet = "[true, \"regular-bottom\"]" + ",";
    }
    // avoid collision of figCaptions (overmargin -> float)
    if(/overmargin/.test(splits[indexCurrentFig])
    && /float/.test(splits[indexNextFig])) {
        currentFigureSet = "[true, \"overmargin-bottom\"]" + ",";
        nextFigureSet = "[true, false]";
    }
    // avoid collision of figCaptions (overmargin -> overmargin)
    if(/overmargin/.test(splits[indexFigBefore])
    && /overmargin/.test(splits[indexCurrentFig])) {
        currentFigureSet = "[true, \"regular-bottom\"]" + ",";
    }
    // avoid collision of figCaptions (overmargin -> overmargin)
    if(/overmargin/.test(splits[indexCurrentFig])
    && /overmargin/.test(splits[indexNextFig])) {
        currentFigureSet = "[true, \"overmargin-bottom\"]" + ",";
        nextFigureSet = "[true, \"overmargin-bottom\"]";
    }
    // second overmargin-figure is last figure at page bottom
    if(/overmargin/.test(splits[indexNextFig])) {
        nextFigureSet = "[true, \"overmargin-bottom\"]";
    }
    // avoid three floating figure on one page:
    if(/float/.test(splits[indexFigBefore])
    && /float/.test(splits[indexCurrentFig])
    && /float/.test(splits[indexNextFig])) {
        currentFigureSet = "[true, false]" + ",";
        nextFigureSet = "[false, false]";
    }

    // avoiding three figures on one page at all:
    if(splits[indexFigBefore] !== "false"
    && splits[indexCurrentFig] !== "false"
    && splits[indexNextFig] !== "false") {
        currentFigureSet = "[false, false]" + ",";
        nextFigureSet = "[false, false]";
    }

    /*MISSING: big figure alone -> figCap: bottom*/
    stats = "\"" + splits.join("#") + "\": {";
    stats += "\"currentFigure\":" + currentFigureSet;
    stats += "\"nextFigure\":" + nextFigureSet;
    stats +=  "},";
    json += stats;
}

json += "}]";
console.log(json);

    /*
    !pageBottomArea!
        if(contexts["elementSetBefore"].tagName === "FIGURE"
        && /float/.test(contexts["elementSetBefore"].className)) {
            addFigIdToNextParagraph(sourceNode.id, firstFigure.id);
        };

     /* test fixing overlapping float-margins
        if(/float/.test(firstFigure.className) && /float/.test(secondFigure.className)) {
            secondFigure.style.marginBottom = firstFigure.style.marginBottom;
        }
     */

function generateFigConstellationKeys(array, separator) {

    const result = [];
    let allCasesRest;

    // by cartesian product algorithm:
    if (array.length == 1) {
        return array[0];
    }
    else {
        allCasesRest = generateFigConstellationKeys(array.slice(1), separator);
        for (let i = 0; i < allCasesRest.length; i++) {
            for (let j = 0; j < array[0].length; j++) {
                result.push(array[0][j] + separator + allCasesRest[i]);
            }
        }
        return result;
    }
}