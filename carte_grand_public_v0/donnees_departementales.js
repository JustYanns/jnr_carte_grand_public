
function update_plot_nb_actions(dpt_code) {
    // Charger les données JSON
    d3.json('./data/nb_actions_dpt.json').then(function(data) {    

        // Récuperer les données du dpt
        var data_dpt = data[dpt_code];

        if (data_dpt == null) {
            $("#graph").html("Pas d'action enregistrée dans le " + dpt_code + " :(");
            $("#text_pre_graph").empty();
        } else if (data_dpt["Nombre actions"] == 0) {
            $("#graph").html("Pas d'action enregistrée dans le " + dpt_code + " :(");
            $("#text_pre_graph").empty();

        } else {

            // Afficher le nombre d'actions
            $("#text_pre_graph").html(data_dpt["Nombre actions"] + " action(s) enregistrée(s) dans le " + dpt_code)

            // Extraire les données du JSON
            var typesRisques = data_dpt["Type de risque"];
            var nombresActions = data_dpt["Nombre d'actions"];
            var couleursPlot = data_dpt["couleur_plot"];

            // Créer les données pour le graphique en barres
            var barData = [{
            x: typesRisques,
            y: nombresActions,
            type: 'bar',
            marker: {
                color: couleursPlot
            }
            }];

            // Configuration du layout du graphique
            var layout = {
            title: null,
            xaxis: {
                title: '',
                automargin: true
            },
            yaxis: {
                title: 'Nombre d\'actions en lien',
                tickformat: 'd', // Afficher des nombres entiers sur l'axe Y
                range: [0, Math.max(5, Math.max(...nombresActions))]
            },
            staticPlot: true,
            hovermode : false,
            margin: {
                t: 20 // Supprimer l'espace blanc en haut du graphique
                }
            };

            var config = {
            displayModeBar: false, // Masquer la barre d'options
            responsive: true, // Désactiver les réponses interactives au redimensionnement
            scrollZoom: false,
            
            };

            // Créer le graphique en barres avec Plotly
            $("#graph").empty();
            Plotly.newPlot('graph', barData, layout, config);
            
        }
        
    });
};

function update_dpt_button(dpt_code) {
    // Charger les données JSON
    d3.json('./data/departement_libelle.json').then(function(data) {
        var dpt_name = data[dpt_code];
        $("#chosen_dpt").html(dpt_name + ` (${dpt_code})`);

    });
}

// Attendre que le DOM soit chargé
document.addEventListener('DOMContentLoaded', function() {

    update_plot_nb_actions("64");
    update_dpt_button("64");

  });
  