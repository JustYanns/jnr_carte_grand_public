// Fichier script.js

// global variables 
var csvData;
var map;
var markers = L.markerClusterGroup();

// global variables for action table
var plottedData = [];
var geoFilter;
var catActionFilter = "";

var OSM_dpt_data;

var select_all_risque = true;
var select_all_public = true;

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
const dateFormatterCompact = new Intl.DateTimeFormat('fr-FR');
const date_JNR = new Date(2025, 10, 13)
const date_today = new Date();

var zoomCircle;

// Création des markers

const riskNat_marker = L.icon({
    iconUrl : "./icons/map_marker_nat.png",
    iconSize : [33,46],
    iconAnchor : [11,46],
    popupAnchor : [0,-46]
})

const riskTEch_marker = L.icon({
    iconUrl : "./icons/map_marker_techno.png",
    iconSize : [33,46],
    iconAnchor : [11,46],
    popupAnchor : [0,-46]
})

const riskMult_marker = L.icon({
    iconUrl : "./icons/map_marker_mixte.png",
    iconSize : [33,46],
    iconAnchor : [11,46],
    popupAnchor : [0,-46]
})

const riskGeste_marker = L.icon({
    iconUrl : "./icons/map_marker_geste.png",
    iconSize : [33,46],
    iconAnchor : [11,46],
    popupAnchor : [0,-46]
})

const riskNat_marker_b = L.icon({
    iconUrl : "./icons/map_marker_nat.png",
    iconSize : [33,46],
    iconAnchor : [11,46],
    popupAnchor : [0,-46]
})

const riskTEch_marker_b = L.icon({
    iconUrl : "./icons/map_marker_techno.png",
    iconSize : [33,46],
    iconAnchor : [11,46],
    popupAnchor : [0,-46]
})
const riskMult_marker_b = L.icon({
    iconUrl : "./icons/map_marker_mixte.png",
    iconSize : [33,46],
    iconAnchor : [11,46],
    popupAnchor : [0,-46]
})
const riskGeste_marker_b = L.icon({
    iconUrl : "./icons/map_marker_geste.png",
    iconSize : [33,46],
    iconAnchor : [11,46],
    popupAnchor : [0,-46]
})



// Function for filter the list returned by papa parse : intersection
function filter_column(data, col_name, on_true=true) {
    if (on_true) {
        return data.filter(i => i[col_name])
    } else {
        return data.filter(i => !i[col_name])
    }
}

function filter_columns_AND(data, col_names) {

    col_names.forEach(function(col) {
        data = data.filter(i => i[col])
    })

    return data;

};

// Function for filter the list returned by papa parse : union
function filter_columns_OR(data, col_names) {

    var values;

    data = data.filter(function(i) {

        values = [];
        // On récupère les valeurs prises par les différentes colonnes
        col_names.forEach(col => values.push(i[col]))

        return values.includes(true);

    });

    return data;

};

// Fonctio pour filtrer sur les risques et ensuite sur les publics
function filter_risque_public_type_action(data, risques, publics, types_action) {

    var values_publics, values_risques, values_type_action;

    data = data.filter(function(i) {

        values_publics=[];
        values_risques=[];
        values_type_action=[];

        if (risques.length > 0) {
            risques.forEach(col => values_risques.push(i[col]));
        } else {
            values_risques.push(true);
        }

        if (publics.length > 0) {
            publics.forEach(col => values_publics.push(i[col]));
        } else {
            values_publics.push(true);
        }

        if (types_action.length > 0) {
            types_action.forEach(col => values_type_action.push(i[col]));
        } else {
            values_type_action.push(true);
        }

        return values_risques.includes(true) && values_publics.includes(true) && values_type_action.includes(true)

    });

    return data;

};

// Function to compute great circle distance between two points
// All lat/lon in dregrees
function gc_distance(lat1, lon1, lat2, lon2) {

    const R = 6371e3; // metres
    const phi1 = lat1 * Math.PI/180; 
    const phi2 = lat2 * Math.PI/180;
    const dphi = (lat2-lat1) * Math.PI/180;
    const dlambda = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(dphi/2) * Math.sin(dphi/2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(dlambda/2) * Math.sin(dlambda/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    const d = R * c; // in metres

    return d;
}

// Function to filter actions based on maximum distance to a point 
// lat lon in degrees, max_dist in metres
function filter_distance(data, lat, lon, max_dist) {

    data = data.filter(function(i) {
        d = gc_distance(lat,lon,i.lat,i.lon)
        return d < max_dist;
    });

    return data;
}

// Function to filter based on insee_dep
function filtrer_dpt(data, dpt_code) {

    data = data.filter(function(i) {
        return i.insee_dep == dpt_code;
    });

    return data;
}

// Function to filter based on zone_geo_projet
function filtrer_zone_geo(data, zone_geo) {

    data = data.filter(function(i) {
        return i.zone_geo_projet == zone_geo;
    });

    return data;
}

// function to count number of true values
function count_true(data, col_name) {

    var counter = 0;

    data.forEach(function(row){

        if (row[col_name] === "True") {
            counter += 1;
        }
    })

    return counter;
}

function filter_passed_date(data) {

    data = data.filter(function(i) {
        return i.date_fin.getTime() > date_today.getTime();
    });

    return data;

}

// function for plotting markers
function plot_actions_markers(data) {

    var nb_actions = 0;

    // effacement des marqueurs précédents
    markers.clearLayers()

    // effacer liste des marqueurs plttés
    plottedData = [];

    // Parcours des données et création des marqueurs
    data.forEach(function (item) {
        var lat = item.lat;
        var lon = item.lon;

        // Vérification si les coordonnées sont valides (pas NaN) et que date fin > date du jour
        // if (!isNaN(lat) && !isNaN(lon) && (item.date_fin.getTime() >= date_today.getTime())) {
        if (!isNaN(lat) && !isNaN(lon) && !isNaN(item.date_debut) && !isNaN(item.date_fin)) {
            plottedData.push({
                "nom" : item.nom,
                "organisateur" : item.organisateur,
                "coporteurs" : item.coporteurs,
                "type_action_str" : item.type_action_str ,
                "public_cible_str" : item.public_cible_str ,
                "risque_cible_str" : item.risque_cible_str,
                "adresse" : item.adresse ,
                "date_debut" : dateFormatterCompact.format(item.date_debut) ,
                "date_fin" : dateFormatterCompact.format(item.date_fin),
                "lien_programme" : item.lien_programme,
                "lon" : item.lon ,
                "lat" : item.lat ,
                "insee_dep" : item.insee_dep
            })

            nb_actions += 1;

            var description = item.description_action;
            const NB_MAX_CHAR = 800;
            if (description.length > NB_MAX_CHAR){
                description = description.slice(0,NB_MAX_CHAR) + "..."
            }

            var popupContent;
            if (item.est_grand_public){
                popupContent = '<strong>' + item.nom + '</strong><br><em>' + item.adresse + '</em><br>'
            } else {
                popupContent = '<strong>' + item.nom + '</strong><br><span style="color:red"> (Action non ouverte au grand public)</span><br><em>' + item.adresse + '</em><br>'
            }

            if (item.date_debut.getTime() === item.date_fin.getTime()) {
                if (item.date_debut.getTime() === date_JNR.getTime()) {
                    popupContent += "Le 13/10/2025, Journée nationale de la résilience"
                } else {
                    popupContent += "Le " + dateFormatter.format(item.date_debut)
                }
            } else {
                popupContent += 'Du ' + dateFormatter.format(item.date_debut) + ' au ' + dateFormatter.format(item.date_fin)
            }

            // action passée

            if ((item.date_fin.getTime()+24*3600*1000 < date_today.getTime())) {
                popupContent += '<span style="color:red"> (Action passée)</span>'
                // popupContent += ' (Action passée)'
            }
            popupContent += "</br>"
            
            popupContent += '<strong>Organisé par :</strong> ' + item.organisateur

            if (item.coporteurs) {
                popupContent += ' (<em>Coporteurs :</em> ' + item.coporteurs + ')'
            }
            popupContent += '<br><strong>Accessibilité PSH/PMR : </strong>' + (item.est_accessible_pmr ? "Oui" : "Non");

            
            popupContent += 
                '<br><strong>Public ciblé : </strong>' +
                item.public_cible_str +
                "<br><strong>Type d'action : </strong>" +
                item.type_action_str +
                '<br><strong>Sujet de l’action : </strong>' +
                item.risque_cible_str;
            
            // Lien vers plus d'information
            if (item.lien_programme) {
                popupContent += "<br><strong>Lien vers les ressources :</strong> <a href=" + item.lien_programme + ' target="_blank">ici</a>';
            }
            if (item.lien_inscription) {
                popupContent += "<br><strong>Lien vers l'inscription :</strong> <a href=" + item.lien_inscription + ' target="_blank">ici</a>';
            }
            if (item.lien_demat) {
                popupContent += "<br><strong>Lien vers la ressource dématérialisée :</strong> <a href=" + item.lien_demat + ' target="_blank">ici</a>';
            }


            if (item.est_grand_public) {
                if (item.est_multirisques) {
                    var marker = L.marker([lat, lon],{icon: riskMult_marker}).bindPopup(popupContent);
                } else if (item.est_risques_naturels) {
                    var marker = L.marker([lat, lon],{icon: riskNat_marker}).bindPopup(popupContent);
                } else if (item.est_risques_technologiques) {
                    var marker = L.marker([lat, lon],{icon: riskTEch_marker}).bindPopup(popupContent);
                } else if (item.est_gestes_qui_sauvent) {
                    var marker = L.marker([lat, lon],{icon: riskGeste_marker}).bindPopup(popupContent);
                }
                else {
                    var marker = L.marker([lat, lon]).bindPopup(popupContent);
                } 
            } else {
                if (item.est_multirisques) {
                    var marker = L.marker([lat, lon],{icon: riskMult_marker_b}).bindPopup(popupContent);
                } else if (item.est_risques_naturels) {
                    var marker = L.marker([lat, lon],{icon: riskNat_marker_b}).bindPopup(popupContent);
                } else if (item.est_risques_technologiques) {
                    var marker = L.marker([lat, lon],{icon: riskTEch_marker_b}).bindPopup(popupContent);
                } else if (item.est_gestes_qui_sauvent) {
                    var marker = L.marker([lat, lon],{icon: riskGeste_marker_b}).bindPopup(popupContent);
                }
                else {  
                    var marker = L.marker([lat, lon]).bindPopup(popupContent);
                }
            }

            markers.addLayer(marker);

        }
    });

    map.addLayer(markers); // Ajout des marqueurs à la carte

    // affichage des marqueurs dans un tableau si demandé
    const dispActionsTable = $('#displayActionTable');
    if (dispActionsTable[0].checked) {
        fillMapTableActions();
    }

    return nb_actions;

};

function fillMapTableActions() {

    console.log(plottedData);
    console.log(geoFilter);

    if (catActionFilter.startsWith(" - ")){ 
        catActionFilter.substring(3);
    }

    // filtrage géographique si nécessaire
    if (geoFilter) {
        if (geoFilter["type"] === "departement") {

            data = filtrer_dpt(plottedData, geoFilter["dpt_code"]);
            catActionFilter = "Département " + geoFilter["dpt_code"] + " - " + catActionFilter;

        } else if (geoFilter["type"] === "coord_dist") {

            data = filter_distance(plottedData, geoFilter["lat"], geoFilter["lon"], geoFilter["distance"]);
            catActionFilter = geoFilter["distance"]/1000 + "km de " + geoFilter["adresse"] + " - " + catActionFilter;

        } 
    } else {
        console.log("Action table : no filter")
        data = plottedData;
    }

    // display it in table
    tableContainer = $("#mapActionTable");
    display_actions_table(data, tableContainer);

    // indicate filters
    $("#filter_state_table").empty();
    $("#filter_state_table").html(catActionFilter);

};

function display_actions_table(data, tableContainer) {
    
    var table = $("<table>").addClass("table table-bordered table-striped");

    var thead = $("<thead>");
    var headerRow = $("<tr>");


    ["Nom de l'action", "Organisateur", "Type d'action", "Public ciblé", "Risques traités", "Adresse", "Date de début", "Date de fin", "Ressource externe"].forEach(function(item) {
        var th = $("<th>").text(item);
        headerRow.append(th);
    }) 

    thead.append(headerRow);
    table.append(thead);

    // Corps du tableau
    var tbody = $("<tbody>");

    $.each(data, function (index, item) {

        var row = $("<tr>");

        $.each(["nom","organisateur","type_action_str","public_cible_str","risque_cible_str","adresse","date_debut","date_fin","lien_programme","lien_inscription","lien_demat"], function (index, label) {
            var cell = $("<td>").text(item[label]);
            row.append(cell);
        });
    
        tbody.append(row);

    });

    table.append(tbody);

    tableContainer.html(table)

}


function display_actions_table_demat(data, tableContainer) {
    
    var table = $("<table>").addClass("table table-bordered table-striped");

    var thead = $("<thead>");
    var headerRow = $("<tr>");

    ["Nom de l'action", "Organisateur", "Type d'action", "Lien vers la ressource"].forEach(function(item) {
        var th = $("<th>").text(item);
        headerRow.append(th);
    }) 

    thead.append(headerRow);
    table.append(thead);

    // Corps du tableau
    var tbody = $("<tbody>");

    $.each(data, function (index, item) {

        if (item["lien_programme"]) {
            var row = $("<tr>");

            $.each(["nom","organisateur","type_action_str"], function (index, label) {
                var cell = $("<td>").text(item[label]);
                row.append(cell);
            });
    
            var cell = $("<td>").html(`<a href=${item["lien_programme"]}>${item["lien_programme"]}</a>` );
            row.append(cell);
    
            tbody.append(row);
        }
    });

    table.append(tbody);

    tableContainer.html(table)

}

function display_dematerialized_actions_zone_geo(zone_geo){

    // Que actions dématerialisées
    var data = filter_column(csvData.data);

    // Que action dans la zone geo 
    data = filtrer_zone_geo(data, zone_geo);

    // Display actions in table
    tableContainer = $("#actions_demat");
    display_actions_table_demat(data, tableContainer);
}


$(document).ready(function () {

    // Création de la carte avec Leaflet
    map = L.map('map').setView([46.5, 2.3522],5); // Coordonnées de départ et niveau de zoom

    // L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map); // Fond de carte OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Chargement du fichier CSV
    $.ajax({
        url: 'data/actions_jnr.csv',
        dataType: 'text',
        success: function (data) {
            
            csvData = Papa.parse(data, { header: true, skipEmptyLines: true });
            
            
            // On parse les colonnes de booléens et de flottant 
            var float_cols = ["lat","lon"]

            var bool_cols = [
                "est_grand_public",

                "est_dematerialisee",

                "est_multirisques",
                "est_risques_naturels",
                "est_risques_technologiques",
                "est_gestes_qui_sauvent",

                "est_inondations",
                "est_feux_de_foret",
                "est_tempete_cyclone",
                "est_seisme",
                "est_eruption_volcanique",
                "est_mouvement_de_terrain",
                "est_risques_littoraux",
                "est_avalanche",
                "est_radon",
                "est_accidents_industriels",
                "est_accidents_nucleaires",
                "est_rupture_de_barrage",
                "est_transport_de_matieres_dangereuses",

                "est_accessible_pmr",

                "est_tout_public",
                "est_jeune_public",
                "est_public_vulnerable",

                'est_atelier_jeux',
                'est_atelier_sensibilisation',
                'est_conference',
                'est_exercice_de_gestion_de_crise',
                'est_exposition',
                'est_formation',
                'est_reunion_d_information',
                'est_spectacle',
                'est_visite_en_plein_air',
                'est_visite_en_interieur']

            var date_cols = ["date_debut", "date_fin"]
            var str_cols = ["insee_dep"]

            // Liste des champs de zones géographiques
            zones_geo_labels = []

            var dateString, dateParts;
            
            csvData.data.forEach(function(row) {

                float_cols.forEach(function(col_name) {
                    row[col_name] = parseFloat(row[col_name])
                })

                // Convertir les valeurs "True" et "False" en booléens
                bool_cols.forEach(function(col_name) {
                    row[col_name] = row[col_name] === "True" ? true : false
                })

                date_cols.forEach(function(col_name) {
                    dateString = row[col_name];
                    dateParts = dateString.split("-"); // Divise la chaîne en trois parties : année, mois, jour
                    // Mois vont de 0 à 11 en js
                    row[col_name] = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
                })

                // lien programme 
                liste_label_lien = ["lien_programme", "lien_inscription", "lien_demat"]
                liste_label_lien.forEach(function(col_name) {
                    if (row[col_name]) {
                        if (!(row[col_name].startsWith("http://") || row[col_name].startsWith("https://")) && !row[col_name].startsWith("www.")) {
                            row[col_name] = "http://www." + row[col_name];
                        } else if (row[col_name].startsWith("www.") && !row[col_name].startsWith("http://")) {
                            row[col_name] = "http://" + row[col_name];
                        }
                    }
                })

                // zone geo
                if (row["est_dematerialisee"] && row["lien_programme"]) {
                    zones_geo_labels.push(row["zone_geo_projet"]);
                }

            });

            // // Restreindre aux actions grand public
            // var data = filter_column(csvData.data, "est_grand_public");

            // // Restreinddre aux actions futures
            // data = filter_passed_date(data);

            // Afficher toutes les actions
            data = csvData.data

            // plot des marqueurs
            var nb_actions = plot_actions_markers(data);

            // Ajout de la légende
            var legend = L.control({position: 'bottomleft'});

            legend.onAdd = function (map) {

                var div = L.DomUtil.create('div', 'info legend');
                labels = ['<strong>Sujets traités durant l\'événement</strong>'],

                labels.push('<span style="color:#38a9dd">◼</span> (N/T) Multirisques');
                labels.push('<span style="color:#72b026">◼</span> (N) Risques naturels');
                labels.push('<span style="color:#d33d2a">◼</span> (T) Risques technologiques');
                labels.push('<span style="color:#ff8c00">◼</span> (G) Gestes qui sauvent');

                // labels.push('<i class="bi bi-circle-fill" style="color:#38a9dd"></i> Multirisques');
                // labels.push('<i class="bi bi-circle-fill" style="color:#72b026"></i> Risques naturels');
                // labels.push('<i class="bi bi-circle-fill" style="color:#d33d2a"></i> Risques technologiques');

                div.innerHTML = labels.join('<br>');    

                // Add class
                div.classList.add("btn");
                div.classList.add("btn-light");
                div.classList.add("text-start");

                return div;
            };
            legend.addTo(map);

            //// Affichage des actions dématerialisées
            //data = filter_column(csvData.data, "est_dematerialisee");

            //// Décompte des actions
            //nb_actions_total = csvData.data.length;
            //// $("#action_counter").html(`<strong>${nb_actions_total}</strong> actions recensées pour le moment`)
            //// $("#action_counter").html(`<strong>${nb_actions_total}</strong> actions recensées pour le moment.`)
            //// $("#action_count_detail").html(`Dont <strong>${data.length}</strong> actions dématerialisées.`)

            //// Zones géographiques 

            //function onlyUnique(value, index, array) {
            //    return array.indexOf(value) === index;
            //}

            //// Renseignement des champs pour le menu déroulant
            //var selectZoneGeoActionsDemat = $("#selectZoneGeoActionsDemat");
            //zones_geo_labels.unshift("971-GUADELOUPE")
            //zones_geo_labels = zones_geo_labels.filter(onlyUnique);
            //for (var i = 0; i < zones_geo_labels.length; i++) {
            //    var option = $("<option>");
            //    option.text(zones_geo_labels[i]);
            //    selectZoneGeoActionsDemat.append(option);
            //}

            //display_dematerialized_actions_zone_geo(zones_geo_labels[0]);
        
        }
    });

    // Chargement des info de zoom sur les départements
    fetch('./data/dpt_zoom_info.json')
        .then(response => response.json())
        .then(data => {
            OSM_dpt_data = data;
        })
        .catch(error => console.error('Une erreur s\'est produite :', error));

    // Chargement des info nb action / dossier
    fetch('./data/statistiques_generales.json')
        .then(response => response.json())
        .then(data => {

            // $("#action_counter").html(`<strong>${data.nb_dossiers}</strong> dossiers labellisés pour un total de <strong>${data.nb_actions}</strong> actions organisées.`)
            $("#action_count_detail").html(`Dernière mise à jour : ${data.date_maj}`)
            
        })
        .catch(error => console.error('Une erreur s\'est produite :', error));


    // Boutons pour changer la vue de la carte

    var zoom_center_areas = {
        metropole : {coords : [47, 2.3522], zoom : 5},
        guadeloupe : {coords : [16.272048, -61.548002], zoom : 9},
        martinique : {coords : [14.670835, -61.009602], zoom : 10},
        guyane : {coords : [4.035282, -53.113578], zoom : 7},
        la_reunion : {coords : [-21.125720, 55.535528], zoom : 9},
        saint_pierre_et_miquelon : {coords : [46.954482, -56.327337], zoom : 10},
        mayotte : {coords : [-12.836948, 45.155820], zoom : 10},
        saint_barthelemy : {coords : [17.897977, -62.828982], zoom : 12},
        saint_martin : {coords : [18.075397, -63.051992], zoom : 12},
        wallis_et_futuna : {coords : [-13.845094, -177.239133], zoom : 8},
        polynesie_française : {coords : [-17.711357, -149.371015], zoom : 8},
        nouvelle_caledonie : {coords : [-21.405677, 165.531372], zoom : 8}
    }

    $('#selectRegion').change(function() {

        var zoom_data = zoom_center_areas[$(this).val()];
        map.setView(zoom_data["coords"], zoom_data["zoom"]);

    });

    displayActionTable = $("#displayActionTable");
    displayActionTable.change(function() {
        console.log("here");
        if (displayActionTable[0].checked) {
            fillMapTableActions();
        } else {
            tableContainer = $("#mapActionTable");
            tableContainer.empty();
            $("#filter_state_table").empty();
        }
    });

    // Fonction retournant les coordonnées lat lon à partir d'une adresse
    async function address2coordinates(address) {

        let url = `https://nominatim.openstreetmap.org/?adressdetails=1&q=${address.replaceAll(' ','+')}&format=json&limit=1`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
              throw new Error("Erreur lors de la récupération des données.");
            }
        
            const data = await response.json();

            if (data[0] === "undefined") {
                throw new Error("Adresse invalide.");
            }

            // console.log(data[0])

            const latitude = data[0].lat;
            const longitude = data[0].lon;
        
            return { latitude, longitude };
          } catch (error) {
            console.error("Erreur :", error.message);
            return null; // Ou vous pouvez renvoyer une valeur par défaut ou gérer l'erreur selon vos besoins.
          }
    }

    // Fonction retournant le département contenant des coordonnées
    async function getDepartmentFromCoordinates(latitude, longitude) {

        const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`;
      
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error("Erreur lors de la récupération des données.");
        }
        
        var department;
        const data = await response.json();
    
        // Récupérer le nom du département à partir des données renvoyées par l'API
        /*
        Pour les départements de l'Hexagone / de la Corse , l'API renvoie dans le champ "adress" un champ ​"ISO3166-2-lvl6" contenant l'information du département (ex : "FR-38")
        Pour les DOM/TOM, le champ "adress" ne contient pas de champ ​"ISO3166-2-lvl6" main un champ ​"ISO3166-2-lvl4" contenant l'identifiant INSEE_DEP (ex : "FR-973")
        */

        // Récupération des départements hexagone + corse
        if ("ISO3166-2-lvl6" in data.address) {
            department = data.address["ISO3166-2-lvl6"];
            if (department.slice(0,2) ==  "FR") {
                return department.split("-")[1];
            }
        }

        // Récupération des départements outre mer
        if ("ISO3166-2-lvl4" in data.address) {
            department = data.address["ISO3166-2-lvl4"];
            if (department.slice(0,2) ==  "FR") {
                return department.split("-")[1];
            }
        }

        // Apparement pas en France
        throw new Error("Erreur lors de la récupération du département.")

      }

    // Fonction pour centrer la carte sur les coordonnées données et ajuster le niveau de zoom
    function centerMap(map, latitude, longitude, distance) {
        // console.log(`Centering map on lat=${latitude} lon=${longitude} (distance=${distance}) `);
        map.setView([latitude, longitude], getZoomLevel(distance));
    }

    // Fonction pour afficher un cercle de la fenêtre concernée
    function addCircle(map, lat, lon , dist) {

        if (zoomCircle) {
            zoomCircle.remove();
        }

        zoomCircle = L.circle([lat, lon], {
            color: 'red', // Couleur du cercle
            fillColor: 'red', // Couleur de remplissage du cercle
            fillOpacity: 0.1, // Opacité du remplissage
            radius: dist // Convertir le rayon en mètres
        })
        
        zoomCircle.addTo(map);
    }
    
    // Fonction pour calculer le niveau de zoom en fonction de la distance choisie
    function getZoomLevel(distance) {
        if (distance <= 10000) {
        return 12;
        } else if (distance <= 20000) {
        return 11;
        } else if (distance <= 50000) {
        return 10;
        } else {
        return 9;
        }
    }

    // Fonction pour gérer la soumission du formulaire adresse 
    async function onSubmitForm(event) {
        console.log("onSubmitForm");

        event.preventDefault();
    
        var address = document.getElementById('addressInput').value;
        var distance = parseInt(document.getElementById('distanceSelect').value, 10);

        let latitude;
        let longitude;
        let dpt_code;

        try {
            const coordinates = await address2coordinates(address);
            if (!coordinates) {
                // Afficher le message d'erreur si les coordonnées sont null
                document.getElementById('error-message').innerText = 'Adresse invalide.';
                return ;
            } else {
                ({ latitude, longitude } = coordinates);
                document.getElementById('error-message').innerText = ''; // Effacer le message d'erreur s'il était affiché
            }
        } catch (error) {
            console.error("Erreur :", error.message);
            // Afficher un message d'erreur général en cas d'erreur lors de la requête
            document.getElementById('error-message').innerText = 'Une erreur est survenue lors de la récupération des données.';
            return ;
        }

        try {
            dpt_code = await getDepartmentFromCoordinates(latitude, longitude);
        } catch (error) {
            console.error("Erreur :", error.message);
            document.getElementById('error-message').innerText = "L'adresse entrée apparaît en dehors du territoire français";
            return ;
        }
        // Filtre des actions à afficher
        
        const dispPHMPMR = $('#display_PHM_PMR');
        if (dispPHMPMR[0].checked) {
            data = filter_column(csvData.data, "est_accessible_pmr");
        } else {
            data = csvData.data;
        }

        const dispPublicRestreint = $('#display_public_restreint');
        if (dispPublicRestreint[0].checked) {
            data = data
        } else {
            data = filter_column(data, "est_tout_public", on_true=true);
        }

        const dispActionPassees = $('#display_actions_passees');
        if (!dispActionPassees[0].checked) {
            data = filter_passed_date(data);
        }

        // Filtre sur la date de début et de fin. On utilise la valeur de deux input type date comparé 
        const dateDebut = $("#date_debut").val();
        const dateFin = $("#date_fin").val();
        data = data.filter(function(i) {
            return i.date_debut.getTime() >= new Date(dateDebut).getTime() && i.date_fin.getTime() <= new Date(dateFin).getTime();
        });



        data = filter_distance(data, latitude, longitude, distance);

        // Stockage de l'info sur le filtre utilisé
        geoFilter = {
            "type" : "coord_dist",
            "lat" : latitude,
            "lon" : longitude,
            "adresse" : address,
            "distance" : distance
        }

        // // On replot les marqueurs
        $("#location_action_counter").empty();
        // if (data.length === 1) {
        //     $("#location_action_counter").html(`Une action dans ce périmètre`);
        // } else if (data.length > 1) {

        //     $("#location_action_counter").html(`${data.length} actions trouvées dans ce périmètre`);
        // } else {
        //     $("#location_action_counter").html("Pas d'action enregistrée dans ce secteur pour l'instant...");
        // }
        // if (data.length === 0) {
        //     $("#location_action_counter").html("Pas d'action enregistrée dans ce secteur pour l'instant...");
        // }
        
        
        // Mise à joue de l'extent de la carte
        centerMap(map, latitude, longitude, distance);

        // Dessin d'un cercle
        addCircle(map, latitude, longitude , distance);

        // On scroll pour se ramener sur la carte
        $("html, body").animate({ scrollTop: $('#map').offset().top - 50}, "slow");

        // On remplit le tableau des actions si nécesaire
        const dispActionsTable = $('#displayActionTable');
        if (dispActionsTable[0].checked) {
            fillMapTableActions();
        }
        
        // Mise à jour des statistiques départementales
        // update_plot_nb_actions(dpt_code);
        // update_dpt_button(dpt_code);
    }
    
    // Attacher la fonction onSubmitForm à l'événement submit du formulaire
    document.getElementById('locationForm').addEventListener('submit', onSubmitForm);

    // Menu déroulant choix de département
    $('#selectDepartement').change(function() {

        var dpt_code = $(this).val();

        // On filtre les actions
        data = filtrer_dpt(csvData.data, dpt_code);

        // Stockage de l'info sur le filtre utilisé
        geoFilter = {
            "type" : "departement",
            "dpt_code" : dpt_code
        }

        // MAJ message
        $("#dpt_action_counter").empty()
        // if (data.length === 1) {
        //     $("#dpt_action_counter").html(`Une action dans le ${dpt_code}`);
        // } else if (data.length > 1) {   
        //     $("#dpt_action_counter").html(`${data.length} actions dans le ${dpt_code}`);
        // } else {
        //     $("#dpt_action_counter").html(`Aucune action enregistrée dans le ${dpt_code} pour le moment...`);
        // }
        // if (data.length === 0) {
        //     $("#dpt_action_counter").html(`Aucune action enregistrée dans le ${dpt_code} pour le moment...`);
        // }

        zoom_info = OSM_dpt_data[dpt_code];

        map.setView([zoom_info["lat"], zoom_info["lon"]], zoom_info["zoom_level"]);

        // Mettre à jour le volet stats départementales
        // update_plot_nb_actions(dpt_code);
        // update_dpt_button(dpt_code);

        // On scroll pour se ramener sur la carte
        $("html, body").animate({ scrollTop: $('#map').offset().top - 50}, "slow");

        const dispActionsTable = $('#displayActionTable');
        if (dispActionsTable[0].checked) {
            fillMapTableActions();
        }

        // Effacer le cercle de recherche par adresse si dessiné
        if (zoomCircle) {
            zoomCircle.remove();
        }


    });

    // form de filtrage des actions
    async function onSubmitFilterForm(event) {

        event.preventDefault();

        catActionFilter = '';

        var data;

        // Même chose mais différencier type de risque et type de public
        var risques_to_filter_on = []
        const checkboxList_risques = $('#select_risques_form input[type="checkbox"]');
        checkboxList_risques.each(function() {
            if (this.checked) {
                risques_to_filter_on.push(`est_${this.id}`);
                console.log(this.id);
                console.log($("label[for='"+this.id+"']").html());
                catActionFilter = catActionFilter + " - " + $("label[for='"+this.id+"']").html();
            }
        });

        var publics_to_filter_on = []
        const checkboxList_publics = $('#select_publics_form input[type="checkbox"]');
        checkboxList_publics.each(function() {
            if (this.checked) {
                publics_to_filter_on.push(`est_${this.id}`);
                catActionFilter = catActionFilter + " - " + $("label[for='"+this.id+"']").html();
            }
        });

        var type_action_to_filter_on = []
        const checkboxList_type_action = $('#select_type_action_form input[type="checkbox"]');
        checkboxList_type_action.each(function() {
            if (this.checked) {
                type_action_to_filter_on.push(`est_${this.id}`);
                catActionFilter = catActionFilter + " - " + $("label[for='"+this.id+"']").html();
            }
        });

        if (catActionFilter != 0){ 
            catActionFilter = catActionFilter.slice(3);
        }

        // On filtre les données

        const dispPHMPMR = $('#display_PHM_PMR');
        if (dispPHMPMR[0].checked) {
            data = filter_column(csvData.data, "est_accessible_pmr");
            console.log(data)
        } else {
            data = csvData.data;
        }

        // Actions public restreint 

        const dispPublicRestreint = $('#display_public_restreint');

        if (!dispPublicRestreint[0].checked){
            data = filter_column(data, "est_grand_public") 
        } else {
            data = data;
            catActionFilter = "Action grand public et public restreint - " + catActionFilter;
        };

        const dispActionPassees = $('#display_actions_passees');
        if (!dispActionPassees[0].checked) {
            data = filter_passed_date(data);
        }

        // Filtre sur la date de début et de fin. On utilise la valeur de deux input type date comparé
        const dateDebut = $('#date_debut').val();
        const dateFin = $('#date_fin').val();
        data = data.filter(function(i) {
            return i.date_debut.getTime() >= new Date(dateDebut).getTime() && i.date_fin.getTime() <= new Date(dateFin).getTime();
        });


        data = filter_risque_public_type_action(data, risques_to_filter_on, publics_to_filter_on, type_action_to_filter_on);

        // On replot les marqueurs
        nb_actions = plot_actions_markers(data)

        // On affiche le nombre d'actions trouvées
        if (nb_actions == 0) {
            $("#filter_action_counter").html(`Pas d'actions correspondant à votre recherche.`)
        } else {
            $("#filter_action_counter").html(`${nb_actions} actions trouvées.`)
        }

        // On scroll pour se ramener sur la carte
        $("html, body").animate({ scrollTop: $('#map').offset().top - 50}, "slow");        

    }

    // Attacher la fonction onSubmitForm à l'événement submit du formulaire
    document.getElementById('filterForm').addEventListener('submit', onSubmitFilterForm);


    // bouttons tout selectionner / deselectionner
    $("#deselect_risques").click(function() {
        $("#select_risques_form input[type='checkbox']").prop("checked", false);            
    });

    $("#deselect_publics").click(function() {
        $("#select_publics_form input[type='checkbox']").prop("checked", false);
    });

    $("#deselect_type_action").click(function() {
        $("#select_type_action_form input[type='checkbox']").prop("checked", false);
    });

    // activation sur touche entrer
    $("#deselect_risques").keypress(function() {
        if (event.which === 13) {
            $("#select_risques_form input[type='checkbox']").prop("checked", false);
        }            
    });

    $("#deselect_publics").keypress(function() {
        if (event.which === 13) {
            $("#select_publics_form input[type='checkbox']").prop("checked", false);
        }
    });

    $("#deselect_type_action").keypress(function() {
        if (event.which === 13) {
            $("#select_type_action_form input[type='checkbox']").prop("checked", false);
        }
    });

    // Menu déroulant choix de zone géographique pour actions dématerialisées
    $('#selectZoneGeoActionsDemat').change(function() {
        var zone_geo= $(this).val();
        console.log(zone_geo);
        // display_dematerialized_actions(csvData.data);
        display_dematerialized_actions_zone_geo(zone_geo);
    });


});
