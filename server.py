from flask import Flask, render_template_string
import folium
import requests


# Function to fetch ski piste data using Overpass API
def fetch_ski_piste_data():
    overpass_url = "http://overpass-api.de/api/interpreter"
    overpass_query = """
    [out:json];
    (
      way["piste:type"](45.28, 6.56, 45.31, 6.61);
    );
    out body;
    >;
    out skel qt;
    """
    response = requests.get(overpass_url, params={'data': overpass_query})
    response.raise_for_status()
    return response.json()


# Function to extract coordinates and metadata from OSM data
def parse_ski_piste_data(osm_data):
    ski_pistes = []
    nodes = {node['id']: (node['lat'], node['lon']) for node in osm_data['elements'] if node['type'] == 'node'}
    for element in osm_data['elements']:
        if element['type'] == 'way' and "tags" in element:
            coordinates = [nodes[node_id] for node_id in element['nodes'] if node_id in nodes]
            ski_pistes.append({
                'coordinates': coordinates,
                'tags': element['tags']
            })
    return ski_pistes


# Function to create the map with ski pistes
def create_map():
    # Fetch ski piste data
    osm_data = fetch_ski_piste_data()
    ski_pistes = parse_ski_piste_data(osm_data)

    # Create a Folium map centered on the world
    world_map = folium.Map(location=[46.0, 8.0], zoom_start=5)  # Centered in the Alps

    for piste in ski_pistes:
        coordinates = piste['coordinates']
        tags = piste['tags']
        difficulty = tags.get('piste:difficulty', 'unknown').capitalize()
        piste_type = tags.get('piste:type', 'unknown').capitalize()

        # Add polyline for the piste
        if coordinates:
            folium.PolyLine(
                locations=coordinates,
                color="green" if difficulty == "Novice" else "blue" if difficulty == "Easy" else "red" if difficulty == "Intermediate" else "black",
                weight=2.5,
                popup=f"Piste Type: {piste_type}\nDifficulty: {difficulty}"
            ).add_to(world_map)

    return world_map


# Flask app
app = Flask(__name__)


@app.route('/')
def home():
    # Create the map
    world_map = create_map()

    # Render the map HTML
    map_html = world_map._repr_html_()
    return render_template_string('''
        <!DOCTYPE html>
        <html>
        <head>
            <title>Ski Piste Map</title>
        </head>
        <body>
            <h1>Ski Piste Map</h1>
            <div>{{ map_html | safe }}</div>
        </body>
        </html>
    ''', map_html=map_html)


# Run the server
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
