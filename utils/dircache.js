const fs = require('fs')
const path = require('path');

//https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
const cyrb53 = function(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1>>>16), 2246822507) ^ Math.imul(h2 ^ (h2>>>13), 3266489909);
  h2 = Math.imul(h2 ^ (h2>>>16), 2246822507) ^ Math.imul(h1 ^ (h1>>>13), 3266489909);
  //return 4294967296 * (2097151 & h2) + (h1>>>0);
  return (h2>>>0).toString(16).padStart(8,0)+(h1>>>0).toString(16).padStart(8,0);
};


function hashKey(key) {
  if (key.length > 200) {
    return `hash${cyrb53(key)}`;
  }
  return key;
}

module.exports = class DirCache {
  constructor(cacheRoot) {
    if (!cacheRoot) {
      this.cacheRoot = path.resolve('./cache/mvt')
    } else {
      this.cacheRoot = cacheRoot;
    }
  }
  getCachedFile(dir, key) {
    const file = path.join(this.cacheRoot, dir, hashKey(key));
    return new Promise((resolve, reject)=>{
      fs.readFile(file, (err, data) => {
        if (err) {
          resolve(null);
        } else {
          resolve(data)
        }
      })
    })
  }
  setCachedFile(dir, key, data) {
    const dirName = path.join(this.cacheRoot, dir);
    const filePath = path.join(dirName, hashKey(key));
    fs.mkdirSync(dirName, {recursive: true});
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, data, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      })
    })
  }
  clearCache(dir) {
    const dirName = path.join(this.cacheRoot, dir);
    return new Promise((resolve, reject) => {
      if (!dir || dir.trim() === '') {
        reject(new Error('clearCache: no table name provided'));
        return;
      }
      fs.lstat (dirName, (err, stats)=> {
        if (err) {
          reject(err);
          return;
        } 
        if (!stats.isDirectory()) {
          reject(new Error(`clearCache: cache '${dirName}' is not a directory`));
          return;
        }
        fs.rmdir(dirName, {recursive: true, force: true}, (err)=> {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        })
      })
    })
  }
}

function cacheDirName(params) {
  return `${path.dirname(__dirname)}/cache/mvt/${params.table}/${params.z}/${params.x}/${params.y}`
}
  
function cacheFileName(query) {
  if (query.columns) {
    return hashKey(query.columns);
  }
  return 'noquery';
}
  
function getCache(params, query) {
  const dirname = cacheDirName(params);
  const filename = cacheFileName(query);
  
  //console.log(`getCache: ${dirname}`);
  return fsPromises.readFile(`${dirname}/${filename}`)
    .then(data=>data)
    .catch(error=>null);
}
  
function setCache(params, query, data) {
  const dirname = cacheDirName(params);
  const filename = cacheFileName(query);
  
  //console.log(`setCache: ${dirname}`);
  return fsPromises.writeFile(`${dirname}/${filename}`, data)
    .then(() => {return})
    .catch(err=>err);
}
  
function lockCache(params, query) {
  const dirname = cacheDirName(params);
  const filename = cacheFileName(query);
  fs.mkdirSync(dirname, {recursive: true});
  return fsPromises.writeFile(`${dirname}/${filename}.lck`, 'lock', {flag: 'wx'})
    .then(()=>{
      return true
    })
    .catch(err=>{
      return fsPromises.stat(`${dirname}/${filename}.lck`)
        .then(st=>{
          console.log(Date.now() - st.ctimeMs);
          if (Date.now() - st.ctimeMs > 240000) {
            return unlockCache(params,query).then(()=>lockCache(params,query));
          } else {
            return false;
          }
        })
        .catch(err=>{
          console.log(err);
          return false;
        });
      });
}
  
function unlockCache(params, query){
  const dirname = cacheDirName(params);
  const filename = cacheFileName(query);
  return fsPromises.unlink(`${dirname}/${filename}.lck`)
    .then(()=>true)
    .catch(err=>{
      console.log(`unlockCache: error: ${err}`);
      return false;
    })
}

function wait(ms) {
  return new Promise((r, j)=>setTimeout(r, ms));
}

async function waitForCache(params, query) {
  const dirname = cacheDirName(params);
  const filename = cacheFileName(query);
  for (let i = 0; i < 180; i++) {
    console.log(`waiting for cache.. ${i}`);
    await wait(1000);
    data = await getCache(params, query);
    if (data) {
      console.log(`cache wait done.. ${i}`)
      return data;
    }
  }
  console.log(`cache wait failed`);
  return null;
}