// Deploy StakingFactory v2 (free deploy, no CLAWS fee required)
// Run: npx hardhat run scripts/deploy-staking-factory-v2.js --network base

const hre = require("hardhat");

async function main() {
    // Same constructor args as v1, but with deployFee = 0
    const implementation = "0xffA96A8e75fe6560D0b53E6b3aC18CFe23f875Db"; // ClawnchRewardsLite
    const burnToken = "0xB0b6e0E9da530f68D713cC03a813B506205aC808";      // INCLAWNCH
    const deployFee = 0;                                                    // FREE
    const feeRecipient = "0x91B5C0D07859CFeAfEB67d9694121CD741F049bd";    // inclawbate treasury

    console.log("Deploying StakingFactory v2 (free deploy)...");
    console.log("  implementation:", implementation);
    console.log("  burnToken:", burnToken);
    console.log("  deployFee:", deployFee);
    console.log("  feeRecipient:", feeRecipient);

    const Factory = await hre.ethers.getContractFactory("StakingFactory");
    const factory = await Factory.deploy(implementation, burnToken, deployFee, feeRecipient);
    await factory.waitForDeployment();

    const address = await factory.getAddress();
    console.log("\nStakingFactory v2 deployed to:", address);
    console.log("\nUpdate STAKING_FACTORY in inclawbator-app.js to:", address);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
