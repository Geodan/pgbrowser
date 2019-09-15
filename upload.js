const express = require('express');
const fs = require('fs');
//const ogr2ogr = require('ogr2ogr');
const path = require('path');
const { exec } = require('child_process');

const fileUpload = require('express-fileupload');

module.exports = function(app, pool) {
  if (!app) {
    return;
  }

  let schemaInfo = {schemas:[],searchpath:""};
  function setDefaultSchema() {
    if (schemaInfo.schemas.length && schemaInfo.searchpath) {
      schemaInfo.searchpath = schemaInfo.searchpath.split(',').map(schema=>{
        schema.trim();
        if (schema === '"$user"') {
          schema = pool.$cn.user
        }
        return schema;
      });
      schemaInfo.default = schemaInfo.searchpath.reduce((result, schema)=>{
        if (result) {
          return result;
        }
        if (schemaInfo.schemas.includes(schema)) {
          return schema;
        }
        return null;
      },null);
      console.log(`database: ${pool.$cn.database}, default_schema: ${schemaInfo.default}, search_path: ${schemaInfo.searchpath.join(',')}`);
    }
  }

  function getSchemaInfo() {
    if (schemaInfo.searchpath) {
      return;
    }
    return Promise.all([
      pool.any("SELECT schema_name FROM information_schema.schemata", []).then(result=>{
        schemaInfo.schemas = result.map(row=>row.schema_name);
      }),
      pool.one("show search_path",[]).then(result=>{
        schemaInfo.searchpath = result.search_path;        
      })
    ])
    .then(()=>setDefaultSchema())
    .catch(err=>{})
  }

  getSchemaInfo();

  app.use(fileUpload({
    useTempFiles: true,
    tempFileDir : `${__dirname}/temp/`
  }));

  function rmr(dirName) {
    return new Promise((resolve, reject)=>{
      exec(`rm -r "${dirName}"`, (err, stdout, stderr)=>{
        if (err) {
          reject(err);
          return;
        }
        resolve();
      })
    })
  }

  
  function unzip(fileName, tempDir) {
    return new Promise((resolve, reject)=>{
      exec (`unzip -qq -d "${tempDir}" "${fileName}"`, (err, stdout, stderr)=>{
        if (err) {
          rmr(tempDir).catch(err=>{}).finally(()=>{
            reject('failed to unzip');
          });
        } else {
          try {
            fs.unlinkSync(fileName);
            fs.renameSync(tempDir, fileName);  
          } catch (err) {
            reject(`failed to mv zip files to directory: ${err.message}`);
            return;
          } finally {
            resolve()
          }
        }
      })
    })
  }

  function untar(fileName, tempDir) {
    fs.mkdirSync(tempDir);
    return new Promise((resolve, reject)=>{
      exec(`tar --directory "${tempDir}" -xf "${fileName}"`, (err, stdout, stderr)=>{
        if (err) {
          rmr(tempDir).catch(err=>{}).finally(()=>{
            reject('failed to untar');
          });
        } else {
          try {
            fs.unlinkSync(fileName);
            fs.renameSync(tempDir, fileName);  
          } catch (err) {
            reject(`failed to mv zip files to directory: ${err.message}`);
            return;
          } finally {
            resolve()
          }
        }
      })
    })
  }

  async function unArchiveFile(fileName) {
    let parsedPath = path.parse(fileName);
    let tempDir = `${__dirname}/temp/${parsedPath.base}`;
    try {
      await rmr(tempDir)
    } catch (err) {
      // ignore
    }
    try {
      await unzip (fileName, tempDir)
    } catch(err) {
      try {
        await untar(fileName, tempDir);
      } catch(err) {

      }
    } 
  }


  app.post('/admin/upload', async (req, res) => {
    let uploadFile = req.files.uploadfile;
    const fileName = uploadFile.name;
    if (!fileName || fileName === "" || fileName.toLowerCase().trim() === ".gitignore" ) {
      return res.json({file: "none"});
    }
    let dest = `${__dirname}/admin/files/${fileName}`;
    try {
      await (rmr(dest));
    } catch (err) {
      // ignore
    }
    uploadFile.mv(
      dest,
      async function (err) {
        if (err) {
          return res.status(500).send(err.message);
        }
        try {
          await unArchiveFile(`${__dirname}/admin/files/${fileName}`);
        } catch (err) {
          // ignore
        }
        res.json({
          file: `${fileName}`
        })    
      }
    )
  });
  
  app.get('/admin/upload', (req, res) =>{
    url = req.query.fetch;
    console.log(url);
    res.json({
      file: 'index.html'
    });
  })
  
  app.delete('/admin/upload', express.json({type: '*/*'}), (req, res) => {
      //fs.unlinkSync(`${__dirname}/admin/files/${req.body.file}`);
      rmr(`${__dirname}/admin/files/${req.body.file}`).then(err=>{
        if (err){
          res.json({error: err.message});
        } else {
          res.json({
            file: 'done'
          });
        }
      })
  });


  function listFiles(dirname) {
    let files = fs.readdirSync(dirname).filter(file=>file !== '.gitignore');
    files = files.map(file=>{
      let stat = fs.statSync(path.join(dirname, file));
      let result = {
        name: file,
        size: stat.size,
        file: !!(stat.mode & 0100000),
        dir: !!(stat.mode &  0040000),
        ctime: stat.ctime,
        mtime: stat.mtime,
        atime: stat.atime,
        permissions: `${(stat.mode & 0040000)?'d':(stat.mode & 0100000)?'f':'-'}${stat.mode & 400?'r':'-'}${stat.mode & 200?'w':'-'}${stat.mode & 100?'x':'-'}${stat.mode & 40?'r':'-'}${stat.mode & 20?'w':'-'}${stat.mode&10?'x':'-'}${stat.mode&4?'r':'-'}${stat.mode&2?'w':'-'}${stat.mode&1?'x':'-'}`,
        nlink: stat.nlink,
        uid: stat.uid,
        gid: stat.gid
      }
      return result;
    })
    return files;
  }

  app.get('/admin/list', (req, res)=>{
    let subdir = (req.query.subdir?`/${req.query.subdir}`:''); // todo: sanitize 
    let files = listFiles(`${__dirname}/admin/files${subdir}`);
    res.json(files);
  })

  function ogr2ogr(fileName, schemaName, tableName, pool) {
    return new Promise((resolve, reject)=>{
      exec (`ogr2ogr -f "PostgreSQL" PG:"host=${pool.$cn.host} user=${pool.$cn.user} dbname=${pool.$cn.database} password=${pool.$cn.password} port=${pool.$cn.port?pool.$cn.port:5432}" -nlt PROMOTE_TO_MULTI -overwrite -lco GEOMETRY_NAME=geom -nln ${schemaName}.${tableName} "${fileName}"`, (err, stdout, stderr)=>{
        if (err) {
            reject(err.message);
        } else {
            resolve({stdout: stdout, stderr: stderr});
        }
      })
    })
  }

  let importBusyMessage = null;

  async function autoCleanUp(schemaName, tableName, geometryName) {
    sql = "update $(schemaName:name).$(tableName:name) set $(geometryName:name)=st_makevalid($(geometryName:name)) where not st_isvalid($(geometryName:name))"
    await pool.none(sql, {schemaName: schemaName, tableName: tableName ,geometryName: geometryName});
    sql = "update $(schemaName:name).$(tableName:name) set $(geometryName:name)=st_intersection(st_makevalid($(geometryName:name)), st_makevalid(st_geomfromtext('POLYGON((-180 -89,-180 -63.2,180 -63.2,180 -89,-180 -89))', 4326))) where st_intersects($(geometryName:name), st_makevalid(st_geomfromtext('POLYGON((-180 -89, -180 -90, 180 -90, 180 -89, -180 -89))', 4326)))"
    await pool.none(sql, {schemaName: schemaName, tableName: tableName ,geometryName: geometryName});
    return;
  }

  app.get('/admin/import', (req, res)=>{
    if (!schemaInfo.default) {
      res.json({error: 'database not connected, try again later'});
      getSchemaInfo();
      return;
    }
    if (importBusyMessage) {
      res.json({error: `only one concurrent import allowed, try again later (${importBusyMessage})`});
      return;
    }
    let schemaName = req.query.schema ? req.query.schema : schemaInfo.default;
    schemaName = schemaName.toLowerCase().trim().replace(/\./g, '_'.replace(/ /g,'_'));
    let tableName = path.parse(req.query.file).name.toLowerCase();
    tableName = tableName.replace(/\./g, '_').replace(/ /g, '_');
    let fileName = `${__dirname}/admin/files/${req.query.file}`;
    importBusyMessage = `import ${req.query.file} to ${schemaName}.${tableName}`;
    ogr2ogr(fileName, schemaName, tableName, pool)
      .then((io)=>{
        res.json({result: "ok", table: `${schemaName}.${tableName}`, io: io});
        autoCleanUp(schemaName, tableName, 'geom');
        rmr(`${__dirname}/cache/${pool.$cn.database}/${schemaName}.${tableName}`).catch(err=>{});
      })
      .catch((err)=> {
        res.json({error: err});
      })
      .finally(()=> {
        importBusyMessage = null;
        tableStats(pool, tableName, schemaName)
      });    
  })
}

async function tableStats(pool, fullTableName, defaultSchema) {
  let parts = fullTableName.split('.');
  let tableName = parts[parts.length - 1];
  let schemaName = parts.length > 1 ? parts[0] : defaultSchema ? defaultSchema : 'public';
  const sql = `
    SELECT 
      attname as field_name,
      typname as field_type
    FROM 
      pg_namespace, pg_attribute, pg_type, pg_class
    WHERE
      pg_type.oid = atttypid AND
      pg_class.oid = attrelid AND
      relnamespace = pg_namespace.oid AND
      attnum >= 1 AND
      relname = $(tableName) AND
      nspname = $(schemaName)
    `
  console.log(sql);
  let fieldInfo = await pool.any(sql, {tableName: tableName, schemaName: schemaName});
  let sql2 = `
    SELECT
      count(*)::integer, ${fieldInfo.filter(row=>row.field_type!=='geometry').map(row=>{
        let nm = row.field_name;
        return `min("${nm}") "${nm}_min", max("${nm}") "${nm}_max", count("${nm}")::integer "${nm}_count", count(distinct "${nm}")::integer "${nm}_dcount"`
      }).join(',')}
    FROM
      ${fullTableName}
  `;
  console.log(sql2);
  let tableStats = await pool.any(sql2, []);
  console.log(JSON.stringify(tableStats));
}
