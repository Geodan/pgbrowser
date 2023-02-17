// based on https://raw.githubusercontent.com/tobinbradley/dirt-simple-postgis-http-api/master/routes/list_layers.js


const sql = () => {
  return `
  SELECT current_database()::character varying(256) AS f_table_catalog,
    n.nspname AS f_table_schema,
    c.relname AS f_table_name,
    a.attname AS f_geometry_column,
    COALESCE(postgis_typmod_dims(a.atttypmod), sn.ndims, 2) AS coord_dimension,
    COALESCE(NULLIF(postgis_typmod_srid(a.atttypmod), 0), sr.srid, 0) AS srid,
    replace(replace(COALESCE(NULLIF(upper(postgis_typmod_type(a.atttypmod)), 'GEOMETRY'::text), st.type, 'GEOMETRY'::text), 'ZM'::text, ''::text), 'Z'::text, ''::text)::character varying(30) AS type,
    ((c.reltuples/case when c.relpages=0 then 1 else c.relpages end) * (pg_relation_size(c.oid) / (current_setting('block_size')::integer)))::bigint as estimated_rows,
    case when relkind='r' then 'table' when relkind='v' then 'view' when relkind='m' then 'mview' when relkind='f' then 'ftable' else 'other(' || relkind::text || ')' end table_type
  FROM pg_class c
    JOIN pg_attribute a ON a.attrelid = c.oid AND NOT a.attisdropped
    JOIN pg_namespace n ON c.relnamespace = n.oid
    JOIN pg_type t ON a.atttypid = t.oid
    LEFT JOIN ( SELECT s.connamespace,
            s.conrelid,
            s.conkey,
            replace(split_part(s.consrc, ''''::text, 2), ')'::text, ''::text) AS type
          FROM ( SELECT pg_constraint.connamespace,
                    pg_constraint.conrelid,
                    pg_constraint.conkey,
                    pg_get_constraintdef(pg_constraint.oid) AS consrc
                  FROM pg_constraint) s
          WHERE s.consrc ~~* '%geometrytype(% = %'::text) st ON st.connamespace = n.oid AND st.conrelid = c.oid AND (a.attnum = ANY (st.conkey))
    LEFT JOIN ( SELECT s.connamespace,
            s.conrelid,
            s.conkey,
            replace(split_part(s.consrc, ' = '::text, 2), ')'::text, ''::text)::integer AS ndims
          FROM ( SELECT pg_constraint.connamespace,
                    pg_constraint.conrelid,
                    pg_constraint.conkey,
                    pg_get_constraintdef(pg_constraint.oid) AS consrc
                  FROM pg_constraint) s
          WHERE s.consrc ~~* '%ndims(% = %'::text) sn ON sn.connamespace = n.oid AND sn.conrelid = c.oid AND (a.attnum = ANY (sn.conkey))
    LEFT JOIN ( SELECT s.connamespace,
            s.conrelid,
            s.conkey,
            replace(replace(split_part(s.consrc, ' = '::text, 2), ')'::text, ''::text), '('::text, ''::text)::integer AS srid
          FROM ( SELECT pg_constraint.connamespace,
                    pg_constraint.conrelid,
                    pg_constraint.conkey,
                    pg_get_constraintdef(pg_constraint.oid) AS consrc
                  FROM pg_constraint) s
          WHERE s.consrc ~~* '%srid(% = %'::text) sr ON sr.connamespace = n.oid AND sr.conrelid = c.oid AND (a.attnum = ANY (sr.conkey))
  WHERE (c.relkind = ANY (ARRAY['r'::"char", 'v'::"char", 'm'::"char", 'f'::"char", 'p'::"char"])) AND NOT c.relname = 'raster_columns'::name AND t.typname = 'geometry'::name AND NOT pg_is_other_temp_schema(c.relnamespace) AND has_table_privilege(c.oid, 'SELECT'::text);
`;
  }

const getAllSLDTablesSql = `select  n.nspname namespace, relname tablename
 FROM pg_class c
       JOIN pg_attribute a ON a.attrelid = c.oid AND NOT a.attisdropped
       JOIN pg_namespace n ON c.relnamespace = n.oid
       JOIN pg_type t ON a.atttypid = t.oid
  where (c.relkind = ANY (ARRAY['r'::"char", 'v'::"char", 'm'::"char", 'f'::"char", 'p'::"char"]))
    and c.relname like '%_sld'
  and a.attname='dblayer'
  and t.typname='varchar'
  AND NOT pg_is_other_temp_schema(c.relnamespace) 
  AND has_table_privilege(c.oid, 'SELECT'::text)`;
  



  module.exports = function(app, pool) {
 /**
 * @swagger
 *
 * /data/list_layers:
 *   get:
 *     description: get list of available tables
 *     tags: ['meta']
 *     summary: 'list PostGIS layers'
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: list of layers
 *         content:
 *            application/json
 *         schema:
 *            type: array
 *            items:
 *              type: object
 *              properties:
 *                   f_table_catalog:
 *                      description: name of database (group of tables)
 *                      type: string
 *                   f_table_schema:
 *                      description: schema name (sub-group of tables)
 *                      type: string
 *                   f_table_name:
 *                      description: name of table or view
 *                      type: string
 *                   f_geometry_column:
 *                      description: name of geometry column for geometries
 *                      type: string
 *                   coord_dimension:
 *                      description: number of dimensions, usually 2 or 3
 *                      type: integer
 *                   srid:
 *                      description: EPSG id of spatial reference system (4326=WGS 84/GPS coordinates, 3857=webmercator coordinates)
 *                      type: integer
 *                   estimated_rows:
 *                      description: estimated number of rows in table, 0 (unknown) for views or foreign tables
 *                      type: integer
 *                   table_type:
 *                      description: type of table, 1 of 'table', 'view', 'mview' (material view), 'ftable' (foreign table), 'other'
 *                      type: string
 *       500:
 *         description: unexpected error
 */
      app.get('/data/list_layers', async (req, res)=>{
        try {
            let sqlString = sql()
            let result = await pool.query(sqlString);
            let layers = result
            let sldTables = await pool.query(getAllSLDTablesSql);
            let newLayers = [];
            for (let sldTable of sldTables) {
              let sql = 'select distinct sldlayer, dblayer, geom from $(namespace:name).$(tablename:name)';
              let sqlParams = {namespace: sldTable.namespace, tablename: sldTable.tablename};
              let sldLayers = await pool.any(sql, sqlParams);
              for (sldLayer of sldLayers) {
                let parts = sldLayer.dblayer.split('.');
                if (parts.length < 2) {
                  parts.shift('public');
                };
                let knownLayers = layers.filter(layer=>layer.f_table_schema == parts[0] && layer.f_table_name == parts[1] && layer.f_geometry_column == sldLayer.geom);
                if (knownLayers.length) {
                  newLayers.push({
                    f_table_catalog: knownLayers[0].f_table_catalog,
                    f_table_schema: sldTable.namespace,
                    f_table_name: sldTable.tablename,
                    f_geometry_column: sldLayer.geom,
                    coord_dimension: knownLayers[0].coord_dimension,
                    srid: knownLayers[0].srid,
                    type: knownLayers[0].type,
                    estimated_rows: knownLayers[0].estimated_rows,
                    table_type: 'sld',
                    sld_layername: sldLayer.sldlayer
                  })
                }
              }              
            }
            if (newLayers.length) {
              layers = layers.concat(newLayers);
            }
            res.json(layers)
        } catch(err) {
            res.status(500).json({error: err.message})
        }
      })
  }