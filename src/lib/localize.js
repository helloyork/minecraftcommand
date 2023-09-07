
const cache = {};
let currentLang = "en";
let localize;
function _localize(lang, defaultLang = "en"){
    let p = null;
    if(cache[lang]) {
        p = cache[lang];
    }else {
        try {
            p = require(`../localize/${lang}.json`);
            if(cache[defaultLang] === undefined) {
                cache[defaultLang] = require(`../localize/${defaultLang}.json`);
            }
        } catch {
            p = require(`../localize/${defaultLang}.json`);
        };
        cache[lang] = p;
    }
    return function(key, defaultText = ""){
        let output = "";
        if(p && p[key]) output = p[key]
        else if(cache[defaultLang] && cache[defaultLang][key]) output = cache[defaultLang][key]
        else if (defaultText) output = defaultText;
        return output;
    }
}

localize = _localize(currentLang);

module.exports = {
    setLang:function(lang){
        if(lang !== currentLang){
            currentLang = lang;
            localize = _localize(currentLang);
        };
        return localize;
    },
    getLocalize:function(){
        return {
            localize,
            currentLang,
        };
    },
}

