const map = L.map('map').setView([51.505, -0.09], 10);

const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
}).addTo(map);

const googleStreets = L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
});

const googleHybrid = L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
    maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
});

const googleSat = L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
    maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
});

const googleTerrain = L.tileLayer('http://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
    maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
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


const drawnPolygons = L.featureGroup();
const drawnLines = L.featureGroup();
drawnPolygons.addTo(map);
drawnLines.addTo(map);

const zoneUrl = 'http://api.zonesvc.techamus.co.uk/api/zones'
const subZoneUrl = 'http://api.zonesvc.techamus.co.uk/api/subzones'


// let sideBar = document.querySelector(".side-bar");
// let closeBtn = document.querySelector(".side-bar .btn-close");
// let attrName = document.querySelector("#attribute-name");
// let attrSave = document.querySelector("#attribute-save");


map.addLayer(zone);
map.addLayer(subZone);

let editingLayer = zone;
let editingLayerUrl = zoneUrl;

let overLays = {
    "Zone": zone, "Sub Zone": subZone,
}


L.control.layers(baseLayers, overLays).addTo(map);


let drawControl = new L.Control.Draw({
    draw: {
        marker: false, circle: false, circlemarker: false, rectangle: false, polygon: {
            allowIntersection: false, showArea: true
        }
    }, edit: {
        featureGroup: editingLayer,
        poly: {
            allowIntersection: false
        },
        remove: false
    },
});

map.addControl(drawControl);

let drawing = null;
let polygons = [];
let upperCutPolygon = null;
let lowerCutPolygon = null;
let splitLayer = null;
let splitEvent = null;


// map.on(L.Draw.Event.CREATED, (event) => {
//     console.log('Created');
//
//     drawing = event.layer.toGeoJSON();
//     zone.addLayer(event.layer);
//     sideBar.dispatchEvent(new Event('open'));
//
// });

map.on(L.Draw.Event.EDITED, (event) => {
    console.log("Edited");
    console.log(event);
});

function getFeatureById(id, layerGroup = editingLayer) {
    return layerGroup.getLayers().find(layer => {
        return (parseInt(layer.feature.properties.id) === parseInt(id));
    });
}

function bindPropertyOnLayer(layer) {
    const color = layer.feature.properties.color || "#0F52BA";
    layer.setStyle({
        color
    });
    layer.bindTooltip(layer.feature.properties.name, {
        permanent: true,
        direction: "center",
        opacity: 1,
        className: 'label-tooltip'
    });
    const name = layer.feature.properties.name || '';
    layer.bindPopup(`
                <form onsubmit="return modifyAttribute(event)" data-layer="${layer.featureGroup}" data-url="${layer.url}"
                 class="attribute-popup-content">
                    <input readonly disabled value="${layer.feature.properties.id}" type="hidden" name="id">
                    <div class="attribute-item">
                        <label>Name</label>
                        <input placeholder="Name" value="${name}" type="text" name="name">
                    </div>
                    <div class="attribute-item">
                        <label>Color</label>
                        <input  value="${color}" type="color" name="color">
                        ${layer.featureGroup}
                    </div>
                    <div class="btn-container">
                        <button data-layer="${layer.featureGroup}" data-url="${layer.url}"  
                        type="button" onclick="deleteFeature(event, ${layer.feature.properties.id})" class="btn btn-red">Delete</button>
                        <button data-layer="${layer.featureGroup}" data-url="${layer.url}"
                        type="button" onclick="splitFeature(event, ${layer.feature.properties.id})" class="btn btn-blue">Split</button>
                        <button type="submit" class="btn btn-yellow">Save</button>
                    </div>
                </form>
            `)
}

function bindPopupForSave(layer, cutPoly = false) {
    layer.bindPopup(`
                <form data-cut-poly="${cutPoly}" onsubmit="return saveFeature(event)" class="attribute-popup-content">
                    <div class="attribute-item">
                        <label>Name</label>
                        <input placeholder="Name" value="" type="text" name="name">
                    </div>
                      <div class="attribute-item">
                        <label>color</label>
                        <input  value="#0F52BA" type="color" name="color">
                      </div>
                    <div class="btn-container">
                        <button type="submit" class="btn btn-yellow">Save</button>
                    </div>
                </form>
    `);
}

saveFeature = evt => {
    evt.preventDefault();
    evt.stopPropagation();
    let cutPoly = evt.target.dataset['cutPoly'];
    if ((drawing && drawing.hasOwnProperty('properties')) || upperCutPolygon || lowerCutPolygon) {
        const name = evt.target.elements['name'].value || '';
        const color = evt.target.elements['color'].value || "#0F52BA";
        let body;
        if (cutPoly === 'false') {
            drawing.properties.name = name;
            drawing.properties.color = color;
            body = {
                name, geoJSON: JSON.stringify(drawing)
            }
        } else if (cutPoly === 'upperCut' && upperCutPolygon) {
            upperCutPolygon.feature.properties.name = name;
            upperCutPolygon.feature.properties.color = color;
            body = {
                name, geoJSON: JSON.stringify(upperCutPolygon.feature)
            }
        } else if (cutPoly === 'lowerCut' && lowerCutPolygon) {
            lowerCutPolygon.feature.properties.name = name;
            lowerCutPolygon.feature.properties.color = color;
            body = {
                name, geoJSON: JSON.stringify(lowerCutPolygon.feature)
            }
        }

        fetch(editingLayerUrl, {
            method: 'POST', headers: {
                'Content-Type': 'application/json',
            }, body: JSON.stringify(body)
        }).then(res => res.json())
            .then(data => {
                if (cutPoly === 'false') {
                    drawnPolygons.clearLayers();
                } else if (cutPoly === 'upperCut') {
                    upperCutPolygon.closePopup();
                    upperCutPolygon = null;
                } else if (cutPoly === 'lowerCut') {
                    lowerCutPolygon.closePopup();
                    lowerCutPolygon = null;
                }

                let gJson = L.geoJSON(JSON.parse(data.geoJSON));
                const layer = gJson.getLayers()[0]
                layer.feature.properties.id = data.id;
                addZonalLayer(editingLayer, layer);
                drawing = null;

            });
    }
}

function modifyAttribute(evt) {
    evt.preventDefault();
    evt.stopPropagation();
    const id = evt.target.elements['id'].value;
    const name = evt.target.elements['name'].value;
    const color = evt.target.elements['color'].value || "#0F52BA";

    const layerName = evt.target.dataset['layer'];
    let layerGroup = null;
    if (layerName === 'zone') {
        layerGroup = zone
    } else if (layerName === 'subzone') {
        layerGroup = subZone;
    }


    const layer = getFeatureById(id, layerGroup);

    if (layer) {
        let jsonFeature = layer.toGeoJSON();
        jsonFeature.properties.id = id;
        jsonFeature.properties.name = name;
        jsonFeature.properties.color = color;
        const body = {
            id: parseInt(jsonFeature.properties.id),
            name: jsonFeature.properties.name,
            geoJSON: JSON.stringify(jsonFeature)
        }


        fetch(evt.target.dataset['url'] + "/" + id, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        }).then(res => {
            if (res.ok) {
                layer.feature.properties.name = name;
                jsonFeature.properties.color = color;
                bindPropertyOnLayer(layer);
                alert('Successfully Modify');
            } else {
                alert('Something Error');
            }
        });
    }

}

function deleteFeature(evt, id) {
    evt.preventDefault();
    evt.stopPropagation();
    const layerName = evt.target.dataset['layer'];
    let layerGroup = null;
    if (layerName === 'zone') {
        layerGroup = zone
    } else if (layerName === 'subzone') {
        layerGroup = subZone;
    }


    if (confirm("Do you want to delete?")) {
        fetch(evt.target.dataset['url'] + "/" + id, {
            method: 'DELETE'
        }).then(
            res => {
                if (res.ok) {
                    let layer = getFeatureById(id, layerGroup);
                    layerGroup.removeLayer(layer);
                    alert('Successfully Deleted')
                } else {
                    alert('Something Error')
                }
            }
        )
    }

}


function splitFeature(evt, id) {
    splitEvent = evt;
    const subZonInput = document.querySelector('#subZoneInput');
    subZonInput.checked = true;
    subZonInput.dispatchEvent(new Event('change'));
    const layerName = evt.target.dataset['layer'];
    let layerGroup = null;
    if (layerName === 'zone') {
        layerGroup = zone
    } else if (layerName === 'subzone') {
        layerGroup = subZone;
    }

    const layer = getFeatureById(id, layerGroup);

    layer.closePopup();
    layer.setStyle({
        color: '#b428de'
    });

    let geojson = layer.toGeoJSON();
    let geom = turf.getGeom(geojson);
    polygons.push(geom);

    drawnPolygons.clearLayers();
    drawnLines.clearLayers();
    drawnPolygons.addLayer(layer);
    splitLayer = layer;
}


fetch(zoneUrl, {
    method: 'GET', headers: {
        'Content-Type': 'application/json'
    },
})
    .then(res => res.json())
    .then(data => {
        data.forEach(d => {
            let gJson = L.geoJSON(JSON.parse(d.geoJSON));
            const layer = gJson.getLayers()[0]
            layer.feature.properties.id = d.id;
            addZonalLayer(zone, layer)

        });

    });

fetch(subZoneUrl, {
    method: 'GET', headers: {
        'Content-Type': 'application/json'
    },
})
    .then(res => res.json())
    .then(data => {
        data.forEach(d => {
            let gJson = L.geoJSON(JSON.parse(d.geoJSON));
            const layer = gJson.getLayers()[0]
            layer.feature.properties.id = d.id;
            addZonalLayer(subZone, layer);

        });
    });


// closeBtn.addEventListener('click', evt => {
//     sideBar.style.transform = 'translateX(100%)';
// });
//
// sideBar.addEventListener('open', evt => {
//     sideBar.style.transform = 'none';
// })
//
// attrName.addEventListener('input', evt => {
//     if (drawing && drawing.hasOwnProperty('properties')) {
//         drawing.properties.name = evt.target.value
//     }
// })
//
// attrSave.addEventListener('click', evt => {
//     if (drawing && drawing.hasOwnProperty('properties')) {
//
//         const body = {
//             name: drawing.properties.name, geoJSON: JSON.stringify(drawing)
//         }
//
//         fetch(zoneUrl, {
//             method: 'POST', headers: {
//                 'Content-Type': 'application/json',
//             }, body: JSON.stringify(body)
//         }).then(res => res.json())
//             .then(data => {
//                 console.log(data);
//             });
//     }
// })

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


function cutPolygon(polygon, line, direction, id) {
    let j;
    let polyCoords = [];
    let cutPolyGeoms = [];
    let retVal = null;

    if ((polygon.type != 'Polygon') || (line.type != 'LineString')) return retVal;

    let intersectPoints = turf.lineIntersect(polygon, line);
    let nPoints = intersectPoints.features.length;
    if ((nPoints == 0) || ((nPoints % 2) != 0)) return retVal;

    let offsetLine = turf.lineOffset(line, (0.01 * direction), {units: 'kilometers'});

    for (j = 0; j < line.coordinates.length; j++) {
        polyCoords.push(line.coordinates[j]);
    }
    for (j = (offsetLine.geometry.coordinates.length - 1); j >= 0; j--) {
        polyCoords.push(offsetLine.geometry.coordinates[j]);
    }
    polyCoords.push(line.coordinates[0]);
    let thickLineString = turf.lineString(polyCoords);
    let thickLinePolygon = turf.lineToPolygon(thickLineString);

    let clipped = turf.difference(polygon, thickLinePolygon);
    for (j = 0; j < clipped.geometry.coordinates.length; j++) {
        let polyg = turf.polygon(clipped.geometry.coordinates[j]);
        let overlap = turf.lineOverlap(polyg, line, {tolerance: 0.005});
        if (overlap.features.length > 0) {
            cutPolyGeoms.push(polyg.geometry.coordinates);
        }
    }

    if (cutPolyGeoms.length == 1)
        retVal = turf.polygon(cutPolyGeoms[0], {id: id});
    else if (cutPolyGeoms.length > 1) {
        retVal = turf.multiPolygon(cutPolyGeoms, {id: id});
    }

    return retVal;
}


map.on(L.Draw.Event.CREATED, function (event) {

    let layer = event.layer;
    let geojson = layer.toGeoJSON();
    let geom = turf.getGeom(geojson);
    upperCutPolygon = null;
    lowerCutPolygon = null;
    drawing = null;

    if (geom.type === 'Polygon') {
        const zonInput = document.querySelector('#zoneInput');
        zonInput.checked = true;
        zonInput.dispatchEvent(new Event('change'));

        drawing = event.layer.toGeoJSON();
        const layer = event.layer;
        bindPopupForSave(layer);
        // zone.addLayer(layer);
        drawnPolygons.addLayer(layer);
        layer.openPopup();
        // sideBar.dispatchEvent(new Event('open'));

    } else if (geom.type === 'LineString') {
        let line = geom;
        let isDelete = confirm('Do you want to delete original polygon?');
        if (isDelete) {
            deleteFeature(splitEvent, splitLayer.feature.properties.id)
        }
        splitLayer = null;
        drawnLines.addLayer(layer);
        drawnPolygons.clearLayers();
        polygons.forEach(function (polygon, index) {
            let layer;
            let upperCut = cutPolygon(polygon, line, 1, 'upper');
            let lowerCut = cutPolygon(polygon, line, -1, 'lower');
            if ((upperCut != null) && (lowerCut != null)) {
                layer = L.geoJSON(upperCut, {
                    style: function (feature) {
                        return {color: 'green'};
                    }
                }).getLayers()[0];
                bindPopupForSave(layer, 'upperCut');
                upperCutPolygon = layer;
                drawnPolygons.addLayer(layer);

                layer = L.geoJSON(lowerCut, {
                    style: function (feature) {
                        return {color: 'yellow'};
                    }
                }).getLayers()[0];
                bindPopupForSave(layer, 'lowerCut');
                lowerCutPolygon = layer;
                drawnPolygons.addLayer(layer);
                drawnLines.clearLayers();

            }

        });

    }
});

// let radio = document.workLayerForm.editingLayer;
// let prev = null;
// for (var i = 0; i < radio.length; i++) {
//     radio[i].addEventListener('change', function () {
//         (prev) ? console.log(prev.value) : null;
//         if (this !== prev) {
//             prev = this;
//         }
//         console.log(this.value)
//     });
// }

function onWorkingLayerChange(evt) {
    map.removeControl(drawControl);
    console.log(evt.target.value);
    if (evt.target.value === 'zone') {
        editingLayer = zone;
        editingLayerUrl = zoneUrl;
    } else {
        editingLayer = subZone;
        editingLayerUrl = subZoneUrl;
    }
    reInitiateDraw();

}

function reInitiateDraw() {
    drawControl = new L.Control.Draw({
        draw: {
            marker: false, circle: false, circlemarker: false, rectangle: false, polygon: {
                allowIntersection: false, showArea: true
            }
        }, edit: {
            featureGroup: editingLayer,
            poly: {
                allowIntersection: false
            },
            remove: false
        },
    });

    map.addControl(drawControl);
}

map.on('zoomstart', function () {
    let zoomLevel = map.getZoom();
    let tooltips = document.querySelectorAll('.leaflet-tooltip');
    tooltips.forEach(tooltip => {
        tooltip.style.fontSize = `${zoomLevel + 1}px`;
    })

});

function addZonalLayer(featureGroup, layer) {
    if (featureGroup === zone) {
        layer.featureGroup = 'zone';
        layer.url = zoneUrl;

    } else if (featureGroup === subZone) {
        layer.featureGroup = 'subzone';
        layer.url = subZoneUrl;
    }
    bindPropertyOnLayer(layer);
    featureGroup.addLayer(layer);
}