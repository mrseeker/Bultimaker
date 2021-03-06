//
//  Bul(le)timaker
//
//  Build Ultimaker firmware
//  AngularJS App
//

/*global angular, Blob */
var bultimakerApp = angular.module('bultimakerApp', ['rzModule', 'ngSanitize']);

// Allow blob URLs
bultimakerApp.config(['$compileProvider', function ($compileProvider) {
  "use strict";
  $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|tel|file|blob):/);
}]);

// UMO Factory to initialize data and talk to the server
// We don't really need a factory here -- just for educational purpose
bultimakerApp.factory('umoFactory', ['$http', function ($http) {
  "use strict";
  var umo = {},                     // Factory object
    baseUrl = 'bultimaker.php',     // Base server URL

    profiles = [                    // Machine profiles
      {
        label: 'Ultimaker Original',
        buildParams: {
          target:     'UMO'
        }
      },
      {
        label: 'Ultimaker Original with HBK',
        buildParams: {
          target:       'HBK',
          tempBed:      20,       // Heated bed is PT100
          softEndstops: 1         // Software endstops
        }
      },
      {
        label: 'Ultimaker Original +',
        buildParams: {
          target:       'UMOP',
          motherboard:  72,         // UMOP has UM2 board
          temp0:        20,         // Extruder is PT100
          temp1:        20,         // 2nd extruder if any is PT100
          tempBed:      20,         // Heated bed is PT100
          frsPin:       13,         // Pin for the sensor
          softEndstops: 1           // Software endstops
        }
      }
    ],

    defaultParams = {                 // Default parameters for all machines
      motherboard:    7,              // Default UMO Board
      extruders:      1,              // Single extruder
      temp0:          -1,             // Extruder is thermocouple
      temp1:          -1,             // 2nd extruder if any is thermocouple
      tempBed:        0,              // No heated bed
      pidBed:         0,              // No PID control for heated bed
      controller:     'Ulti',         // Ulticontroller
      displayFan:     0,              // Display Fan% on Ulticontroller
      actionCommand:  0,              // Action:command implementation
      baudrate:       250000,         // Default baud rate
      invertX:        1,              // Default axis direction on UMO
      invertY:        0,
      invertZ:        1,
      invertE0:       0,
      invertE1:       0,
      language:       1,              // Interface language -- English
      timeout:        15000,          // Display timeout
      pulleys:        0,              // 0: MXL, 1: GT2
      maxtemp0:       275,            // Max temp for extruder 0
      maxtemp1:       275,            // Max temp for extruder 1
      beep:           'Ulti',         // Beep type. Ultimaker traditional or Marlin original
      reverseEncoder: 0,              // To fix the rotary knob
      filRunoutSensor: 0,             // Do we have a filament runout sensor?
      frsPin:         8,              // Pin for the sensor (1.5.x boards)
      frsInvert:      1,              // Invert signal?
      frsPullup:      1,              // Configure the pin Pull-up
      fanKick:        0,              // Fan kickstart time
      fanMinPwm:      0,              // Fan Min PWM
      fanSlowPwm:     0,              // Fan Slow PWM
      e0AutoFan:      0,              // Extruder0 Auto Fan
      e1AutoFan:      0,              // Extruder1 Auto Fan
      tweakTemp:      0,              // Tweak temp feature
      tweakMaxOffset: 50,             // Max temperature offset for tweaks
      zMinInvert:     1,              // Invert Z endstop logic (1 is NO)
      softEndstops:   0,              // Software endstops
      softZAlign:     0,              // Software Z alignment (à la UM2)
      zHomeDir:       -1,             // Z Home is at Min Z
      zHomeRetract:   2               // Retraction distance before slow homing
    };

  // Returns available profiles
  umo.getProfiles = function () {
    return profiles;
  };

  // Returns default parameters
  umo.getParams = function () {
    return defaultParams;
  };

  umo.getGitInfo = function () {
    return $http.post(baseUrl, {cmd: 'info'});
    // return $http.get('bultimakerInfo.json');
  };

  umo.buildFirmware = function (params) {
    params.cmd = 'build';             // Inject command
    return $http.post(baseUrl, params);
    // return $http.get('bultimakerBuild.json');
  };

  return umo;
}]);

bultimakerApp.component('bulLabel', {
  bindings: {
    flag: '@'
  },

  template: '<span class="label label-{{$ctrl.label}}"><span class="glyphicon glyphicon-{{$ctrl.glyph}}"></span> {{$ctrl.text}}</span>',

  controller: function () {
    "use strict";
    var flags = {
      news:         ['primary', 'eye-open',         'New'],
      firmware:     ['info',    'sunglasses',       'Firmware'],
      hardware:     ['info',    'wrench',           'Hardware'],
      expert:       ['info',    'education',        'Expert'],
      experimental: ['warning', 'exclamation-sign', 'Experimental'],
      wip:          ['danger',  'flash',            'Work in progress']
    };

    if (flags[this.flag] !== undefined) {
      this.label = flags[this.flag][0];
      this.glyph = flags[this.flag][1];
      this.text = flags[this.flag][2];
    } else {
      this.label = 'danger';
      this.glyph = 'question-sign';
      this.text = this.flag;
    }
  }
});

bultimakerApp.controller('bultimakerCtrl', ['$scope', '$timeout', 'umoFactory', function ($scope, $timeout, umoFactory) {
  "use strict";

  // List of values
  $scope.lovSensor = [
    { key: -2,   descr: 'Thermocouple with MAX6675 (only for sensor 0)'},
    { key: -1,   descr: 'Thermocouple with AD595'},
    { key: 0,    descr: 'None'},
    { key: 1,    descr: '100k thermistor - best choice for EPCOS 100k (4.7k pullup)'},
    { key: 2,    descr: '200k thermistor - ATC Semitec 204GT-2 (4.7k pullup)'},
    { key: 3,    descr: 'Mendel-parts thermistor (4.7k pullup)'},
    { key: 4,    descr: '10k thermistor !! do not use it for a hotend. It gives bad resolution at high temp. !!'},
    { key: 5,    descr: '100K thermistor - ATC Semitec 104GT-2 (Used in ParCan & J-Head) (4.7k pullup)'},
    { key: 6,    descr: '100k EPCOS - Not as accurate as table 1 (created using a fluke thermocouple) (4.7k pullup)'},
    { key: 7,    descr: '100k Honeywell thermistor 135-104LAG-J01 (4.7k pullup)'},
    { key: 71,   descr: '100k Honeywell thermistor 135-104LAF-J01 (4.7k pullup)'},
    { key: 8,    descr: '100k 0603 SMD Vishay NTCS0603E3104FXT (4.7k pullup)'},
    { key: 9,    descr: '100k GE Sensing AL03006-58.2K-97-G1 (4.7k pullup)'},
    { key: 10,   descr: '100k RS thermistor 198-961 (4.7k pullup)'},
    { key: 11,   descr: '100k beta 3950 1% thermistor (4.7k pullup)'},
    { key: 12,   descr: '100k 0603 SMD Vishay NTCS0603E3104FXT (4.7k pullup) (calibrated for Makibox hot bed)'},
    { key: 20,   descr: 'The PT100 circuit found in the Ultimainboard V2.x'},
    { key: 60,   descr: '100k Maker\'s Tool Works Kapton Bed Thermistor beta=3950'},
    { key: 51,   descr: '100k thermistor - EPCOS (1k pullup)'},
    { key: 52,   descr: '200k thermistor - ATC Semitec 204GT-2 (1k pullup)'},
    { key: 55,   descr: '100k thermistor - ATC Semitec 104GT-2 (Used in ParCan & J-Head) (1k pullup)'},
    { key: 1047, descr: 'PT1000 with 4k7 pullup'},
    { key: 1010, descr: 'PT1000 with 1k pullup (non standard)'},
    { key: 147,  descr: 'PT100 with 4k7 pullup'},
    { key: 110,  descr: 'PT100 with 1k pullup (non standard)'}
  ];
  $scope.lovBaudrate = [
    { key: 250000,   descr: '250000 (Default)'},
    { key: 115200,   descr: '115200'}
  ];
  $scope.lovController = [
    { key: 'Ulti',   descr: 'UltiController (or no controller)'},
    { key: 'FGSC',   descr: 'RepRapDiscount Full Graphic Smart Controller'}
  ];
  $scope.lovLanguage = [
    { key: 1,   descr: 'English'},
    { key: 3,   descr: 'Français'}
  ];
  $scope.lovTimeout = [
    { key:  5000,   descr: ' 5 sec.'},
    { key: 10000,   descr: '10 sec.'},
    { key: 15000,   descr: '15 sec. (Default)'},
    { key: 20000,   descr: '20 sec.'},
    { key: 30000,   descr: '30 sec.'},
    { key: 45000,   descr: '45 sec.'},
    { key: 60000,   descr: ' 1 min.'}
  ];
  $scope.lovPulleys = [
    { key: 0,   descr: 'MXL (Standard UMO)'},
    { key: 1,   descr: 'GT2 (Upgrade)'}
  ];
  $scope.lovTemp = [
    { key: 275,   descr: '275°C (Default)'},
    { key: 280,   descr: '280°C'},
    { key: 285,   descr: '285°C'},
    { key: 290,   descr: '290°C'},
    { key: 295,   descr: '295°C'},
    { key: 300,   descr: '300°C'},
    { key: 305,   descr: '305°C'},
    { key: 310,   descr: '310°C'},
    { key: 315,   descr: '315°C'}
  ];
  $scope.sliderTemp = {
    floor: 270,
    ceil: 400,
    step: 5,
    showTicks: 10,
    translate: function (value) {
      var suffix = '°C';
      if (value === 275) {
        suffix += ' (Default)';
      }
      return value + suffix;
    }
  };
  $scope.lovPidBed = [
    { key: 0,   descr: 'Bang-bang (Default)'},
    { key: 1,   descr: 'PID controlled'}
  ];
  $scope.lovBeep = [
    { key: 'Ulti',   descr: 'UltiController default'},
    { key: 'Marlin', descr: 'Marlin original'}
  ];
  $scope.lovFrsPin = {
    7: [              // Ultiboard 1.5.x
      { key:   8,   descr: 'Exp3  8 - ATmega pin 17 - Digital pin  8'},
      { key:   9,   descr: 'Exp3  9 - ATmega pin 18 - Digital pin  9'},
      { key:  10,   descr: 'Exp3 10 - ATmega pin 23 - Digital pin 10'},
      { key:  11,   descr: 'Exp3 11 - ATmega pin 24 - Digital pin 11'},
      { key:  12,   descr: 'Exp3 12 - ATmega pin 25 - Digital pin 12'},
      { key:  13,   descr: 'Exp3 13 - ATmega pin 26 - Digital pin 13'}
    ],
    72: [              // Ultiboard 2.x
      { key:  13,   descr: 'Exp3 PB7   - ATmega Pin 26 - Digital pin 13'},
      { key:  30,   descr: 'Ext/IO PC7 - ATmega Pin 60 - Digital pin 30'},
      { key:  38,   descr: 'Ext/IO PD7 - ATmega Pin 50 - Digital pin 38'}
    ]
  };
  $scope.lovFanKick = [
    { key:   0,   descr: 'None (Default)'},
    { key: 100,   descr: '100 ms'},
    { key: 200,   descr: '200 ms'},
    { key: 300,   descr: '300 ms'},
    { key: 400,   descr: '400 ms'},
    { key: 500,   descr: '500 ms (Recommended)'}
  ];
  $scope.sliderFanMinPwm = {
    floor: 0,
    ceil: 127,
    step: 5,
    showTicks: 10,
    translate: function (value) {
      return (value === 0) ? 'Off' : value;
    }
  };
  $scope.sliderTweakMaxOffset = {
    floor: 10,
    ceil: 100,
    step: 5,
    showTicks: 10,
    translate: function (value) {
      var suffix = '°C';
      if (value === 50) {
        suffix += ' (Default)';
      }
      return value + suffix;
    }
  };
  $scope.sliderZRetract = {
    floor: 0,
    minLimit: 2,
    ceil: 30,
    step: 1,
    showTicks: 5,
    translate: function (value) {
      var suffix = 'mm';
      if (value === 2) {
        suffix += ' (Default)';
      }
      return value + suffix;
    }
  };
  $scope.refreshSlider = function () {
    $timeout(function () {
      $scope.$broadcast('rzSliderForceRender');
    });
  };
  $scope.softZAlignChanged = function () {
    if ($scope.params.softZAlign === 1) {
      $scope.refreshSlider();
      $scope.params.softEndstops = 1;
    }
  };
  // Buttons state and fields initialization
  $scope.disableCompile = false;
  $scope.disableDownload = true;
  $scope.buildLog = '';
  $scope.buildMd5 = '';
  $scope.buildFirmware = '';
  $scope.firmwareFile = '';
  $scope.compileError = false;
  $scope.httpError = false;

  // Compile button
  $scope.compile = function () {
    // Disable compile button and clear previous displays
    $scope.disableCompile = true;
    $scope.disableDownload = true;
    $scope.buildLog = "";
    $scope.buildMd5 = "";
    $scope.buildFirmware = "";
    $scope.compileError = false;
    $scope.httpError = false;

    umoFactory.buildFirmware($scope.params).
      success(function (data, status, headers, config) {
        if (data.status === 0 && data.firmware) {
          // All good, we (should) have a firmware
          var firmwareBlob = new Blob([data.firmware], { type : 'application/octet-stream' });
          $scope.buildFirmware = (window.URL || window.webkitURL).createObjectURL(firmwareBlob);
          $scope.buildLog = data.log;
          $scope.buildMd5 = data.md5;
          $scope.firmwareFile = 'MarlinUltimaker-' + $scope.params.target +
            '-' + $scope.params.baudrate +
            ($scope.params.extruders === 2 ? '-dual' : '') +
            '.hex';
          $scope.disableDownload = false;
        } else {
          $scope.buildLog = data.log;
          $scope.compileError = true;
        }
      }).
      error(function (data, status, headers, config) {
        $scope.httpErrorData = data;
        $scope.httpErrorStatus = status;
        $scope.httpError = true;
      })['finally'](function () {   // use this notation to make JSLint happy...
        // Call done, re-enable compile button
        $scope.disableCompile = false;
      });
  };

  // Get data from factory
  $scope.infoError = '';
  $scope.info = {};
  umoFactory.getGitInfo().
    success(function (data, status, headers, config) {
      if (data.status === 0) {
        $scope.info = data;
        $scope.info.repo = $scope.info.url.replace('https://github.com/', '');
      } else {
        $scope.infoError = data.log || 'Cannot retrieve source information from server';
      }
    }).
    error(function (data, status, headers, config) {
      $scope.infoError = 'Cannot retrieve source information from server';
    });
  $scope.profiles = umoFactory.getProfiles();
  $scope.umSelect = $scope.profiles[0];
  $scope.params = angular.extend({}, umoFactory.getParams(), $scope.umSelect.buildParams);
  $scope.umSelected = function () {
    $scope.params = angular.extend({}, umoFactory.getParams(), $scope.umSelect.buildParams);
  };

  // Ensure sliders are rendered (Safari)
  $scope.refreshSlider();
}]);