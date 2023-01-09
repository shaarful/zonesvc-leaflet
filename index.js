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


let popupContent = document.querySelector("#popup-content");


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
let polygon = null;
let upperCutPolygon = null;
let lowerCutPolygon = null;
let splitLayer = null;
let splitEvent = null;
let isLinkActive = false;


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
                <form onsubmit="return modifyAttribute(event)"
                 data-layer="${layer.featureGroup}" data-url="${layer.url}"
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
                        <button data-layer="${layer.featureGroup}" data-url="${layer.url}"
                        type="button" onclick="linkFeature(event, ${layer.feature.properties.id})" class="btn btn-green">Link</button>
                        <button type="submit" class="btn btn-yellow">Save</button>
                    </div>
                </form>
            `)
}

function bindPopupForSave(layer, cutPoly = false, parentZoneId = -1) {
    layer.bindPopup(`
                <form data-cut-poly="${cutPoly}" data-parent-zone-id="${parentZoneId}"
                onsubmit="return saveFeature(event)" class="attribute-popup-content">
                    <div class="attribute-item">
                        <label>Name</label>
                        <input placeholder="Name" value="" type="text" name="name">
                    </div>
                      <div class="attribute-item">
                        <label>Color</label>
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
    let parentZoneId = parseInt(evt.target.dataset['parentZoneId']);
    // console.log(parentZoneId);

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
            upperCutPolygon.feature.properties.parentId = parentZoneId;

            body = {
                name, parentZoneId, geoJSON: JSON.stringify(upperCutPolygon.feature)
            }
        } else if (cutPoly === 'lowerCut' && lowerCutPolygon) {
            lowerCutPolygon.feature.properties.name = name;
            lowerCutPolygon.feature.properties.color = color;
            lowerCutPolygon.feature.properties.parentZoneId = parentZoneId;
            body = {
                name, parentZoneId, geoJSON: JSON.stringify(lowerCutPolygon.feature)
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
                    drawnPolygons.removeLayer(upperCutPolygon);
                    upperCutPolygon = null;
                } else if (cutPoly === 'lowerCut') {
                    lowerCutPolygon.closePopup();
                    drawnPolygons.removeLayer(lowerCutPolygon);
                    lowerCutPolygon = null;
                }

                let gJson = L.geoJSON(JSON.parse(data.geoJSON));
                const layer = gJson.getLayers()[0]
                layer.feature.properties.id = data.id;
                addZonalLayer(editingLayer, layer);
                drawing = null;
                showPopup('Save Successfully')

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
                showPopup('Successfully Modify')
            } else {
                showPopup('Something Error');
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
                    showPopup('Successfully Deleted')
                } else {
                    showPopup('Something Error')
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
    // layer.setStyle({
    //     color: '#b428de'
    // });

    let geojson = layer.toGeoJSON();
    polygon = turf.getGeom(geojson);

    let gJson = L.geoJSON(geojson);
    const newLayer = gJson.getLayers()[0]

    newLayer.setStyle({
        color: '#b428de'
    });

    drawnPolygons.clearLayers();
    drawnLines.clearLayers();
    drawnPolygons.addLayer(newLayer);
    splitLayer = layer;

}

function saveLink(evt) {
    evt.preventDefault();
    evt.stopPropagation();
    let body = {
        "parentZoneId": evt.target.elements.origin.value,
        "linkedZoneId": evt.target.elements.destination.value,
        "value": evt.target.elements.numVal.value
    }

    fetch('http://api.zonesvc.techamus.co.uk/api/ZoneLinks', {
        method: 'POST', headers: {
            'Content-Type': 'application/json',
        }, body: JSON.stringify(body)
    }).then(res => res.json())
        .then(data => {
            console.log(data);
            showPopup('Save Successfully')

        });
}

let swoopyLines = [];

function linkFeature(evt, id) {
    const layer = getFeatureById(id, editingLayer);

    let origin = layer.getBounds().getCenter();

    swoopyLines.forEach(line => {
        map.removeLayer(line);
    });
    swoopyLines = [];

    editingLayer.getLayers().forEach(destination => {

        let directionalLine = L.polyline(
            [origin, destination.getBounds().getCenter(),],
            {color: destination.options.color, weight: 3.5})
            .arrowheads({fill: true, color: destination.options.color, size: "2%", repeat: 30,})
            .bindPopup(`<form onsubmit="return saveLink(event)"
                 class="attribute-popup-content">
                    <input readonly disabled value="${layer.feature.properties.id}" type="hidden" name="origin">
                    <input readonly disabled value="${destination.feature.properties.id}" type="hidden" name="destination">
                    <div style="font-size: 1.2rem; color: #000000"><strong>${layer.feature.properties.name}</strong> to <strong>${destination.feature.properties.name}</strong></div>
                    <div class="attribute-item">
                        <label>Number</label>
                        <input placeholder="Number" min="0" maxlength="0.01" value="0" type="number" name="numVal">
                    </div>
       
                    <div class="btn-container">
                        <button type="submit" class="btn btn-yellow">Save</button>
                    </div>
                </form>`).addTo(map);


        swoopyLines.push(directionalLine);


    })


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


function polygonCut(polygon, line) {
    const THICK_LINE_UNITS = 'kilometers';
    const THICK_LINE_WIDTH = 0.001;
    let i, j, intersectPoints, lineCoords, forCut, forSelect;
    let thickLineString, thickLinePolygon, clipped, polyg, intersect;
    let polyCoords = [];
    let cutPolyGeoms = [];
    let cutFeatures = [];
    let offsetLine = [];
    let retVal = null;

    if (((polygon.type !== 'Polygon') && (polygon.type !== 'MultiPolygon')) || (line.type !== 'LineString')) {
        return retVal;
    }


    intersectPoints = turf.lineIntersect(polygon, line);
    if (intersectPoints.features.length === 0) {
        return retVal;
    }

    lineCoords = turf.getCoords(line);
    if ((turf.booleanWithin(turf.point(lineCoords[0]), polygon) ||
        (turf.booleanWithin(turf.point(lineCoords[lineCoords.length - 1]), polygon)))) {
        return retVal;
    }

    offsetLine[0] = turf.lineOffset(line, THICK_LINE_WIDTH, {units: THICK_LINE_UNITS});
    offsetLine[1] = turf.lineOffset(line, -THICK_LINE_WIDTH, {units: THICK_LINE_UNITS});

    for (i = 0; i <= 1; i++) {
        forCut = i;
        forSelect = (i + 1) % 2;
        polyCoords = [];
        for (j = 0; j < line.coordinates.length; j++) {
            polyCoords.push(line.coordinates[j]);
        }
        for (j = (offsetLine[forCut].geometry.coordinates.length - 1); j >= 0; j--) {
            polyCoords.push(offsetLine[forCut].geometry.coordinates[j]);
        }
        polyCoords.push(line.coordinates[0]);

        thickLineString = turf.lineString(polyCoords);
        thickLinePolygon = turf.lineToPolygon(thickLineString);
        clipped = turf.difference(polygon, thickLinePolygon);

        cutPolyGeoms = [];
        for (j = 0; j < clipped.geometry.coordinates.length; j++) {
            polyg = turf.polygon(clipped.geometry.coordinates[j]);
            intersect = turf.lineIntersect(polyg, offsetLine[forSelect]);
            if (intersect.features.length > 0) {
                cutPolyGeoms.push(polyg.geometry.coordinates);
            }
        }

        cutPolyGeoms.forEach(function (geometry, index) {

            cutFeatures.push(turf.polygon(geometry));
        });
    }

    if (cutFeatures.length > 0) retVal = turf.featureCollection(cutFeatures);

    return retVal;
}

function cutPolygon(polygon, line, direction, id) {
    let j;
    let polyCoords = [];
    let cutPolyGeoms = [];
    let retVal = null;


    if ((polygon.type !== 'Polygon') || (line.type !== 'LineString')) return retVal;

    let intersectPoints = turf.lineIntersect(polygon, line);
    let nPoints = intersectPoints.features.length;

    if ((nPoints === 0) || ((nPoints % 2) !== 0)) return retVal;

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
        // console.log(overlap, polyg, line);
        if (overlap.features.length > 0) {
            cutPolyGeoms.push(polyg.geometry.coordinates);
        }
    }
    // L.geoJSON(clipped, {
    //     style: function (feature) {
    //         return {color: 'red'};
    //     }
    // }).addTo(map)

    if (cutPolyGeoms.length === 1)
        retVal = turf.polygon(cutPolyGeoms[0], {id: id});
    else if (cutPolyGeoms.length > 1) {
        retVal = turf.multiPolygon(cutPolyGeoms, {id: id});
    }

    return retVal;
}

map.on(L.Draw.Event.DRAWSTART, function (event) {
    drawnLines.clearLayers();
});

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

        if (polygon && splitLayer) {
            let line = geom;
            // let isDelete = confirm('Do you want to delete original polygon?');
            // if (isDelete) {
            //     deleteFeature(splitEvent, splitLayer.feature.properties.id)
            // }

            drawnLines.addLayer(event.layer);
            drawnPolygons.clearLayers();

            let layer;

            let cut = polygonCut(polygon, line)
            // console.log(cutp);
            //
            // let upperCut = cutPolygon(polygon, line, 1, 'upper');
            // let lowerCut = cutPolygon(polygon, line, -1, 'lower');
            // console.log(upperCut, lowerCut);
            // if ((upperCut != null) && (lowerCut != null)) {
            if (cut && cut.features.length > 1) {
                let cutFeatures = cut.features;
                layer = L.geoJSON(cutFeatures[0], {
                    style: function (feature) {
                        return {color: 'green'};
                    }
                }).getLayers()[0];

                bindPopupForSave(layer, 'upperCut', splitLayer.feature.properties.id);
                upperCutPolygon = layer;
                drawnPolygons.addLayer(layer);

                layer = L.geoJSON(cutFeatures[1], {
                    style: function (feature) {
                        return {color: 'yellow'};
                    }
                }).getLayers()[0];
                bindPopupForSave(layer, 'lowerCut', splitLayer.feature.properties.id);
                lowerCutPolygon = layer;
                drawnPolygons.addLayer(layer);
                polygon = null;

                splitLayer = null;
                drawnLines.clearLayers();

            } else {
                drawnPolygons.addLayer(splitLayer);
            }

        } else {
            showPopup('Please select a layer for split!')
        }
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
    if (evt.target.value === 'zone') {
        editingLayer = zone;
        editingLayerUrl = zoneUrl;
        isLinkActive = false;
    } else if (evt.target.value === 'subZone') {
        editingLayer = subZone;
        editingLayerUrl = subZoneUrl;
        isLinkActive = false;
    } else if (evt.target.value === 'link') {
        isLinkActive = true;
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
        tooltip.style.fontSize = `${zoomLevel + 1}
        px`;
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

function showPopup(message, timeout = 1500) {
    popupContent.innerText = message;
    popupContent.parentNode.classList.remove('hover-out');
    setTimeout(() => {
        popupContent.parentNode.classList.add('hover-out');
    }, timeout)
}

function closePopup() {
    popupContent.parentNode.classList.remove('hover-out');
}