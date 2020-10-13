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
 */

 console.log('spectroSim.js - Adam Wise 10/2020')

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
     'svgWidth' : 700,
     'svgHeight' : 280,
     'graphYMin' : -20,
     'graphYMax' : 5000,
     'scaleTraces' : 0, // correct intensity of traces by factor of 1/pixelsize to account for splitting counts
     'centerWavelength' : 500,
     'svg' : d3.select('svg'),
     'graphMarginX' : 30,
     'graphMarginY' : 20,
     'targetDispersion' : 10, // disperions for x axis in nm/mm.  sets scale of x axis
 }

 // ========================================= General Purpose Functions ===================================

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

     createSpectrumDataObject(camConfigObj, spectrometerConfigObj, gratingConfigObj) {
         if (app.debug){console.log('createSpectrumDataObject called')};
         var dataArray = [];
         dataArray.length = camConfigObj['xPixels'];
         var pixelSize = camConfigObj['xPixelSize'];
         var relDispersion = (spectrometerConfigObj['fl'] / 163) * (gratingConfigObj['rule'] / 150)
         dataArray.fill(0);
         // add the contribution from each peak
         for (var k in this.peakList){
             if (app.debug){console.log('adding ',k, this.peakList[k], camConfigObj)}
             for (var i =0; i < dataArray.length; i++){
                // calculate the integral for each pixel.  E.g. for pixel one, it'll be 0:pixelwidth, then for pixel 2 it'll be pixelwidth : 2*pixelwidth and so on
                // the integral will be erf(a)-erf(b).  estabilish a cutoff at which you won't want to calc erf?
                // so...
                var a0 = this.peakList[k]['a']; // scale value by height of peak
                var mu = this.peakList[k]['mu'] * relDispersion;
                var sig = Math.sqrt(this.peakList[k]['sigma']**2 + (spectrometerConfigObj['psf']/1000)**2);
                var x0 = ( (i+0) * pixelSize / 1000) - mu;
                var x1 = ( (i+1) * pixelSize / 1000) - mu;
                dataArray[i] += a0 * ( erf(x1/sig) - erf(x0/sig) );

                //dataArray[i] +=  this.peakList[k]['a'] * g(i * pixelSize / 1000, this.peakList[k]['mu'], this.peakList[k]['sigma'])
             }
         }
         return {'data':dataArray}
     }
 }

 class Detector {
     constructor(camConfigObj, spectrometerConfigObj, gratingConfigObj, spectrumGenerator){
        this.camConfigObj = camConfigObj;
        this.spectrometerConfigObj = spectrometerConfigObj;
        this.gratingConfigObj = gratingConfigObj;
        this.spectrum = spectrumGenerator.createSpectrumDataObject(camConfigObj, spectrometerConfigObj, gratingConfigObj);
        this.paths = [];
        this.svg = app.svg;
        this.g = this.svg.append('g')
        this.line = d3.line().x(function(d,i){return i/10}).y(function(d){return d})
     }

     draw(){


        if (this.active==0){
            return
        }

         if (app.debug == 1){
            console.log('drawing')
         }
         var xShift = 0;//-1 * this.camera.xPixelSize/1000
         var relDispersion = (this.spectrometerConfigObj['fl'] / 163) * (this.gratingConfigObj['rule'] / 150)
         var scaleX = d3.scaleLinear().domain([ (app.graphMinXmm + xShift), (app.graphMaxXmm + xShift) * relDispersion ]).range([0 + app.graphMarginX , app.svgWidth - app.graphMarginX])
         
         var yScaleFactor = 1;
         if (app['scaleTraces']) {yScaleFactor = 25/this.camConfigObj.xPixelSize}; 
         
         var scaleY = d3.scaleLinear().domain( [app['graphYMin'] / yScaleFactor, app['graphYMax'] / yScaleFactor ]).range([app['svgHeight'] - app.graphMarginY, 0 + app.graphMarginY]);
         this.line.x( (d,i)=>scaleX(i * this.camConfigObj['xPixelSize'] / 1000) );
         this.line.y(d=>scaleY(d))
        

         // draw random samples based on ground truth
         for (var q = 0; q < app['nSamples']; q++){

            measuredData = this.spectrum.data;

            if (!this.camConfigObj['ideal']){
                measuredData = this.spectrum.data.map(poissonSample)
            }

            var measuredData = measuredData.map(d=>d + (this.camConfigObj.readNoise * randBM()) )
            //var measuredData = this.spectrum.data;
            var newPath = this.svg.append('path')
            this.paths.push(newPath);
            newPath.style('stroke-opacity', 2 * 1/app['nSamples'])
            newPath.attr('d', this.line(measuredData))
            newPath.attr('clip-path','url(#clipPath)')
            newPath.style('stroke', this.graphColor)
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
        this.detectors.forEach(function(d){
            d.erase();
            d.draw();
        })
    }
}

 // ====================================================================================

 var spectra = 0
 var data1 = 0;

 peakList1 = [{'a' :800, 'mu':26/1000 * 5 , 'sigma':0.0001},
                {'a' :1920, 'mu':0.2, 'sigma':0.030/2.355},
                {'a' :1920, 'mu':0.24, 'sigma':0.030/2.355},
                {'a' :3820, 'mu':0.37, 'sigma':0.070/2.355},

                {'a' :1820, 'mu':0.5, 'sigma':0.0001},
                {'a' :1820, 'mu':0.75, 'sigma':0.0001},
                {'a' :1820, 'mu':2, 'sigma':0.0001},
                {'a' :1820, 'mu':3, 'sigma':0.0001},
            ]

 spectrumGen1 = new SpectrumGenerator(peakList = peakList1)


/// now I need to create an SVG canvas and draw the spectrum to it


var mainSvg = d3.select('body').append('svg').style('height', app.svgHeight).style('width',app.svgWidth)
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
detectorFactoryDiv.text('Detector Factory')

var cameraSelect = detectorFactoryDiv.append('select')
cameraSelect
    .selectAll('option')
    .data(Object.keys(cameraDefs).sort())
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
createDetectorButton.text('create new detector')

createDetectorButton.on('click', function(){
    console.log('pressed')
    var newCamObj = cameraDefs[cameraSelect.property('value')];
    var newSpecObj = spectrometers[spectrometerSelect.property('value')];
    var newGratingObj = gratings[gratingSelect.property('value')];
    
    console.log(newSpecObj)
    
    var newDetector = new Detector(newCamObj, newSpecObj, newGratingObj, spectrumGen1)
    newDetector.graphColor = `hsl(${Math.round(Math.random()*360)},100%,50%)`
    newDetector.active = 1;// this is a hack for display, fix eventually
    
    allDetectors.add(newDetector);
    allDetectors.update(); 
    //newDetector.draw();
    //cameras.push(newDetector)
    //cameras.forEach(f=>f.erase())
    //cameras.forEach(f=>f.draw())


    d3.select('body')
        .append('div')
        .text(newCamObj['displayName'] + ' - ' + newSpecObj['displayName'] + ' - ' + newGratingObj['rule'] + ' lines / mm')
        .style('color', newDetector.graphColor)
        .style('font-size', '22px')
        .on('click', function(){
            newDetector.erase();
            newDetector.active = 0;
            this.remove()
        })
})


// add gui elements for min and max wavelength display
var minXinput = d3.select('#graphLimsGui')
                    .append('input')
                    .attr('value', app.graphMinXmm)
                    .style('width', '40px')
                    .on('input', function(){
                        if (app.debug){console.log(this.value)}
                        if( !isNaN(Number(this.value))){
                            app.graphMinXmm = Number(this.value);
                            allDetectors.update();
                        }

                    })

var maxXinput = d3.select('#graphLimsGui')
                    .append('input')
                    .attr('value', app.graphMaxXmm)
                    .style('width', '40px')
                    .on('input', function(){
                        if (app.debug){console.log(this.value)}
                        if( !isNaN(Number(this.value))){
                            app.graphMaxXmm = Number(this.value);
                            allDetectors.update();
                        }

                    })

// add axes

var xScale = d3.scaleLinear().domain([ app.targetDispersion * app.graphMinXmm + app.centerWavelength , app.targetDispersion * app.graphMaxXmm + app.centerWavelength]).range([0 + app.graphMarginX, app.svgWidth - app.graphMarginX]);
var yScale = d3.scaleLinear().domain([0,100]).range([app.svgHeight - app.graphMarginY, 0 + app.graphMarginY]);

var xAxisG = app.svg.append('g')
    .attr('transform', `translate(0,${app.svgHeight - app.graphMarginY})`)
    
var yAxisG = app.svg.append('g')
    .attr('transform', `translate(${app.graphMarginX},0)`);
var xAxis = d3.axisBottom(xScale);
var yAxis = d3.axisLeft(yScale);

xAxis(xAxisG);
yAxis(yAxisG);

