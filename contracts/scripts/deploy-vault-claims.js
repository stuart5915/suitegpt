import { ethers } from "ethers";
import { readFileSync, writeFileSync } from "fs";
import dotenv from "dotenv";
dotenv.config();

async function main() {
    const provider = new ethers.JsonRpcProvider("https://mainnet.base.org", undefined, {
        staticNetwork: true
    });
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    console.log("Deploying VaultClaims with:", wallet.address);

    const balance = await provider.getBalance(wallet.address);
    console.log("Account balance:", ethers.formatEther(balance), "ETH");

    // Admin wallets - you can add more here
    const adminWallets = [
        "0xf121C51E18aD8f8C9B38EEAA377aD4393E16e3d1", // Treasury wallet
        wallet.address, // Deployer wallet
    ];

    console.log("Admin wallets:", adminWallets);

    // Read the compiled contract
    const artifact = JSON.parse(
        readFileSync("./artifacts/src/VaultClaims.sol/VaultClaims.json", "utf8")
    );

    // Deploy VaultClaims
    console.log("\nDeploying VaultClaims...");

    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    const vaultClaims = await factory.deploy(
        adminWallets,
        { gasLimit: 2000000 }
    );

    console.log("Transaction sent, waiting for confirmation...");
    await vaultClaims.waitForDeployment();
    const contractAddress = await vaultClaims.getAddress();

    console.log("\n========================================");
    console.log("VaultClaims deployed to:", contractAddress);
    console.log("========================================");

    // Save deployment info
    const deployResult = {
        network: "base",
        chainId: 8453,
        contractAddress: contractAddress,
        adminWallets: adminWallets,
        deployer: wallet.address,
        timestamp: new Date().toISOString()
    };

    writeFileSync("vault-claims-deployed.json", JSON.stringify(deployResult, null, 2));
    console.log("\nSaved to vault-claims-deployed.json");

    console.log("\nNext steps:");
    console.log("1. Update VAULT_CLAIMS_ADDRESS in wallet.html to:", contractAddress);
    console.log("2. Approve USDC spending and deposit USDC to the contract");
    console.log("3. Users can then claim their approved withdrawals");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
