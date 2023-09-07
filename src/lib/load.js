
const versions = require("./src/versions.json");

const cache = {};
const defaluVersion = "1.19.4";
function load(version){
    if(versions[version]){
        try{
            if(cache[version]){
                return cache[version];
            }
            let res = {};
            versions[version].src.forEach(u=>{
                res[u] = require(`./src/${version}/${u}.json`);
            });
            cache[version] = res;
            return res;
        }catch{
            return null;
        }
    }else {
        return null;
    }
}

module.exports = {
    load,
    defaluVersion,
    supportedVersions: Object.keys(versions)
}
