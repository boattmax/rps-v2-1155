// scripts/export-abi.js
const fs = require("fs/promises");
const path = require("path");

const ART = p => path.join(__dirname, "..", "artifacts", "contracts", p);
const OUT = path.join(__dirname, "..", "web", "abi");

const targets = [
  { file: "RPSCards1155.sol", name: "RPSCards1155" },
  { file: "RPSGame1155.sol",  name: "RPSGame1155"  },
];

(async () => {
  await fs.mkdir(OUT, { recursive: true });
  for (const t of targets) {
    const src = path.join(ART(t.file), `${t.name}.json`);
    const j = JSON.parse(await fs.readFile(src, "utf8"));
    const minimal = { contractName: t.name, abi: j.abi };
    await fs.writeFile(path.join(OUT, `${t.name}.json`), JSON.stringify(minimal, null, 2));
    console.log("✔ ABI written:", t.name);
  }
})().catch(e => { console.error(e); process.exit(1); });
