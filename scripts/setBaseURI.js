const hre = require("hardhat");

async function main() {
  const CARDS = "0x5E8c2C4e35bd8B5C2b521AD4d997e9EC9267A275"; // RPSCards1155
  const NEW_BASE = "ipfs://bafybeiaklteght2bgckoo23ee6ck7hl4u2qwbfvn3z2gxd7uhwioicxz3e/"; // ปิดท้ายด้วย /

  const cards = await hre.ethers.getContractAt("RPSCards1155", CARDS);
  const tx = await cards.setBaseURI(NEW_BASE);
  console.log("tx:", tx.hash);
  await tx.wait();
  console.log("✅ setBaseURI done:", NEW_BASE);
}

main().catch((e) => { console.error(e); process.exit(1); });
