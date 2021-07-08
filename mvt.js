// based on https://raw.githubusercontent.com/tobinbradley/dirt-simple-postgis-http-api/master/routes/mvt.js
const sqlTableName = require('./utils/sqltablename.js');
const infoFromSld = require('./sldtable');

const sm = require('@mapbox/sphericalmercator');
const merc = new sm({
  size: 256
})

function splitSchemaTable (tablename) {
  let parts = tablename.split('.');
  if (parts.length === 1) {
      parts.unshift ("public");
  }
  return {
      schema: parts[0],
      name: parts[1],
      fullname: parts.join('.')
  }
}

function toBoolean(value) {
  if (!value) {
    return false;
  }
  if (typeof value === 'string'){
    if (value.trim() === '') {
      return false;
    } else if (Number(value) === NaN) {
      switch (value.toLowerCase().trim()) {
        case 'no':
        case 'false':
        case 'n':
        case 'f':
          return false;
        default:
          return true;
      }
    } else {
      return Number(value) !== 0;
    }
  }
  if (Number(value)!== NaN) {
    return Number(value) !== 0;
  }
  return true;
}

function queryColumnsNotNull(query) {
  const queryColumns = query.columns;
  const includeNulls = toBoolean(query.include_nulls);
  
  if (!includeNulls && queryColumns) {
    return ` and (${queryColumns.split(',').map((column, index)=>`$(column${index}:name) is not null`).join(' or ')})`
  } 
  return ''
}

  let sql = (query, extraSQLFilter) => {
    return `
    SELECT ST_AsMVT(q, $(table.fullname), 4096, 'geom')
    FROM 
      (SELECT  ${`${(query.columns && query.columns !== '')?'$(columns:name),':''}`}
        ST_AsMVTGeom(
          ST_Transform($(geomcolumn:name), 3857),
          ST_MakeBox2D(ST_Point($(bounds0), $(bounds1)), ST_Point($(bounds2), $(bounds3)))
        ) geom
      FROM 
        (SELECT ${`${(query.columns && query.columns !== '')?'$(columns:name),':''}`} $(geomcolumn:name), srid
          FROM 
            $(table.schema:name).$(table.name:name),
            (SELECT ST_SRID($(geomcolumn:name)) AS srid FROM $(table.schema:name).$(table.name:name)
              WHERE $(geomcolumn:name) is not null  LIMIT 1) a
          WHERE
            $(geomcolumn:name) is not null AND
            ST_transform(
              ST_MakeEnvelope($(bounds:csv), 3857), 
              srid
            ) && $(geomcolumn:name)
            ${queryColumnsNotNull(query)}
            ${extraSQLFilter && extraSQLFilter!==''?` AND ${extraSQLFilter}`: ''}
      ) r order by random() limit 100000
    ) q
    `
  }

module.exports = function(app, pool, cache) {

  let cacheMiddleWare = async(req, res, next) => {
    if (!cache) {
      next();
      return;
    }
    const cacheDir = `${req.params.datasource}/mvt/${req.params.z}/${req.params.x}/${req.params.y}`;
    const key = ((req.query.geom_column?req.query.geom_column:'geom') + (req.query.columns?','+req.query.columns:'')) + (toBoolean(req.query.include_nulls)?'_includenulls':'') + 
        (req.query.sldtable?','+req.query.sldtable:'') + (req.query.sldlayer?','+req.query.sldlayer:'')
      .replace(/[\W]+/g, '_');
  
    const mvt = await cache.getCachedFile(cacheDir, key);
    if (mvt) {
      console.log(`cache hit for ${cacheDir}?${key}`);
      if (mvt.length === 0) {
        res.status(204)
      }
      res.header('Content-Type', 'application/x-protobuf').send(mvt);
      return;
    } else {
      res.sendResponse = res.send;
      res.send = (body) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cache.setCachedFile(cacheDir, key, body);
        }
        res.sendResponse(body);
      }
      next();
    }
  }
  
 /**
 * @swagger
 *
 * /data/{datasource}/mvt/{z}/{x}/{y}:
 *   get:
 *     description: get mapbox vector tile (mvt)
 *     tags: ['geodata']
 *     produces:
 *       - application/x-protobuf
 *     parameters:
 *       - name: datasource
 *         description: name of postgis datasource 
 *         in: path
 *         required: true
 *         type: string
 *       - name: z
 *         description: zoom level of tile
 *         in: path
 *         required: true
 *         type: number
 *       - name: x
 *         description: x value (column number) of tile
 *         in: path
 *         required: true
 *         type: number
 *       - name: y
 *         description: y value (row number) of tile
 *         in: path
 *         required: true
 *         type: number
 *       - name: geom_column
 *         description: name of geometry column (default 'geom')
 *         in: query
 *         required: false
 *       - name: columns
 *         description: optional comma seperated list of attribute columns to be added to the mvt geometries
 *         in: query
 *         required: false
 *         type: string
 *       - name: include_nulls
 *         description: 'optional parameter to include geometries where all attribute columns are null (default: false)'
 *         in: query
 *         required: false
 *         type: string
 *       - name: sldtable
 *         description: 'name of sld table to use for sld defined zoom-dependent queries. Also requires parameter "sldlayer".'
 *         in: query
 *         required: false
 *         type: string
 *       - name: sldlayer
 *         description: 'name of sldlayer to use for sld defined zoom-dependent queries. Also requires parameter "sldtable".'
 *         in: query
 *         required: false
 *         type: string
 *     responses:
 *       200:
 *         description: vector tile
 *       204:
 *         description: no data (empty tile)
 *       422:
 *         description: invalid datasource or columnname
 */
    app.get('/data/:datasource/mvt/:z/:x/:y', cacheMiddleWare, async (req, res)=>{
        if (!req.query.geom_column) {
            req.query.geom_column = 'geom'; // default
        }
        req.params.table = req.params.datasource;
        let extraSQLFilter = '';
        if (req.query.sldlayer) {
          let sldInfo = await infoFromSld(pool, req.params.datasource, req.query.sldlayer, req.params.z);
          if (!sldInfo){
              res.status(500);
              return res.json({error:"no data from sld, sld file or sld layer not found?"})
          }
          req.query.geom_column = sldInfo.geom;
          extraSQLFilter = sldInfo.where;
          req.params.table = sldInfo.table;
        }
        
        try {
            let bounds = merc.bbox(req.params.x, req.params.y, req.params.z, false, '900913');
            let sqlString = sql(req.query, extraSQLFilter);
            let sqlParams = {
              table: splitSchemaTable(req.params.table),
              columns: req.query.columns.split(','),
              geomcolumn: req.query.geom_column,
              bounds: bounds,
              bounds0: bounds[0],
              bounds1: bounds[1],
              bounds2: bounds[2],
              bounds3: bounds[3]
            };
            if (req.query.sldlayer) {
              // override mvt sourcelayername to sldlayer
              sqlParams.table.fullname = req.params.datasource;
            }
            if (req.query) {
              req.query.columns.split(',').forEach((column, index)=>{
                sqlParams[`column${index}`] = column;
              })
            }
            const result = await pool.one(sqlString, sqlParams);
            const mvt = result.st_asmvt
            if (mvt.length === 0) {
                res.status(204)
            }
            res.header('Content-Type', 'application/x-protobuf').send(mvt);
        } catch(err) {
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
    })
    app.get('/data/:datasource/sldmvt/:z/:x/:y', cacheMiddleWare, async (req, res)=>{
      if (!req.query.geom_column) {
          req.query.geom_column = 'geom'; // default
      }
      req.params.table = req.params.datasource;
      try {
        let sqlString = "select queries from $(sldtable:name)";
        let sqlParams = {sldtable: req.params.datasource};
        const result = await pool.one(sqlString, sqlParams);
        let queries = result.queries.split('","');

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
      try {
          let bounds = merc.bbox(req.params.x, req.params.y, req.params.z, false, '900913');
          let sqlString = sql(req.query);
          let sqlParams = {
            table: splitSchemaTable(req.params.table),
            columns: req.query.columns.split(','),
            geomcolumn: req.query.geom_column,
            bounds: bounds,
            bounds0: bounds[0],
            bounds1: bounds[1],
            bounds2: bounds[2],
            bounds3: bounds[3]
          };
          req.query.columns.split(',').forEach((column, index)=>{
            sqlParams[`column${index}`] = column;
          })
          const result = await pool.one(sqlString, sqlParams);
          const mvt = result.st_asmvt
          if (mvt.length === 0) {
              res.status(204)
          }
          res.header('Content-Type', 'application/x-protobuf').send(mvt);
      } catch(err) {
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
  })
}