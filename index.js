const map = L.map('map').setView([51.505, -0.09], 10);

const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
}).addTo(map);

const googleStreets = L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
});

const googleHybrid = L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
});

const googleSat = L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
});

const googleTerrain = L.tileLayer('http://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
});

let baseLayers = {
    "OpenStreetMap": osm,
    "Google Streets": googleStreets,
    "Google Hybrid": googleHybrid,
    "Google Satellite": googleSat,
    "Google Terrain": googleTerrain,
};

// function onEachFeature(feature, layer) {
//     console.log('abd');
//     if (feature.properties) {
//         layer.bindPopup("<b>" + feature.properties.name + "</b>" + ".");
//     }
// }

const zone = new L.FeatureGroup({
    // onEachFeature: onEachFeature
});
const subZone = new L.FeatureGroup();

const zoneUrl = 'http://api.zonesvc.techamus.co.uk/api/zones'


let sideBar = document.querySelector(".side-bar");
let closeBtn = document.querySelector(".side-bar .btn-close");
let attrName = document.querySelector("#attribute-name");
let attrSave = document.querySelector("#attribute-save");


map.addLayer(zone);
// map.addLayer(subZone);

let overLays = {
    "Zone": zone,
    "Sub Zone": subZone,
}


L.control.layers(baseLayers, overLays).addTo(map);


let drawControl = new L.Control.Draw({
    draw: {
        marker: false,
        circle: false,
        circlemarker: false,
        rectangle: false,
        polygon: {
            allowIntersection: false,
            showArea: true
        }
    },
    edit: {
        featureGroup: zone,
        poly: {
            allowIntersection: false
        }
    }
});

map.addControl(drawControl);

let drawing = null;

map.on(L.Draw.Event.CREATED, (event) => {
    console.log('Created');

    drawing = event.layer.toGeoJSON();
    zone.addLayer(event.layer);
    sideBar.dispatchEvent(new Event('open'));
});

map.on(L.Draw.Event.EDITED, (event) => {
    console.log("Edited");
    console.log(event);
})


fetch(zoneUrl, {
// fetch('http://localhost:2020/zones', {
    method: 'GET',
    headers: {
        'Content-Type': 'application/json'
    },
})
    .then(res => res.json())
    .then(data => {
        data.forEach(d => {
            let gJson = L.geoJSON(JSON.parse(d.geoJSON));
            gJson.eachLayer(layer => {
                zone.addLayer(layer);
            })

        });

    });


closeBtn.addEventListener('click', evt => {
    sideBar.style.transform = 'translateX(100%)';
});

sideBar.addEventListener('open', evt => {
    sideBar.style.transform = 'none';
})

attrName.addEventListener('input', evt => {
    if (drawing && drawing.hasOwnProperty('properties')) {
        drawing.properties.name = evt.target.value
    }
})

attrSave.addEventListener('click', evt => {
    if (drawing && drawing.hasOwnProperty('properties')) {

        const body = {
            name: drawing.properties.name,
            geoJSON: JSON.stringify(drawing)
        }

        fetch(zoneUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        }).then(res => res.json())
            .then(data => {
                console.log(data);
            });
    }
})

// const drawnPolygons = L.featureGroup();
// const drawnLines = L.featureGroup();
//
// drawnPolygons.addTo(map);
// drawnLines.addTo(map);
//
// map.addControl(new L.Control.Draw({
//     draw: {
//         marker: false,
//         circle: false,
//         circlemarker: false,
//         rectangle: false,
//         polygon: {
//             allowIntersection: false,
//             showArea: true
//         }
//     }
// }));
//
// function cutPolygon(polygon, line, direction, id) {
//     var j;
//     var polyCoords = [];
//     var cutPolyGeoms = [];
//     var retVal = null;
//
//     if ((polygon.type != 'Polygon') || (line.type != 'LineString')) return retVal;
//
//     var intersectPoints = turf.lineIntersect(polygon, line);
//     var nPoints = intersectPoints.features.length;
//     if ((nPoints == 0) || ((nPoints % 2) != 0)) return retVal;
//
//     var offsetLine = turf.lineOffset(line, (0.01 * direction), {units: 'kilometers'});
//
//     for (j = 0; j < line.coordinates.length; j++) {
//         polyCoords.push(line.coordinates[j]);
//     }
//     for (j = (offsetLine.geometry.coordinates.length - 1); j >= 0; j--) {
//         polyCoords.push(offsetLine.geometry.coordinates[j]);
//     }
//     polyCoords.push(line.coordinates[0]);
//     var thickLineString = turf.lineString(polyCoords);
//     var thickLinePolygon = turf.lineToPolygon(thickLineString);
//
//     var clipped = turf.difference(polygon, thickLinePolygon);
//     for (j = 0; j < clipped.geometry.coordinates.length; j++) {
//         var polyg = turf.polygon(clipped.geometry.coordinates[j]);
//         var overlap = turf.lineOverlap(polyg, line, {tolerance: 0.005});
//         if (overlap.features.length > 0) {
//             cutPolyGeoms.push(polyg.geometry.coordinates);
//         }
//     }
//
//     if (cutPolyGeoms.length == 1)
//         retVal = turf.polygon(cutPolyGeoms[0], {id: id});
//     else if (cutPolyGeoms.length > 1) {
//         retVal = turf.multiPolygon(cutPolyGeoms, {id: id});
//     }
//
//     return retVal;
// }
//
// var polygons = [];
//
// map.on(L.Draw.Event.CREATED, function (event) {
//     var layer = event.layer;
//
//     var geojson = layer.toGeoJSON();
//     var geom = turf.getGeom(geojson);
//
//     if (geom.type == 'Polygon') {
//         polygons.push(geom);
//         drawnPolygons.addLayer(layer);
//     } else if (geom.type == 'LineString') {
//         var line = geom;
//         drawnLines.addLayer(layer);
//         drawnPolygons.clearLayers();
//         var newPolygons = [];
//         polygons.forEach(function (polygon, index) {
//             var cutDone = false;
//             var layer;
//             var upperCut = cutPolygon(polygon, line, 1, 'upper');
//             var lowerCut = cutPolygon(polygon, line, -1, 'lower');
//             if ((upperCut != null) && (lowerCut != null)) {
//                 layer = L.geoJSON(upperCut, {
//                     style: function (feature) {
//                         return {color: 'green'};
//                     }
//                 }).addTo(drawnPolygons);
//                 layer = L.geoJSON(lowerCut, {
//                     style: function (feature) {
//                         return {color: 'yellow'};
//                     }
//                 }).addTo(drawnPolygons);
//                 cutDone = true;
//             }
//             if (cutDone) {
//                 newPolygons.push(upperCut.geometry);
//                 newPolygons.push(lowerCut.geometry);
//             } else {
//                 newPolygons.push(polygon);
//                 layer = L.geoJSON(polygon, {
//                     style: function (feature) {
//                         return {color: '#3388ff'};
//                     }
//                 }).addTo(drawnPolygons);
//             }
//         });
//         polygons = newPolygons;
//     }
// });
//
