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

  function ogr2ogr(fileName, tableName, pool) {
    return new Promise((resolve, reject)=>{
      exec (`ogr2ogr -f "PostgreSQL" PG:"host=${pool.$cn.host} user=${pool.$cn.user} dbname=${pool.$cn.database} password=${pool.$cn.password} port=${pool.$cn.port?pool.$cn.port:5432}" -nlt PROMOTE_TO_MULTI -overwrite -lco GEOMETRY_NAME=geom -nln ${tableName} "${fileName}"`, (err, stdout, stderr)=>{
        if (err) {
            reject(err.message);
        } else {
            resolve({stdout: stdout, stderr: stderr});
        }
      })
    })
  }

  app.get('/admin/import', (req, res)=>{
    let tablename = path.parse(req.query.file).name.toLowerCase();
    tablename = tablename.replace(/\./g, '_').replace(/ /g, '_');
    let fileName = `${__dirname}/admin/files/${req.query.file}`;
    ogr2ogr(fileName, tablename, pool)
      .then((io)=>{
        res.json({result: "ok", io: io});
      })
      .catch((err)=> {
        res.json({error: err});
      });
    
    /*
    ogr2ogr(`${__dirname}/admin/files/${req.query.file}`)
    .format('PostgreSQL')
        .destination(`PG:host=${pool.$cn.host} user=${pool.$cn.user} dbname=${pool.$cn.database} password=${pool.$cn.password} port=${pool.$cn.port?pool.$cn.port:5432}`)
        .options(['-nlt', 'PROMOTE_TO_MULTI', '-overwrite', '-lco', 'GEOMETRY_NAME=geom', '-nln', tablename])
        .exec((err, data) => {
            if (err) {
              res.json({error: err.message});
              return;
            }
            res.json({result: "ok"});
        })*/
  })
}
