'use strict';
/*global THREE: false */
// we use fs + brfs to inline an example XML document.
// exclude fs in package.json#browser + use the brfs transform
// to generate a clean browserified bundle
var fs = require('fs');
// var Snap = require('snapsvg');
var _ = require('lodash');

// inlined in result file via brfs
var pizzaDiagram = fs.readFileSync(__dirname + '/../resources/pizza-collaboration.bpmn', 'utf-8');

// require the viewer, make sure you added it to your project
// dependencies via npm install --save-dev bpmn-js
var BpmnViewer = require('bpmn-js');
var threeScene = require('./three-scene')(document.querySelector('#three-container .canvas'));
// var threeMesh = require('./three-shape2mesh');
var camera = threeScene.camera;
var scene = threeScene.scene;

var viewer = new BpmnViewer({ container: '#canvas' });
function makeMaterial(materialType, materialOptions) {
  return new THREE[materialType || 'MeshLambertMaterial'](materialOptions || {
    color: 0xffffff
  });
}

function addFlow(options) {
  options = options || {};
  var el = options.el;
  var type = el.type;
  var scene = options.scene;
  var depth = options.depth || 0;
  var height = options.height || 50;
  var radius = options.radius || 1;
  var wps = el.waypoints;
  var scale = options.scale || 1;

  var material = makeMaterial(options.materialType, options.materialOptions || {
    color: type.indexOf('Sequence') > -1 ? 0xff0000 : 0x00ff00,
  });

  var returned = [];
  wps.forEach(function (wp, i) {
    if (i === 0) {
      return;
    }
    var prevWp = wps[i - 1];

    var start = new THREE.Vector3(
      prevWp.x * scale,
      prevWp.y * scale,
      depth * height * scale
    );
    var end = new THREE.Vector3(
      wp.x * scale,
      wp.y * scale,
      depth * height * scale
    );

    var twoPointsCurve = new THREE.SplineCurve3([start, end]);
    var lineGeometry = new THREE.TubeGeometry(twoPointsCurve, 4, radius, 8, false);
    var lineMesh = new THREE.Mesh(lineGeometry, material);
    scene.add(lineMesh);
    returned.push(lineMesh);

    var junctionMesh = new THREE.Mesh(new THREE.SphereGeometry(radius), material);
    junctionMesh.position.set(start);
    scene.add(junctionMesh);
    returned.push(junctionMesh);
  });
}


function addTask(options) {
  options = options || {};
  var el = options.el;
  var scene = options.scene;
  var scale = options.scale || 1;
  var depth = options.depth || 0;
  var height = options.height || 50;

  var material = makeMaterial(options.materialType, options.materialOptions);
  var geometry = new THREE.CubeGeometry(el.width * scale, el.height * scale, height * scale);
  var mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(el.x * scale, el.y * scale, depth * scale);
  scene.add(mesh);
  return [mesh];
}

function addEvent(options) {
  options = options || {};
  var el = options.el;

  var scene = options.scene;
  var scale = options.scale || 1;
  var depth = options.depth || 0;
  var height = options.height || 50;
  var material = makeMaterial(options.materialType, options.materialOptions);
  var geometry = new THREE.CylinderGeometry(el.width * scale, el.height * scale, height * scale);
  var mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(el.x * scale, el.y * scale, depth * scale);
  mesh.rotation.x = -90 * 0.0174532925;
  scene.add(mesh);
  return [mesh];
}

function addGateway(options) {
  options = options || {};
  var el = options.el;

  var scene = options.scene;
  var scale = options.scale || 1;

  var height = options.height || 50;
  var material = makeMaterial(options.materialType, options.materialOptions);
  var geometry = new THREE.Geometry();
  var mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(el.x * scale, el.y * scale, height * scale);
  mesh.rotation.z = 45 * 0.0174532925;
  scene.add(mesh);
  return [mesh];
}

viewer.importXML(pizzaDiagram, function(err) {
  if (err) {
    console.log('something went wrong:', err);
  }

  var canvas = viewer.get('canvas');

  canvas.zoom('fit-viewport');


  var root = canvas.getRootElement();


  var layers = {};

  var layerNumber = 0;

  function isLabel(element) {
    return element.type === 'label' && !element.businessObject.name;
  }

  function hasCoords(shape) {
    return shape.x &&
           shape.y &&
           shape.width &&
           shape.height;
  }

  var maxX = 0,
      minX = 0,
      maxY = 0,
      minY = 0;

  function traverse(children) {
    var tempLayers = [];

    if (children.length === 0) {
      return;
    }

    layers['layer' + layerNumber] = [];

    _.forEach(children, function (child) {
      if (isLabel(child)) {
        return;
      }

      layers['layer' + layerNumber ].push(child);

      if (hasCoords(child)) {
        minX = Math.min(child.x, minX);
        maxX = Math.max(child.x + child.width, maxX);
        minY = Math.min(child.y, minY);
        maxY = Math.max(child.y + child.height, maxY);
      }

      _.forEach(child.children || [], function(elem) {
          tempLayers.push(elem);
      });
    });

    if (tempLayers.length === 0) {
      return;
    }
    layerNumber += 1;

    traverse(tempLayers);
  }

  traverse(root.children);


  var height = 50;
  var scale = 0.2;

  function createElementMesh(el, depth) {
    var created = [];
    var type = el.type;

    var options = {
      el: el,
      scene: scene,
      scale: scale,
      depth: depth,
      height: height
    };
    function has(what) {
      return type.indexOf(what) > -1;
    }

    if (has('Gateway')) {
      created = created.concat(addGateway(options));
    }
    else if (has('Flow')) {
      created = created.concat(addFlow(options));
    }
    else if (has('Event')) {
      created = created.concat(addEvent(options));
    }
    else if (has('Task')) {
      created = created.concat(addTask(options));
    }
  }

  var names = Object.keys(layers).reverse();

  _.forEach(names, function (name, d) {
    var shapes = layers[name];
    _.forEach(shapes, function (shape) {
      createElementMesh(shape, d);
    });
  });

  names.forEach(function (layer, d) {
    var shape = new THREE.PlaneGeometry(maxX * scale, maxY * scale);
    var mesh = new THREE.Mesh(shape, new THREE.MeshLambertMaterial({
      color: 0x999999,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.2
    }));

    var x = (minX + (maxX / 2)) * scale;
    var y = (minY + (maxY / 2)) * scale;

    mesh.position.set(x, y, d * height);
    scene.add(mesh);

    camera.position.set(x, y, (x + y) / 2);

    var lookAt = mesh.position.clone();
    lookAt.setZ(0);

    camera.lookAt(lookAt);
  });

  console.log(scene);
});
