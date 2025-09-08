CREATE TABLE aerialway_edges_split AS

-- Forward edge (always present)
SELECT
  'aerialway' AS type,
  osm_id,
  name,
  NULL AS difficulty,
  type AS aerialway_type,
  geom,
  ST_StartPoint(geom) AS source_point,
  ST_EndPoint(geom) AS target_point
FROM aerialway_lines

UNION ALL

-- Reverse edge (only for bidirectional)
SELECT
  'aerialway' AS type,
  osm_id,
  name,
  NULL AS difficulty,
  type AS aerialway_type,
  ST_Reverse(geom),
  ST_EndPoint(geom),
  ST_StartPoint(geom)
FROM aerialway_lines
WHERE
  type IN ('gondola', 'cable_car')
  OR tags -> 'oneway' = 'no';

-- One-directional by nature: just insert normally
CREATE TABLE piste_edges AS
SELECT
  'piste' AS type,
  osm_id,
  name,
  difficulty,
  NULL::text AS aerialway_type,
  geom,
  ST_StartPoint(geom),
  ST_EndPoint(geom)
FROM downhill_pistes;

-- Unite piste edges and aerialway edges into one table 'lines'
CREATE TABLE lines AS
SELECT
  type,
  osm_id,
  name,
  difficulty,
  aerialway_type,
  geom,
  TRUE AS noding_needed
FROM piste_edges

UNION ALL

SELECT
  type,
  osm_id,
  name,
  difficulty,
  aerialway_type,
  geom,
  FALSE AS noding_needed
FROM aerialway_edges_split;

-- Extract all piste lines that need to be noded into a 'lines_to_node' table
CREATE TABLE lines_to_node AS
SELECT * FROM lines WHERE noding_needed;

-- This will create the table 'lines_to_node_noded'
SELECT pgr_nodeNetwork('lines_to_node', 0.00000001, 'osm_id', 'geom'); 

-- Merge noded pistes and aerialways into a 'routing_edges' table
CREATE TABLE routing_edges AS
SELECT 
  id,
  old_id AS osm_id,
  NULL::text AS type,         
  NULL::text AS name,
  NULL::text AS difficulty,
  NULL::text AS aerialway_type,
  source,
  target,
  geom
FROM lines_to_node_noded

UNION ALL

SELECT 
  ROW_NUMBER() OVER () + 1000000 AS id,
  osm_id,
  type,
  name,
  difficulty,
  aerialway_type,
  NULL::INTEGER AS source,
  NULL::INTEGER AS target,
  geom
FROM lines
WHERE NOT noding_needed;

-- Restore pistes and aerialways info from lines table 
UPDATE routing_edges r
SET
  type = l.type,
  name = l.name,
  difficulty = l.difficulty,
  aerialway_type = l.aerialway_type
FROM lines l
WHERE l.osm_id = r.osm_id;

-- Assign unique vertex IDs (source, target) based on intersection points.
SELECT pgr_createTopology(
  'routing_edges',
  0.0000001,            
  'geom',
  'id'
);

-- Set base cost to the length in meters
ALTER TABLE routing_edges ADD COLUMN cost DOUBLE PRECISION;

UPDATE routing_edges
SET cost = ST_LengthSpheroid(geom, 'SPHEROID["WGS 84",6378137,298.257223563]');

-- -- Add a spatial index for fast lookup
CREATE INDEX ON routing_edges USING GIST (geom);

-- Create vertices table
CREATE TABLE routing_vertices AS
SELECT DISTINCT source AS id, ST_StartPoint(geom) AS geom
FROM routing_edges
UNION
SELECT DISTINCT target AS id, ST_EndPoint(geom) AS geom
FROM routing_edges;

-- Add a spatial index for fast lookup
CREATE INDEX routing_vertices_geom_idx ON routing_vertices USING GIST(geom);
