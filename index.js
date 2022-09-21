const map = L.map('map').setView([51.505, -0.09], 13);

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


const zone = new L.FeatureGroup();
const subZone = new L.FeatureGroup();

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


map.on(L.Draw.Event.CREATED, function (event) {
    zone.addLayer(event.layer);
});


fetch('http://api.zonesvc.techamus.co.uk/api/zones', {
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
