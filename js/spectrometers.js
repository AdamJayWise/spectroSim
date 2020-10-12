var spectrometers = { 

  'Ideal Imaging System' : {
                'psf' : 0, // point spread function after removal of 10um slit 
                'dev' : -13.9, // deviation in degrees
                'fpt' : 4, // focal plane tilt, in degrees
                'fl' : 328, // focal length, in mm
                'gratingSizeX' : '45',
                'gratingSizeY' : '45',
                'f#' : 1,
                'displayName' : 'Ideal Imaging System (328mm)', // what to call it in the GUI,
  }
,

  'Shamrock 163' : {//'psf' : 60, // original psf from Tristan's script, in um
                  'psf' : 59.16, // point spread function after removal of 10um slit 
                  'dev' : -13.9, // deviation in degrees
                  'fpt' : 4, // focal plane tilt, in degrees
                  'fl' : 163, // focal length, in mm
                  'gratingSizeX' : '45',
                  'gratingSizeY' : '45',
                  'f#' : 3.6,
                  'displayName' : 'Shamrock 163', // what to call it in the GUI,
  },

  'Kymera 193i' : {//'psf' : 60, // original psf from Tristan's script, in um
                  'psf' : 59.16 * 0.98989, // point spread function after removal of 10um slit 
                   'dev' : -14, // deviation in degrees
                  'fpt' : 4.56, // focal plane tilt, in degrees
                  'fl' : 193, // focal length, in mm
                  'gratingSizeX' : '45',
                  'gratingSizeY' : '45',
                  'f#' : 3.6,
                  'displayName' : 'Kymera 193i', // what to call it in the GUI
                  },

  'Kymera 328i' : { //'psf' : 40,
                  'psf' : 38.73 * 1.126,
                  'dev' : -10.875,
                 'fpt' : 5,
                 'fl' : 328,
                 'gratingSizeX' : '80',
                 'gratingSizeY' : '80',
                 'f#' : 4.1,
                 'displayName' : 'Kymera 328i'
                 }, 

  'Kymera 328i with TruRes' : { //'psf' : 40,
                 'psf' : 38.73 * 0.7723,
                 'dev' : -10.875,
                'fpt' : 5,
                'fl' : 328,
                'gratingSizeX' : '80',
                'gratingSizeY' : '80',
                'f#' : '*',
                'displayName' : 'Kymera 328i with TruRes'
                }, 

  'Shamrock 500i' : {//'psf' : 40,
              'psf' : 38.73,
              'dev' : -11.5,
              'fpt' : 3.752,
              'fl' : 500,
              'gratingSizeX' : '80',
              'gratingSizeY' : '80',
              'f#' : 6.5,
              'displayName' : 'Shamrock 500i'
                }, 
  
  'Shamrock 750' : {//'psf' : 40,
              'psf' : 38.73,
              'dev' : -7.39,
              'fpt' : 1.083,
              'fl' : 750,
              'gratingSizeX' : '77',
              'gratingSizeY' : '77',
              'f#' : 9.7,
              'displayName' : 'Shamrock 750'
               }, 
  };