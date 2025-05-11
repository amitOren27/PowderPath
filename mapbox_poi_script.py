import requests
import time
import json

# === Your Mapbox access token ===
MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoicG93ZGVycGF0aCIsImEiOiJjbWFheWd4aG0yMm5qMmlxdWZoc3BuN2duIn0.ACVT0HValXADaLR7Esyfvg'

# === Bounding box for Val Thorens village ===
# (min_lon, min_lat, max_lon, max_lat)
bbox = (6.568, 45.296, 6.585, 45.305)

# === Grid resolution in degrees ===
# This is ~0.0005 deg ≈ 55 meters — works well with Tilequery's 50m radius limit
step = 0.0005

# === Tilequery API radius (in meters) ===
# Tilequery supports up to 50 meters max radius
radius = 25  # Small enough to avoid duplicates, large enough to catch nearby POIs

# === Keep track of how many requests we make ===
query_count = 0

# === Use a set to avoid duplicates (based on feature id) ===
features_seen = set()
features = []

# === Loop over the bounding box in a grid ===
lat = bbox[1]
while lat <= bbox[3]:
    lon = bbox[0]
    while lon <= bbox[2]:
        url = f"https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/{lon},{lat}.json"
        params = {
            "radius": radius,
            "limit": 50,  # Max features per query
            "access_token": MAPBOX_ACCESS_TOKEN,
            "layers": "poi_label"  # Limit to just POIs
        }

        try:
            res = requests.get(url, params=params)
            res.raise_for_status()
            data = res.json()

            for feature in data.get("features", []):
                feature_id = feature["id"]
                if feature_id not in features_seen:
                    features_seen.add(feature_id)
                    features.append(feature)

        except Exception as e:
            print(f"Error querying ({lon}, {lat}): {e}")

        query_count += 1
        time.sleep(0.1)  # Be polite to the API (10 requests/sec)

        lon += step
    lat += step

# === Summary ===
print(f"Queried {query_count} points. Collected {len(features)} unique POIs.")

# === Example: Save to file ===
with open("val_thorens_pois.geojson", "w") as f:
    json.dump({
        "type": "FeatureCollection",
        "features": features
    }, f, indent=2)
