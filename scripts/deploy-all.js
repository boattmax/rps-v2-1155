const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const NFT  = await ethers.deployContract("RPSCards1155");
  await NFT.waitForDeployment();
  const nftAddr = await NFT.getAddress();
  console.log("RPSCards1155:", nftAddr);

  const Game = await ethers.deployContract("RPSGame1155", [nftAddr]);
  await Game.waitForDeployment();
  const gameAddr = await Game.getAddress();
  console.log("RPSGame1155:", gameAddr);

  // dev mint ชุดแรก (ถ้าต้องการ)
  if (NFT.devMint) await (await NFT.devMint(deployer.address)).wait();

  // เขียน config สำหรับหน้าเว็บ
  const out = {
    network: hre.network.name,
    nft: nftAddr,
    game: gameAddr,
    chainId: Number(await hre.ethers.provider.getNetwork()).toString()
  };
  const file = path.join(__dirname, "..", "frontend-addresses.json");
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log("✓ wrote", file);
}

module.exports = main;

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
