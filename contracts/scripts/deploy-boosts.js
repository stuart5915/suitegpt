const hre = require("hardhat");

async function main() {
    console.log("Deploying SuiteBoosts ERC-1155 contract...");

    const SuiteBoosts = await hre.ethers.getContractFactory("SuiteBoosts");
    const boosts = await SuiteBoosts.deploy();
    await boosts.waitForDeployment();

    const address = await boosts.getAddress();
    console.log(`SuiteBoosts deployed to: ${address}`);

    // Verify boost names are set correctly
    console.log("\nBoost Types:");
    console.log(`  1: ${await boosts.boostNames(1)}`);
    console.log(`  2: ${await boosts.boostNames(2)}`);
    console.log(`  3: ${await boosts.boostNames(3)}`);
    console.log(`  4: ${await boosts.boostNames(4)}`);
    console.log(`  5: ${await boosts.boostNames(5)}`);

    console.log("\n✅ Deployment complete!");
    console.log(`\nAdd this to your .env:`);
    console.log(`SUITE_BOOSTS_ADDRESS=${address}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
