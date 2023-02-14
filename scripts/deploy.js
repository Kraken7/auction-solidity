const hre = require("hardhat");

async function main() {
  const AucEngine = await hre.ethers.getContractFactory("AucEngine");
  const aucEngine = await AucEngine.deploy();
  await aucEngine.deployed();

  console.log(aucEngine.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
