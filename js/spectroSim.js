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
 */

 console.log('spectroSim.js - Adam Wise 10/2020')

 // ========================================= app variables ===================================

 var app = {
     'debug' : 1, // 
     'nSamples' : 1, // how many traces to draw per detector
     'graphWidthmm' : 25.6, // width of plot area in mm
     'svgWidth' : 600,
     'svgHeight' : 400,
     'graphYMin' : -20,
     'graphYMax' : 90,
 }

 // ========================================= General Purpose Function ===================================

 // gaussian function
 function g(x, mu = 0, sig = 1){
    return Math.exp( -1*(x-mu)**2 / sig**2)
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

     createSpectrumDataObject(configObj) {
         var dataArray = [];
         dataArray.length = configObj['xPixels'];
         var pixelSize = configObj['xPixelSize']
         dataArray.fill(0);
         // add the contribution from each peak
         for (var k in this.peakList){
             for (var i in dataArray){
                dataArray[i] += (pixelSize / 25) * this.peakList[k]['a'] * g(i * pixelSize / 1000, this.peakList[k]['mu'], this.peakList[k]['sigma'])
             }
         }
         return {'data':dataArray}
     }
 }

 class Detector {
     constructor(configObj, data){
        this.configObj = configObj;
        this.spectrum = data;
        this.paths = [];
        this.svg = d3.select('svg')
        this.g = this.svg.append('g')
        this.line = d3.line().x(function(d,i){return i/10}).y(function(d){return d})

     }

     draw(){
         if (app.debug == 1){
            console.log('drawing')
         }
         var scaleX = d3.scaleLinear().domain([0, app['graphWidthmm']]).range([0,app.svgWidth])
         var scaleY = d3.scaleLinear().domain( [app['graphYMin'], app['graphYMax'] ]).range([app['svgHeight'], 0]);
         this.line.x( (d,i)=>scaleX(i * this.configObj['xPixelSize'] / 1000) );
         this.line.y(d=>scaleY(d))
        

         // draw random samples based on ground truth
         for (var q = 0; q < app['nSamples']; q++){
            var measuredData = this.spectrum.data.map(poissonSample)
            var measuredData = measuredData.map(d=>d + (this.configObj.readNoise * randBM()) )
            var newPath = this.svg.append('path')
            newPath.style('stroke-opacity', 1/app['nSamples'])
            newPath.attr('d', this.line(measuredData))
            newPath.style('stroke', this.graphColor)
         }
     }
 }

 // ====================================================================================

 var spectra = 0
 var data1 = 0;

 peakList1 = [{'a' :30, 'mu':2, 'sigma':0.3}, {'a' :60, 'mu':12, 'sigma':0.5}]

 spectrumGen1 = new SpectrumGenerator(peakList = peakList1)


/// now I need to create an SVG canvas and draw the spectrum to it


var mainSvg = d3.select('body').append('svg').style('height', app.svgHeight).style('width',app.svgWidth)

/// create a new detector configuration and detector

var detectorConfig = cameraDefs['idus420BU'];
var spec1 = spectrumGen1.createSpectrumDataObject(detectorConfig)
var detector1 = new Detector(detectorConfig, spectrumGen1.createSpectrumDataObject(detectorConfig))
detector1.graphColor = 'blue'

var detectorConfig2 = cameraDefs['zyla42usb'];
var spec2 = spectrumGen1.createSpectrumDataObject(detectorConfig2)
var detector2 = new Detector(detectorConfig2, spectrumGen1.createSpectrumDataObject(detectorConfig2))
detector2.graphColor - 'red'



detector1.draw();
detector2.draw()


 

