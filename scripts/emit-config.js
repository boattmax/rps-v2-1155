// scripts/emit-config.js
const fs = require("fs"); const a = require("../frontend-addresses.json");
fs.writeFileSync("./public/config.js", `window.CFG=${JSON.stringify(a,null,2)};`);
