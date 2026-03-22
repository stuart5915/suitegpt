const hre = require("hardhat");

async function main() {
    const CLAWS_TOKEN = process.env.CLAWS_TOKEN_ADDRESS || "0x7ca47B141639B893C6782823C0b219f872056379";
    const OPERATOR = process.env.OPERATOR_ADDRESS;

    if (!OPERATOR) {
        console.error("Set OPERATOR_ADDRESS env var (server wallet that signs claim authorizations)");
        process.exit(1);
    }

    console.log("Deploying ComputeRewards...");
    console.log("  CLAWS token:", CLAWS_TOKEN);
    console.log("  Signer:", OPERATOR);

    const ComputeRewards = await hre.ethers.getContractFactory("ComputeRewards");
    const rewards = await ComputeRewards.deploy(CLAWS_TOKEN, OPERATOR);
    await rewards.waitForDeployment();

    const address = await rewards.getAddress();
    console.log("ComputeRewards deployed to:", address);
    console.log("");
    console.log("Next steps:");
    console.log("  1. Approve CLAWS spending: clawsToken.approve(\"" + address + "\", amount)");
    console.log("  2. Deposit rewards: computeRewards.depositRewards(amount)");
    console.log("  3. Set COMPUTE_REWARDS_ADDRESS=" + address + " in env vars");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
