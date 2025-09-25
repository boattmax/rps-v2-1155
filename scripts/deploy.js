// scripts/deploy.js
const hre  = require("hardhat");
const fs   = require("fs");
const path = require("path");

// เขียนไฟล์ addresses.json ที่ web/addresses.json
function writeAddresses(nwName, chainId, nftAddr, gameAddr) {
  const out = path.join(__dirname, "..", "web", "addresses.json");
  // ให้มีโฟลเดอร์ web แน่ๆ
  fs.mkdirSync(path.dirname(out), { recursive: true });

  // โหลดของเดิมถ้ามี
  let data = {};
  try { data = JSON.parse(fs.readFileSync(out, "utf8")); } catch {}

  data[nwName] = {
    chainId: typeof chainId === "bigint" ? chainId.toString() : chainId,
    RPSCards1155: nftAddr,
    RPSGame1155 : gameAddr,
  };

  fs.writeFileSync(out, JSON.stringify(data, null, 2));
  console.log("✔ wrote addresses to:", out);
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // network info
  const net = await hre.ethers.provider.getNetwork();
  const nwName  = hre.network.name || (net.name ?? "unknown");
  const chainId = net.chainId; // bigint

  // ใช้ค่าใน secret ถ้ามี ไม่งั้นใช้ default
  const baseURI = process.env.BASE_URI
    || "ipfs://bafybeiaklteght2bgckoo23ee6ck7hl4u2qwbfvn3z2gxd7uhwioicxz3e/";

  // Deploy NFT
  const Cards = await hre.ethers.getContractFactory("RPSCards1155");
  const cards = await Cards.deploy(baseURI, deployer.address);
  await cards.waitForDeployment();
  const cardsAddr = await cards.getAddress();
  console.log("RPSCards1155:", cardsAddr);

  // Deploy Game
  const Game = await hre.ethers.getContractFactory("RPSGame1155");
  const game = await Game.deploy(cardsAddr);
  await game.waitForDeployment();
  const gameAddr = await game.getAddress();
  console.log("RPSGame1155:", gameAddr);

  // Dev mint starter pack ให้ deployer
  const ids = [1,2,3,4,5,6];
  const amounts = [3,3,3,3,3,3];
  const tx = await cards.devMintBatch(deployer.address, ids, amounts);
  await tx.wait();
  console.log("Dev minted starter pack to:", deployer.address);

  // ✅ เขียนไฟล์ addresses.json สำหรับ frontend/CI
  writeAddresses(nwName, chainId, cardsAddr, gameAddr);

  console.log("All done ✅");
}

main().catch((e) => { console.error(e); process.exit(1); });
