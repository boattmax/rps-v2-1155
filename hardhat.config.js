require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
require("solidity-coverage");
require("hardhat-gas-reporter");


const { PRIVATE_KEY, OP_SEPOLIA_RPC_URL } = process.env;

module.exports = {
  solidity: "0.8.24",
  networks: {
    op_sepolia: {
      url: OP_SEPOLIA_RPC_URL || "",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 11155420, // OP Sepolia
    },
  },
  gasReporter: {
  enabled: true,
  currency: "USD",
  // เปิดใช้ CMC ได้ถ้าใส่คีย์: process.env.CMC_KEY
  coinmarketcap: process.env.CMC_KEY || undefined,
  // เลือก token เพื่อคูณเป็นค่าเงิน–ถ้าเล่น Optimism ใช้ "ETH"
  token: "ETH",
  // รายงานเป็น markdown เวลาใช้ CI
  outputFile: process.env.CI ? "gas-report.md" : undefined,
  noColors: !!process.env.CI,
},
  mocha: { timeout: 120000 },
};
