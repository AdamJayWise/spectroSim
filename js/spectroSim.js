/**
 * So whats' going to go here... 
 * I want to show comparison of spectra taken with different cameras to start
 * the end product will be different spectra plotted on the same axis with the bayesian thing where you overlay many
 * semitransparent traces to give an idea of confidence
 * 
 * cast of characters:
 * so there will be a spectra/image object that holds data
 *  so there is a 1D array? with some image height and it has ground truth intensity for each pixel 
 *  
 *  Actually there is a spectrumGenerator object that has a list of gaussians.  Then you provide it with a bandwidth and num pixels
 *  and it will create a ground truth spectrum object
 * 
 * 
 * there will be a sample (camera?) object that turns data to lines via a plot method
 * there will be a viz object that manages the  
 * 
 * 
 * next task - make a detector GUI object that will handle changing parameters
 * so... maybe a box that spawns detectors based on camera / spectrometer choice?
 * a detector factory, where there's one pulldown for camera and one for spectrometer
 * 
 * I want to re-scale the x axis into wavelength...
 * lets start by creating adjustable x bounds
 * 
 * ok so how to make this reasonable... 
 * first, need to get better estimates of dispersion
 * need to add a center wavelength input
 * need to copy over code for calculating spectrometer stuff
 * 
 * ok right now the program is calculating the spectra in terms of detector position in mm
 * how can I recast to use wavelength?  Or do I even want to? (I do)
 * 
 * So I'd like to add a way for the user to add peaks... 
 * a text box that lets you add comma separate cwls would be fine
 * alternatively, give them an option to add triplets of (amp, cwl, width) on different lines
 * 
 */

 console.log('spectroSim.js - Adam Wise 10/2020')

 // color map

 var colors = [
     'blue',
     'green',
     'red',
     'gray',
     'orange',
     'black',
     'cyan',
     'darkPink'
 ]

 // ========================================= filter camera definitions =======================

 var c = {};
 var cameraKeys = Object.keys(cameraDefs);
 cameraKeys.forEach(function(k){
     var include = 1;
     
     include = include & !Boolean(cameraDefs[k].hed);  // is camera HED? if so, exclude
     include = include & ( (cameraDefs[k].xPixelSize * cameraDefs[k].xPixels/1000) < 27 );

     if (include){
         c[k] = cameraDefs[k];
     }
     

 })

 cameraDefs = c;

 // ========================================= grating object ==================================

 var gratingRules = [150, 300, 600, 900, 1200, 1800, 2400]
 var gratings = {};
 gratingRules.forEach(function(r){
    gratings[String(r) + ' lines / mm'] = {'rule' : r}; 
 })

 // ========================================= app variables ===================================

 var app = {
     'debug' : 1, // 
     'nSamples' : 1, // how many traces to draw per detector
     'graphMinXmm' : 0, // minimum x value of plot field of view (focal plane) in mm,
     'graphMaxXmm' : 5, // minimum x value of plot field of view (focal plane) in mm,
     'graphMinXnm' : 300, // minimum x value of plot field of view (focal plane) in mm,
     'graphMaxXnm' : 700, // minimum x value of plot field of view (focal plane) in mm,
     'svgWidth' : 700,
     'svgHeight' : 280,
     'graphYMin' : -20,
     'graphYMax' : 2000,
     'scaleTraces' : 0, // correct intensity of traces by factor of 1/pixelsize to account for splitting counts

     'svg' : d3.select('svg'),
     'graphMarginX' : 70,
     'graphMarginY' : 50,
     'targetDispersion' : 20, // disperions for x axis in nm/mm.  sets scale of x axis

     //spectrometer controls
     'centerWavelength' : 500,
     'slitWidth' : 10, // slit width in microns

     // options for calculation
     'includeSpectrometerThroughput' : 0,
     'includeSensorQE' : 0,
     'includeNoise' : 0,
     'includeMirrorEff' : 0,
     'includeGratingQE' : 0,

     // options for display
     'offSetTraces' : 0,
     'indexCounter' : 0,
     'autoScaleY' : 1,

     //info for autoscale
     'yMaxGlobal' : 0,

     // misc options
     'flatSpectralInput' : 0,
     
 }

// make the svg full width if possible
app.svgWidth = window.innerWidth * 0.95;

 // ========================================= General Purpose Functions ===================================

 function calculateTilt(obj){
    sinTilt = 10**-6 * obj.centerWavelength * obj.grooveDensity / (-2 * Math.cos( (2 * Math.PI) * obj.deviationAngle / 360  ))
    return 360 * Math.asin(sinTilt) / (2 * Math.PI)
}

function deg(angleInRadians){
    return 360 * angleInRadians / ( 2 * Math.PI )
}

function rad(angleInDegrees){
    return 2 * Math.PI * angleInDegrees / ( 360 )
}


function calcPixFactor(pixwidth){
    if (pixwidth<14) return 1
    if ( (pixwidth>=14) & (pixwidth<=50) ) return 0.4338*(pixwidth**0.3253);
    if (pixwidth>50) return 1.55
}

 // gaussian function
 function g(x, mu = 0, sig = 1){
    return Math.exp( -1*(x-mu)**2 / sig**2)
 }

 // erf approximation
 function erf(x){

    var s = Math.sign(x);
    x = Math.abs(x);

     return s*(1 - 1/(1 + 0.278383*x + 0.230389*x**2 + 0.000972 * x**3 + 0.078108*x**4)**4);
 }

 // Standard Normal variate using Box-Muller transform.
function randBM() {
    var u = 0, v = 0;
    while(u === 0) u = Math.random(); //Converting [0,1) to (0,1)
    while(v === 0) v = Math.random();
    return Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
}

 // Knuth low-lambda Poisson random sample generator
function poissonSample( lambda = 1){
    var output = 0

    if (lambda > 30){
        return Math.sqrt(lambda) * randBM() + lambda
    }

    // if lambda = 0, return array of zeros
    if (lambda <= 0 || isNaN(lambda)){
        return output;
    }

    var l = Math.exp(-lambda);
    var k = 0;
    var p = 1;

    while(p>l){
        k++;
        p = p*Math.random();
    }
    
   return Math.max(k-1,0);
 
}

 // ========================================= Class Declarations ===================================

 class SpectrumGenerator {
     constructor(peakList, height = 1) {
         this.peakList = peakList;
         this.height = height;
     }

     createSpectrumDataObject(camConfigObj, spectrometerConfigObj, gratingConfigObj, opticalInfoObj = {}) {
         if (app.debug){console.log('createSpectrumDataObject called')};
         
         var dataArray = [];
         
         var yMaxLocal = 0;

         dataArray.length = camConfigObj['xPixels'];
         var pixelSize = camConfigObj['xPixelSize'];
         var dispersion = opticalInfoObj.linearDispersion;
         var sensorWidthmm = camConfigObj.xPixelSize * camConfigObj.xPixels / 1000;
         dataArray.fill(0);

        // if the flat option is selection, just return a filled array
        if (app.flatSpectralInput){
            dataArray.fill(100);
            return {'data':dataArray, 'yMaxLocal' : yMaxLocal, 'yMaxGlobal' : 110}
        }

         // add the contribution from each peak
         for (var k in this.peakList){
            if ( (this.peakList[k]['mu'] > app.graphMinXnm) & (this.peakList[k]['mu'] < app.graphMaxXnm) ){
                //if (app.debug){console.log('adding ',k, this.peakList[k], camConfigObj)}
                for (var i =0; i < dataArray.length; i++){
                    // calculate the integral for each pixel.  E.g. for pixel one, it'll be 0:pixelwidth, then for pixel 2 it'll be pixelwidth : 2*pixelwidth and so on
                    // the integral will be erf(a)-erf(b).  estabilish a cutoff at which you won't want to calc erf?
                    // so...
                    var a0 = this.peakList[k]['a']; // scale value by height of peak
                    var mu = (this.peakList[k]['mu'] - app.centerWavelength)/dispersion + sensorWidthmm/2; // mu in mm
                    var intensifierPSF = 0;
                    if (camConfigObj.intensified){intensifierPSF = camConfigObj.intensifierRes}
                    var sig = Math.sqrt( (this.peakList[k]['sigma'] / (2.355 * dispersion))**2 + (spectrometerConfigObj['psf']/(2.355*1000))**2 + (intensifierPSF/2.355*1000)**2  );
                    // right now sigma is kinda mixed between nm and mm... I need to turn the sigma from the peak into mm
                    var x0 = ( (i+0) * pixelSize / 1000) - mu;
                    var x1 = ( (i+1) * pixelSize / 1000) - mu;
                    dataArray[i] += a0 * ( erf(x1/sig) - erf(x0/sig) );

                //dataArray[i] +=  this.peakList[k]['a'] * g(i * pixelSize / 1000, this.peakList[k]['mu'], this.peakList[k]['sigma'])
             }
         }
        }
         return {'data':dataArray, 'yMaxLocal' : yMaxLocal, 'yMaxGlobal' : dataArray.reduce((a,b)=>Math.max(a,b))}
     }
 }

 class Detector {
     constructor(camConfigObj, spectrometerConfigObj, gratingConfigObj, spectrumGenerator){
        this.camConfigObj = camConfigObj;
        this.sensorObj = models[this.camConfigObj.sensorType]; // sensor object for QE calculation
        this.spectrometerConfigObj = spectrometerConfigObj;
        this.gratingConfigObj = gratingConfigObj;
        this.paths = [];
        this.svg = app.svg;
        this.g = this.svg.append('g')
        this.line = d3.line().x(function(d,i){return i/10}).y(function(d){return d})
        this.spectrumGenerator = spectrumGenerator;
        this.opticalInfoObj = {}
        this.graphIndex = app.indexCounter;
        app.indexCounter += 1;
     }

     updateParams(){
        this.tiltAngle = calculateTilt({'grooveDensity' : this.gratingConfigObj.rule , 'deviationAngle' : this.spectrometerConfigObj.dev, 'centerWavelength' : app.centerWavelength})
        this.opticalInfoObj = calcWavelengthRange(app.centerWavelength, this.gratingConfigObj.rule, this.spectrometerConfigObj.dev, this.spectrometerConfigObj.fl, this.tiltAngle, this.spectrometerConfigObj.fpt, this.camConfigObj.xPixels, this.camConfigObj.xPixelSize )
        this.spectrum = this.spectrumGenerator.createSpectrumDataObject(this.camConfigObj, this.spectrometerConfigObj, this.gratingConfigObj, this.opticalInfoObj);

    }

     draw(){


        // check tilt, if it's ok remove any tilt error styling and continue, otherwise style as error and do not draw
        if (this.tiltAngle >= -35){
            if (this.legendEntry){
                this.legendEntry.classed('tiltError', false)
            }
        }

        if (this.tiltAngle < -35){
            if (this.legendEntry){
                this.legendEntry.classed('tiltError', true)
            }
            return
            
        }

        if (this.active==0){
            return
        }

         if (app.debug == 1){
            console.log('drawing')
         }
         var xShift = 0;//-1 * this.camera.xPixelSize/1000
         var dispersion = this.opticalInfoObj.linearDispersion;
         var scaleX = d3.scaleLinear().domain([app.graphMinXnm, app.graphMaxXnm]).range([0 + app.graphMarginX , app.svgWidth - app.graphMarginX])
         
         var yScaleFactor = 1;
         if (app['scaleTraces']) {yScaleFactor = 25/this.camConfigObj.xPixelSize}; 

         var yOffset = 0;
         
         if (app['offSetTraces']){
             yOffset = this.graphIndex * 3 ;
         }
         
         if (app.debug){console.log('offset is', yOffset)}

         var scaleY = d3.scaleLinear()
            .domain( [app['graphYMin'] / yScaleFactor, app['graphYMax'] / yScaleFactor ])
            .range([app['svgHeight'] - app.graphMarginY - yOffset, 0 + app.graphMarginY - yOffset]);
         
         // scaleX is nm->pixels, the function inside is in mm-nm
         // for pixel -> nm, first go pixel->mm, pixel at 1/2 width should give center wavelength, yikes
         var sensorHalfWidthPx = this.camConfigObj.xPixels/2
         
         // break up x scaling into two steps, detector pixel -> nm, then nm -> svg position
         var pix2nm = i => app.centerWavelength + (0.5 + i - sensorHalfWidthPx)*this.camConfigObj.xPixelSize/1000 * dispersion;
         var xScaleFunc = (d,i)=>scaleX(pix2nm(i));
         
         
         this.line.x(xScaleFunc);
         this.line.y(d=>scaleY(d))
         var sensorObj = this.sensorObj;

         

         // draw random samples based on ground truth
         for (var q = 0; q < app['nSamples']; q++){

            var measuredData = this.spectrum.data;

            // apply sensor QE
            if (app.includeSensorQE){
                console.log('considering sensor qe')
                measuredData = measuredData.map(function(v,i){
                //console.log(v * sensorObj.getQE(pix2nm(i)))
                return (v * sensorObj.getQE(pix2nm(i))) | 0
                })
            }

            // if camera is not ideal, use poisson sampling to simulate shot noise
            if (app['includeNoise']){
                measuredData = measuredData.map(poissonSample)
                measuredData = measuredData.map(d=>d + (this.camConfigObj.readNoise * randBM()) )
            }

            
            //var measuredData = this.spectrum.data;
            var newPath = this.svg.append('path')
            this.paths.push(newPath);
            newPath.style('stroke-opacity', 2 * 1/app['nSamples'])
            newPath.attr('d', this.line(measuredData))
            newPath.attr('clip-path','url(#clipPath)')
            newPath.style('stroke', this.graphColor)
            newPath.style('fill', this.graphColor)
            newPath.style('fill-opacity', 0.01)
            newPath.classed('graphPath', true)
         }
     }

     erase(){
         this.paths.forEach(f=>f.remove())
     }
 }

class DetectorGroup {
    constructor(){
        this.detectors = [];
    }

    add(d){
        this.detectors.push(d);
    }

    update(){

        // first, update the data for each spectrum
        this.detectors.forEach(function(d){
            d.updateParams();
        })

        if (app.autoScaleY){
            app.graphYMax = 10;
            this.detectors.forEach(function(d){
                if( d.active & (d.spectrum.yMaxGlobal > app.graphYMax)){
                    app.graphYMax = d.spectrum.yMaxGlobal;
                }
            })
        }

        updateAxes();
        this.detectors.forEach(function(d){
            d.erase();
            d.draw();
        })
    }
}

 // ======================= Grating Equation Code ======================================

 function calcWavelengthRange(cwl, rule, dev, fl, tilt, fpt, xPixels, xPixelSize){
     if (app.debug){
        console.log(cwl, rule, dev, fl, tilt, fpt, xPixels, xPixelSize)
     }
    // first calculate the sensor size in mm, from pixel size in microns
    var sensorSize = xPixels * xPixelSize / 1000;
    // calculate the angle of the incident and diffracted rays relative to the grating normal
    var thetaInc = dev - tilt;
    var thetaRefr = dev + tilt;
    var tiltFactor = Math.cos(rad(fpt));
    // calculate the difference in angle of the rays hitting the edge of the camera chip relative to the center wavelength
    var thetaDiff = Math.atan( sensorSize/2 / fl); // for whatever reason the original andor #s don't inlcude fpt here
    var startWavelength  = 10**6 * (1/rule) * ( Math.sin(rad(thetaInc)) - Math.sin(rad(thetaRefr) + thetaDiff) ) ;
    

    // calculate the startWavelength + 1 pixel
    var thetaDiffPlusOne = Math.atan( (sensorSize/2 - xPixelSize/1000) / fl);
    var startWavelengthPlusOne = 10**6 * (1/rule) * ( Math.sin(rad(thetaInc)) - Math.sin(rad(thetaRefr) + thetaDiffPlusOne) ) ;
    
    if (app.debug){ console.log( (startWavelength-startWavelengthPlusOne) / (xPixelSize/1000) ) }

    var endWavelength = 10**6 * (1/rule) * ( Math.sin(rad(thetaInc)) - Math.sin(rad(thetaRefr) - thetaDiff) ) ;
    
    // calculate the startWavelength + 1 pixel
    var thetaDiffPlusOne = Math.atan( (sensorSize/2 - xPixelSize/1000) / fl);
    var endWavelengthMinusOne = 10**6 * (1/rule) * ( Math.sin(rad(thetaInc)) - Math.sin(rad(thetaRefr) - thetaDiffPlusOne) ) ;
    
    if (app.debug){ console.log('bandwidth?', (endWavelength - endWavelengthMinusOne) / (xPixelSize/1000) ) }
    
    var bandWidth = (endWavelength - startWavelength) * tiltFactor ;
    
    var linearDispersion = bandWidth / sensorSize;
    
    return {'startWavelength' : startWavelength,
            'endWavelength' : endWavelength,
            'bandWidth' : bandWidth,
            'linearDispersion' : linearDispersion,
            };
 }

 // ============================ Generate Spectrum ========================================================

 var spectra = 0
 var data1 = 0;

 peakList1 = [
                {'a' :5000, 'mu':450, 'sigma':20},
                {'a' :500, 'mu':515, 'sigma':0.01},
                {'a' :500, 'mu':515.1, 'sigma':0.01},
                {'a' :500, 'mu':516, 'sigma':0.01},
                {'a' :2000, 'mu':600, 'sigma':4},
                {'a' :1800, 'mu':550, 'sigma':0.00001},
                {'a' :1800, 'mu':500.5, 'sigma':0.00001},
                {'a' :1800, 'mu':490, 'sigma':0.00001},
            ]

/*
for (var i = 0; i<100; i++){
    peakList1.push({'a':20, 'mu':300 + i*10, 'sigma' : 0.00001})
}
*/

 spectrumGen1 = new SpectrumGenerator(peakList = peakList1)

// =======================================================================================

/// now I need to create an SVG canvas and draw the spectrum to it


var mainSvg = d3.select('#svgContainer').append('svg').style('height', app.svgHeight).style('width',app.svgWidth)
app.svg = mainSvg;

// create a clippath to establish drawing area of svg
var clipPath = app.svg.append('clipPath')
clipPath.attr('id','clipPath')
clipPath.append('rect')
    .attr('x', app.graphMarginX + 'px')
    .attr('y', app.graphMarginY + 'px')
    .attr('width', app.svgWidth - 2*app.graphMarginX + 'px')
    .attr('height', app.svgHeight - 2*app.graphMarginY  + 'px')


/// create a new detector configuration and detector

var idealSpectrometer = spectrometers['Ideal Imaging System'];


var idealCamConfig = {'readNoise' : 0, 'xPixels' : 2000, 'xPixelSize' : 1, 'ideal' : true,}

//
var allDetectors = new DetectorGroup();


// detector factory goes here
var detectorFactoryDiv = d3.select('#detectorFactory')

var cameraSelect = detectorFactoryDiv.append('select')
cameraSelect
    .selectAll('option')
    .data(Object.keys(cameraDefs).sort(function(a,b){
            var al = cameraDefs[a].displayName.toLowerCase();
            var bl = cameraDefs[b].displayName.toLowerCase();
            if(al==bl){return 0}
            if(al>bl){return 1}
            return -1
    }))
    .enter()
    .append('option')
    .attr('value',d=>d)
    .text(d=>cameraDefs[d]['displayName'])

var spectrometerSelect = detectorFactoryDiv.append('select')
spectrometerSelect
    .selectAll('option')
    .data(Object.keys(spectrometers).sort())
    .enter()
    .append('option')
    .attr('value',d=>d)
    .text(d=>spectrometers[d]['displayName'])

var gratingSelect = detectorFactoryDiv.append('select')
gratingSelect
    .selectAll('option')
    .data(Object.keys(gratings))
    .enter()
    .append('option')
    .attr('value',d=>d)
    .text(d=>d)

var createDetectorButton = detectorFactoryDiv.append('button')
createDetectorButton.text('Create New Detector')

// callback for creating a new detector
createDetectorButton.on('click', function(){
    
    if (app.debug) { console.log('Creating New Detector') }

    var newCamObj = cameraDefs[cameraSelect.property('value')];
    var newSpecObj = spectrometers[spectrometerSelect.property('value')];
    var newGratingObj = gratings[gratingSelect.property('value')];

    var newDetector = new Detector(newCamObj, newSpecObj, newGratingObj, spectrumGen1);
    newDetector.updateParams();
    
    if (app.debug){console.log('tilt angle is', newDetector.tiltAngle)}
    if (newDetector.tiltAngle < -32 | isNaN(newDetector.tiltAngle)){
        console.log('grating tilt too large')
        alert('Grating tilt too large - try a grating with less lines per mm, or a longer focal length spectrometer')
        return 
    }

    if (app.debug){ console.log(newSpecObj)}
    
    
    newDetector.graphColor = colors[newDetector.graphIndex % colors.length];
    //newDetector.graphColor = `hsl(${ 10 * Math.round(Math.random()*36) },100%,${2*Math.round(Math.random()*10) + 40 }%)`
    newDetector.active = 1;// this is a hack for display, fix eventually
    
    allDetectors.add(newDetector);
    allDetectors.update(); 
    //newDetector.draw();
    //cameras.push(newDetector)
    //cameras.forEach(f=>f.erase())
    //cameras.forEach(f=>f.draw())


    var newLabel = d3.select('#labelContainer').append('div')
    newDetector.legendEntry = newLabel;
    
    newLabel
        .append('span')
        .classed('detectorLegendItem',true)
        .html('&emsp;')
        .style('color', newDetector.graphColor)

    newLabel
        .append('span')
        .text('  ' + newCamObj['displayName'] + ' - ' + newSpecObj['displayName'] + ' - ' + newGratingObj['rule'] + ' lines / mm')
             
    newLabel
        .classed('detectorLabel',true)
        .on('click', function(){
            newDetector.erase();
            newDetector.active = 0;
            this.remove()
        })

})


// add gui elements for center wavelength display
var cwlInput = d3.select('#cwlGui')
                    .append('input')
                    .classed('textGuiInput', true)
                    .attr('value', app.centerWavelength)
                    .on('input', function(){
                        if (app.debug){console.log(this.value)}
                        if( !isNaN(Number(this.value))){
                            app.centerWavelength = Number(this.value);
                            allDetectors.update();
                        }

                    })

// add gui elements for min and max wavelength display

function addGuiInput(targetSelection, targetEnvVarName, limits = null){
    var newInput = targetSelection
                    .append('input')
                    .attr('value', app[targetEnvVarName])
                    .classed('textGuiInput', true)
                    .on('input', function(){
                        if (app.debug){console.log(this.value)}
                        if( !isNaN(Number(this.value))){
                            app[targetEnvVarName] = Number(this.value);
                            allDetectors.update();
                        }

                    })

}

// add x axis input elements
addGuiInput(d3.select('#graphXLimsGui'), 'graphMinXnm')
addGuiInput(d3.select('#graphXLimsGui'), 'graphMaxXnm')

addGuiInput(d3.select('#graphYLimsGui'), 'graphYMin')
addGuiInput(d3.select('#graphYLimsGui'), 'graphYMax')

// add checkbox options for graph
var optionDiv = d3.select('#graphOptions')

function addCheckBoxOption(targetSelection, param, labelText){
    var newCheckBoxDiv = targetSelection.append('div')
    var textLabel = newCheckBoxDiv.append('span').text(labelText)
    textLabel.classed('textLabel', true)
    var newCheckBox = newCheckBoxDiv.append('input').attr('type','checkbox')

    if (app[param]){
        newCheckBox.property('checked', true)
    }

    newCheckBox.on('change', function(){
        app[param] = this.checked;
        allDetectors.update();
    })
    
}

addCheckBoxOption(optionDiv, 'offSetTraces', 'Offset Traces')
addCheckBoxOption(optionDiv, 'includeSensorQE', 'Include Sensor QE')
addCheckBoxOption(optionDiv, 'includeNoise', 'Include Sensor Noise')
addCheckBoxOption(optionDiv, 'autoScaleY', 'Auto-Scale Y Axis')
addCheckBoxOption(optionDiv, 'flatSpectralInput', 'Flat Spectral Input')

/*
var minXinput = d3.select('#graphLimsGui')
                    .append('input')
                    .attr('value', app.graphMinXnm)
                    .classed('textGuiInput', true)
                    .on('input', function(){
                        if (app.debug){console.log(this.value)}
                        if( !isNaN(Number(this.value))){
                            app.graphMinXnm = Number(this.value);
                            allDetectors.update();
                        }

                    })

var maxXinput = d3.select('#graphLimsGui')
                    .append('input')
                    .attr('value', app.graphMaxXnm)
                    .classed('textGuiInput', true)
                    .on('input', function(){
                        if (app.debug){console.log(this.value)}
                        if( !isNaN(Number(this.value))){
                            app.graphMaxXnm = Number(this.value);
                            allDetectors.update();
                        }

                    })

                    */

// add axes
var xScale = d3.scaleLinear().domain([ app.graphMinXnm , app.graphMaxXnm]).range([0 + app.graphMarginX, app.svgWidth - app.graphMarginX]);
var yScale = d3.scaleLinear().domain([0,100]).range([app.svgHeight - app.graphMarginY, 0 + app.graphMarginY]);

var xAxisG = app.svg.append('g')
    .attr('transform', `translate(0,${app.svgHeight - app.graphMarginY})`)
    
var yAxisG = app.svg.append('g')
    .attr('transform', `translate(${app.graphMarginX},0)`);
var xAxis = d3.axisBottom(xScale);
var yAxis = d3.axisLeft(yScale);

xAxis(xAxisG);
yAxis(yAxisG);

function updateAxes(){

    xScale.domain([app.graphMinXnm, app.graphMaxXnm])
    xAxisG.call(xAxis);

    yScale.domain([app.graphYMin, app.graphYMax])
    yAxisG.call(yAxis);

    d3.selectAll(".x.axis")
        .style("stroke","black");
}

// add graph axis labels

app.svg.append('text')
    .text('Counts')
    .attr('transform',`translate(${app.graphMarginX/3},${app.svgHeight/2}), rotate(-90)`)
    .attr('text-anchor','middle')
    .classed('axisText', true)

app.svg.append('text')
    .text('Wavelength, nm')
    .attr('transform',`translate(${app.svgWidth/2},${app.svgHeight - app.graphMarginY/5}), rotate(0)`)
    .attr('text-anchor','middle')
    .classed('axisText', true)

// add callback to custom spectrum input
var spectrumTextInput = d3.select('#spectrumTextarea')
spectrumTextInput.on('input', function(){
    peakList1 = [];
    var rows = this.value.split('\n');
    rows.forEach(function(row){
        var params = row.split(',');
        var newPeak = {'a' : params[0]/2, 'mu' : params[1], 'sigma' : params[2]};
        peakList1.push(newPeak)
    })
    spectrumGen1.peakList = peakList1;
    allDetectors.update();
    txt = this.value;
})

// add select for pre-defined spectra select

var customSpectrumSelect = d3.select('#preDefinedSpectraSelect').append('select')

customSpectrumSelect
    .selectAll('option')
    .data(Object.keys(definedSpectra))
    .enter()
    .append('option')
    .attr('value',d=>d)
    .text(d=>d)

customSpectrumSelect.on('change', function(){
    if (app.debug){console.log(this.value)}
    var specText = definedSpectra[this.value];
    spectrumTextInput._groups[0][0].value = specText;
    spectrumTextInput.dispatch('input')

})
