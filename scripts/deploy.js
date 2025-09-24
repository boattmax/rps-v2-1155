const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const baseURI = "ipfs://bafybeiaklteght2bgckoo23ee6ck7hl4u2qwbfvn3z2gxd7uhwioicxz3e/"; // <-- Change to your metadata CID (end with /)

  const Cards = await hre.ethers.getContractFactory("RPSCards1155");
  const cards = await Cards.deploy(baseURI, deployer.address);
  await cards.waitForDeployment();
  console.log("RPSCards1155:", await cards.getAddress());

  const Game = await hre.ethers.getContractFactory("RPSGame1155");
  const game = await Game.deploy(await cards.getAddress());
  await game.waitForDeployment();
  console.log("RPSGame1155:", await game.getAddress());

  const ids = [1,2,3,4,5,6];
  const amounts = [3,3,3,3,3,3];
  const tx = await cards.devMintBatch(deployer.address, ids, amounts);
  await tx.wait();
  console.log("Dev minted starter pack to:", deployer.address);
}

main().catch((e) => { console.error(e); process.exit(1); });
