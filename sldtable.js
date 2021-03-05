

let queryMap = new Map();


module.exports = async function infoFromSld(dbPool, sldTablename, sldLayername, zoom) {
    if (!zoom) {
        zoom = 0;
    }
    let baseKey = sldTablename + "_" + sldLayername + "_"
    let query = queryMap.get(baseKey + zoom);
    if (query) {
      return query;
    }
    let parts = sldTablename.split('.');
    let sql = "select z, geom, query from $(schema:name).$(table:name) where sldlayer=$(sldlayername) order by z";
    let sqlParams = {schema: parts[0], table: parts[1], sldlayername: sldLayername};
    let result;
    try {
        result = await dbPool.any(sql, sqlParams);
    } catch (err) {
        console.log(err.message?err.message:err);
        return
    }
    for (let i = 0; i < result.length; i++) {
      let where = '';
      let parts = result[i].query.split('WHERE');
      if (parts.length > 1) {
          where = parts[1];
      }
      let table = parts[0].split(' FROM ')[1].trim();
      queryMap.set(baseKey + result[i].z, {table: table, geom: result[i].geom, where: where});
    }
    return queryMap.get(baseKey + zoom);  
}

