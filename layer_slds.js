const getAllSLDTablesSql = `select n.nspname namespace, relname tablename
FROM pg_class c
     JOIN pg_attribute a ON a.attrelid = c.oid AND NOT a.attisdropped
     JOIN pg_namespace n ON c.relnamespace = n.oid
     JOIN pg_type t ON a.atttypid = t.oid
where (c.relkind = ANY (ARRAY['r'::"char", 'v'::"char", 'm'::"char", 'f'::"char", 'p'::"char"]))
  and c.relname like '%_sld'
and a.attname='dblayer'
and t.typname='varchar'
AND NOT pg_is_other_temp_schema(c.relnamespace) 
AND has_table_privilege(c.oid, 'SELECT'::text)`

module.exports = function (app, pool) {
/**
 * @swagger
 *
 * /data/layer_slds/:table:
 *   get:
 *     description: Returns a list sldtables referencing the passed in table name.
 *     tags: ['meta']
 *     summary: 'list sld tables'
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: table
 *         description: The name of the table to find sld tables for
 *         in: path
 *         required: true
 *         type: string 
 *     responses:
 *       200:
 *         description: json array of sldlayers referencing the given table [{sldtable: string, sldlayer: string, dblayer: string}]
 */
  app.get('/data/layer_slds/:table', async (req, res)=> {
    let tableName, schemaName;
    const table = req.params.table;
    if (table) {
      const parts = table.split('.');
      if (parts.length === 1) {
        tableName = parts[0];
        schemaName = null;
      } else {
        schemaName = parts[0];
        tableName = parts[1];
      }
      req.params.table = tableName;
      req.params.schema = schemaName;
      const sqlString = sql(req.params, req.query);
      try {
        // get sld tables in database
        let sldtables = await pool.query(getAllSLDTablesSql);
        let result = [];        
        for (let i = 0; i < sldtables.length; i++) {
          let sql = 'select distinct sldlayer, dblayer from $(namespace:name).$(tablename:name)';
          let sqlParams = {namespace: sldtables[i].namespace, tablename: sldtables[i].tablename};
          let layers = await pool.any(sql, sqlParams);
          result = result
            .concat(
              layers
                .filter(layer=>layer.dblayer===table)
                .map(layer=>{
                  return {sldtable: `${sldtables[i].namespace}.${sldtables[i].tablename}`, sldlayer: layer.sldlayer, dblayer: layer.dblayer}
                }));
        }
        res.json(result);
      } catch (err) {
        console.log(err);
        let status = 500;
        switch (err.code) {
            case '42P01':
                // table does not exist
                status = 422;
                break;
            case '42703':
                // column does not exist
                status = 422;
                break;
            default:
        }
        res.status(status).json({error:err.message})
      }
    } else {
      res.status(422).json({error:"missing parameter 'table'"})
    }
  });
}