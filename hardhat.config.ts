import { HardhatUserConfig } from "hardhat/config";
import '@oasisprotocol/sapphire-hardhat';
import "@nomicfoundation/hardhat-toolbox";

import "./tasks/monitor";
import "./tasks/mint";
import "./tasks/pubkeys";
import "./tasks/transfer";
import "./tasks/burn";
import "./tasks/deploy";
import "./tasks/fetch-ethplorer";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
          enabled: true,
          runs: 200,
      }
    },
  },
  networks: {
    hardhat: {
      chainId: 1337 // We set 1337 to make interacting with MetaMask simpler
    },
    sapphire_local: {
      url: "http://localhost:8545",
      accounts: process.env.PRIVATE_KEY
        ? [process.env.PRIVATE_KEY]
        : [],
      chainId: 0x5afd,
    },
    sapphire: {
      url: "https://testnet.sapphire.oasis.dev",
      accounts: process.env.PRIVATE_KEY
        ? [process.env.PRIVATE_KEY]
        : [],
      chainId: 0x5aff,
    }
  }
};

export default config;
