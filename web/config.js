// config.js  (safe overlay – no re-declare)
;(function () {
  const C = (window.CFG = window.CFG || {});

  // ===== CONTRACT ADDRESSES (ใส่ของคุณ ถ้ามีอยู่แล้วจะไม่ทับ) =====
  C.NFT_ADDRESS  = C.NFT_ADDRESS  || "0x5E8c2C4e35bd8B5C2b521AD4d997e9EC9267A275"; // RPSCards1155
  C.GAME_ADDRESS = C.GAME_ADDRESS || "0xAa329838825e474d01Fcb0210dFaB69825ca4bA4"; // RPSGame1155

  // ===== TARGET CHAIN (OP Sepolia) =====
  C.CHAIN = C.CHAIN || {
    idDec: 11155420,
    idHex: "0xaa37dc",
    name: "OP Sepolia",
    rpcUrls: ["https://sepolia.optimism.io"],     // เปลี่ยนเป็น RPC ที่คุณใช้จริงได้
    explorer: "https://sepolia-optimism.etherscan.io",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  };
})();
