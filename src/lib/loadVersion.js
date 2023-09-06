
const versions = require("./src/versions.json");

function load(version){
    if(versions[version]){
        try{
            let res = {};
            versions[version].src.forEach(u=>{
                res[u] = require(`./src/${version}/${u}.json`);
            });
            return res;
        }catch{
            return null;
        }
    }else {
        return null;
    }
}

