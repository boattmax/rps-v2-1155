async function main() {
  const a = require("../frontend-addresses.json");
  if (!a.nft || !a.game) throw new Error("missing addresses");
  // NFT (ไม่มี constructor)
  try {
    await hre.run("verify:verify", { address: a.nft, constructorArguments: [] });
  } catch (e) { console.log("NFT verify:", e.message); }
  // Game (constructor = [nft])
  try {
    await hre.run("verify:verify", { address: a.game, constructorArguments: [a.nft] });
  } catch (e) { console.log("GAME verify:", e.message); }
}

module.exports = main;
if (require.main === module) main().catch((e)=>{ console.error(e); process.exit(1); });
