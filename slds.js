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
AND has_table_privilege(c.oid, 'SELECT'::text)`;


module.exports = function (app, pool) {
/**
 * @swagger
 * 
 * /data/slds:
 *   get:
 *     description: Returns a list sldtables.
 *     tags: ['meta']
 *     summary: 'list sld tables'
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: "json array of sldlayers [{sldtable: string, sldlayer: string, dblayer: string}]"
 * /data/slds/{table}:
 *   get:
 *     description: Returns a list sldtables.
 *     tags: ['meta']
 *     summary: 'list sld tables with reference to the table identified by parameter "table"'
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: table
 *         description: Name of the table to filter sld tables for
 *         in: path
 *         required: true
 *         type: string 
 *     responses:
 *       200:
 *         description: "json array of sldlayers that reference parameter 'table' [{sldtable: string, sldlayer: string, dblayer: string}]"
 */
  app.get('/data/slds/:table?', async (req, res)=> {
    let table = req.params.table;
    let parts;
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
              .filter(layer=>table?layer.dblayer===table:true)
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
  });
}