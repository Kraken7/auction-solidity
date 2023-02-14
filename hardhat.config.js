require("@nomicfoundation/hardhat-toolbox")
require("solidity-coverage")
require("hardhat-gas-reporter")

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.17",
  gasReporter: {
    enabled: false,
    gasPrice: 21
  }
};
