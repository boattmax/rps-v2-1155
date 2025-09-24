const hre = require("hardhat");

async function main() {
  // <<< ใส่ที่อยู่ RPSCards1155 ที่มีอยู่เดิมของคุณที่นี่ >>>
  const CARDS = process.env.CARDS_ADDRESS || "0xYourExistingCards1155";

  const Game = await hre.ethers.getContractFactory("RPSGame1155");
  const game = await Game.deploy(CARDS);
  await game.waitForDeployment();
  console.log("RPSGame1155 (new):", await game.getAddress());
}

main().catch((e) => { console.error(e); process.exit(1); });
