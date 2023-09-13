// Fichier script.js

// global variables 
var csvData;
var map;
var markers = L.markerClusterGroup();

var OSM_dpt_data;

var select_all_risque = true;
var select_all_public = true;

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
const date_JNR = new Date(2023, 10, 13)
const date_today = new Date();

// Création des markers
const riskNat_marker = L.AwesomeMarkers.icon({
    markerColor: 'green'
});

const riskTEch_marker = L.AwesomeMarkers.icon({
    markerColor: 'red'
});

const riskMult_marker = L.AwesomeMarkers.icon({
    markerColor: 'blue'
});

const riskNat_marker_b = L.AwesomeMarkers.icon({
    markerColor: 'lightgreen'
});

const riskTEch_marker_b = L.AwesomeMarkers.icon({
    markerColor: 'lightred'
});

const riskMult_marker_b = L.AwesomeMarkers.icon({
    markerColor: 'lightblue'
});

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

// function for plotting markers
function plot_actions_markers(data) {

    var nb_actions = 0;

    // effacement des marqueurs précédents
    markers.clearLayers()

    // Parcours des données et création des marqueurs
    data.forEach(function (item) {

        var lat = item.lat;
        var lon = item.lon;

        // Vérification si les coordonnées sont valides (pas NaN) et que date fin > date du jour
        if (!isNaN(lat) && !isNaN(lon) && (item.date_fin.getTime() >= date_today.getTime())) {

            nb_actions += 1;

            var description = item.description_action;
            const NB_MAX_CHAR = 800;
            if (description.length > NB_MAX_CHAR){
                description = description.slice(0,NB_MAX_CHAR) + "..."
            }

            var popupContent = '<strong>' + item.nom + '</strong><br><em>' + item.adresse + '</em><br>'

            if (item.date_debut.getTime() === item.date_fin.getTime()) {
                if (item.date_debut.getTime() === date_JNR.getTime()) {
                    popupContent += "Le 13/10/2023, Journée nationale de la résilience" + '<br>'
                } else {
                    popupContent += "Le " + dateFormatter.format(item.date_debut) + '<br>'
                }
            } else {
                popupContent += 'Du ' + dateFormatter.format(item.date_debut) + ' au ' + dateFormatter.format(item.date_fin) + '<br>'
            }
            
            popupContent += '<strong>Organisé par :</strong> ' + item.organisateur + '<br><strong>Public ciblé : </strong>' + item.public_cible_str + "<br><strong>Type d'action : </strong>" + item.type_action_str + '<br><strong>Risques traités : </strong>' + item.risque_cible_str;
            
            // Lien vers plus d'information
            if (item.lien_programme) {
                popupContent += "<br>Pour plus d'information <a href=" + item.lien_programme + ' target="_blank">cliquez ici</a>';
            } else {
                popupContent += "<br>(Pas de ressource additionnelle fournie par l'organisateur.)";
            }

            if (item.est_grand_public) {
                if (item.est_risques_naturels && item.est_risques_technologiques) {
                    var marker = L.marker([lat, lon],{icon: riskMult_marker}).bindPopup(popupContent);
                } else if (item.est_risques_naturels) {
                    var marker = L.marker([lat, lon],{icon: riskNat_marker}).bindPopup(popupContent);
                } else {
                    var marker = L.marker([lat, lon],{icon: riskTEch_marker}).bindPopup(popupContent);
                }
            } else {
                if (item.est_risques_naturels && item.est_risques_technologiques) {
                    var marker = L.marker([lat, lon],{icon: riskMult_marker_b}).bindPopup(popupContent);
                } else if (item.est_risques_naturels) {
                    var marker = L.marker([lat, lon],{icon: riskNat_marker_b}).bindPopup(popupContent);
                } else {
                    var marker = L.marker([lat, lon],{icon: riskTEch_marker_b}).bindPopup(popupContent);
                }
            }

            

            markers.addLayer(marker);

        }
    });

    map.addLayer(markers); // Ajout des marqueurs à la carte

    return nb_actions;

};


function display_dematerialized_actions(data) {

    tableContainer = $("#actions_demat");
    
    var table = $("<table>").addClass("table table-bordered");

    var thead = $("<thead>");
    var headerRow = $("<tr>");

    ["Nom de l'action", "Organisateur", "Lien vers la ressource"].forEach(function(item) {
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

            $.each(["nom","organisateur"], function (index, label) {
                var cell = $("<td>").text(item[label]);
                row.append(cell);
            });
    
            var cell = $("<td>").html(`<a href=${item["lien_programme"]}>${item["lien_programme"]}</a>` );
            row.append(cell);
    
            tbody.append(row);
        }

    });

    table.append(tbody);

    tableContainer.append(table)

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
        url: 'data/actions_grand_public_carte.csv',
        dataType: 'text',
        success: function (data) {

            csvData = Papa.parse(data, { header: true, skipEmptyLines: true });

            // On parse les colonnes de booléens et de flottant 
            var float_cols = ["lat","lon"]
            var bool_cols = ["est_grand_public","est_dematerialisee","est_risques_naturels","est_risques_technologiques","est_inondations","est_feux_de_foret","est_tempete_cyclone","est_seisme","est_eruption_volcanique","est_mouvement_de_terrain","est_risques_littoraux","est_avalanche","est_radon","est_accidents_industriels","est_accidents_nucleaires","est_rupture_de_barrage","est_transport_de_matieres_dangereuses","est_tous_public","est_famille","est_jeune_public","est_seniors", 'est_atelier_jeux','est_atelier_sensibilisation','est_conference','est_exercice_de_gestion_de_crise','est_exposition','est_formation','est_reunion_d_information','est_spectacle','est_visite_en_plein_air','est_visite_en_interieur']
            var date_cols = ["date_debut", "date_fin"]

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
                if (row["lien_programme"]) {
                    if (!(row["lien_programme"].startsWith("http://") || row["lien_programme"].startsWith("https://")) && !row["lien_programme"].startsWith("www.")) {
                        row["lien_programme"] = "http://www." + row["lien_programme"];
                    } else if (row["lien_programme"].startsWith("www.") && !row["lien_programme"].startsWith("http://")) {
                        row["lien_programme"] = "http://" + row["lien_programme"];
                    }
                }
                
    
            });

            // Restreindre aux actions grand public
            var data = filter_column(csvData.data, "est_grand_public");

            // plot des marqueurs
            var nb_actions = plot_actions_markers(data);

            // Ajout de la légende
            var legend = L.control({position: 'bottomleft'});

            legend.onAdd = function (map) {

                var div = L.DomUtil.create('div', 'info legend');
                labels = ['<strong>Risques abordés</strong>'],

                labels.push('<span style="color:#38a9dd">◼</span> Multirisques');
                labels.push('<span style="color:#72b026">◼</span> Risques naturels');
                labels.push('<span style="color:#d33d2a">◼</span> Risques technologiques');

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

            // Affichage des actions dématerialisées
            data = filter_column(csvData.data, "est_dematerialisee");
                // display_dematerialized_actions(data);


            // Décompte des actions
            nb_actions_total = csvData.data.length;
            $("#action_counter").html(`<strong>${nb_actions_total}</strong> actions recensées pour le moment`)
            $("#action_count_detail").html(`Dont <strong>${nb_actions}</strong> actions non dématerialisées ouvertes au grand public`)
            
        }
    });

    // Chargement des info de zoom sur les départements
    fetch('./data/dpt_zoom_info.json')
        .then(response => response.json())
        .then(data => {
            OSM_dpt_data = data;
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

    // Fonction pour gérer la soumission du formulaire
    async function onSubmitForm(event) {

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
            console.log(dpt_code);
        } catch (error) {
            console.error("Erreur :", error.message);
            document.getElementById('error-message').innerText = "L'adresse entrée apparaît en dehors du territoire français";
            return ;
        }

        // Filtre des actions à afficher
        data = filter_distance(csvData.data, latitude, longitude, distance);

        // On replot les marqueurs
        $("#location_action_counter").html();
        if (data.length === 1) {
            $("#location_action_counter").html(`Une action dans ce périmètre`);
        } else if (data.length > 1) {
            $("#location_action_counter").html(`${data.lenght} actions trouvées dans ce périmètre`);
        } else {
            $("#location_action_counter").html("Pas d'action enregistrée dans ce secteur pour l'instant...");
        }
        
        
        // Mise à joue de l'extent de la carte
        centerMap(map, latitude, longitude, distance);

        // On scroll pour se ramener sur la carte
        $("html, body").animate({ scrollTop: $('#map').offset().top - 50}, "slow");

        
        // Mise à jour des statistiques départementales
        // update_plot_nb_actions(dpt_code);
        // update_dpt_button(dpt_code);
    }
    
    // Attacher la fonction onSubmitForm à l'événement submit du formulaire
    document.getElementById('locationForm').addEventListener('submit', onSubmitForm);

    // Menu déroulant choix de département
    $("#dpt-dropdown .dropdown-item").on("click", function(e) {

        e.preventDefault();

        // On récupère le dpt sélectionné
        var dpt_code = $(this).attr("value");
        

        // On filtre les actions
        data = filtrer_dpt(csvData.data, dpt_code);

        // MAJ message
        $("#dpt_action_counter").html()
        if (data.lenght === 1) {
            $("#dpt_action_counter").html(`Une action dans le ${dpt_code}`);
        } else if (data.length > 1) {   
            $("#dpt_action_counter").html(`${data.length} actions dans le ${dpt_code}`);
        } else {
            $("#dpt_action_counter").html(`Aucune action enregistrée dans le ${dpt_code} pour le moment...`);
        }

        zoom_info = OSM_dpt_data[dpt_code];

        map.setView([zoom_info["lat"], zoom_info["lon"]], zoom_info["zoom_level"]);

        // Mettre à jour le volet stats départementales
        // update_plot_nb_actions(dpt_code);
        // update_dpt_button(dpt_code);

        // On scroll pour se ramener sur la carte
        $("html, body").animate({ scrollTop: $('#map').offset().top - 50}, "slow");

        

    });


    // form de filtrage des actions
    async function onSubmitFilterForm(event) {

        event.preventDefault();

        var data;

        // Même chose mais différencier type de risque et type de public
        var risques_to_filter_on = []
        const checkboxList_risques = $('#select_risques_form input[type="checkbox"]');
        checkboxList_risques.each(function() {
            if (this.checked) {
                risques_to_filter_on.push(`est_${this.id}`)
            }
        });

        var publics_to_filter_on = []
        const checkboxList_publics = $('#select_publics_form input[type="checkbox"]');
        checkboxList_publics.each(function() {
            if (this.checked) {
                publics_to_filter_on.push(`est_${this.id}`)
            }
        });

        var type_action_to_filter_on = []
        const checkboxList_type_action = $('#select_type_action_form input[type="checkbox"]');
        checkboxList_type_action.each(function() {
            if (this.checked) {
                type_action_to_filter_on.push(`est_${this.id}`)
            }
        });

        // On filtre les données

        // Actions public restreint 

        const dispPublicRestreint = $('#display_public_restreint_form input[type="checkbox"]');

        if (!dispPublicRestreint[0].checked){
            data = filter_column(csvData.data, "est_grand_public") 
        } else {
            console.log("Also displaying public restreint actions");
            data = csvData.data;
        };

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

});
