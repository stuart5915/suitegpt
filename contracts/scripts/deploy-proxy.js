import { ethers } from "ethers";
import { readFileSync } from "fs";
import dotenv from "dotenv";
dotenv.config();

// Deployed addresses
const SUITE_TOKEN = "0xE6892803DF59D79cFB4794e7da9549df4eE70f71";
const TREASURY_IMPL = "0xdaD37C8A7610eD4572f5F5Db4e0b38308482c8F7"; // Implementation
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// Minimal ERC1967 Proxy bytecode (from OpenZeppelin)
const ERC1967_PROXY_BYTECODE = "0x608060405260405161032138038061032183398101604081905261002291610199565b61002c8282610033565b5050610267565b61003c826100a9565b6040516001600160a01b038316907fbc7cd75a20ee27fd9adebab32041f755214dbc6bffa90cc0225b39da2e5c2d3b90600090a280511561009d5761009882826100ff565b505050565b6100a5610175565b5050565b6001600160a01b0381166100d857604051631e4fbdf760e01b81526000600482015260240160405180910390fd5b7f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc80546001600160a01b0319166001600160a01b0392909216919091179055565b6060600080846001600160a01b03168460405161011c919061024b565b600060405180830381855af49150503d8060008114610157576040519150601f19603f3d011682016040523d82523d6000602084013e61015c565b606091505b509150915061016c858383610196565b95945050505050565b34156101945760405163b398979f60e01b815260040160405180910390fd5b565b6060826101ab576101a6826101ec565b6101e5565b81511580156101c257506001600160a01b0384163b155b156101e257604051639996b31560e01b81526001600160a01b03851660048201526024015b60405180910390fd5b50805b9392505050565b8051156101fc5780518082602001fd5b604051630a12f52160e11b815260040160405180910390fd5b634e487b7160e01b600052604160045260246000fd5b60005b8381101561024657818101518382015260200161022e565b50506000910152565b6000825161026181846020870161022b565b9190910192915050565b60ac806102756000396000f3fe6080604052600a600c565b005b60186014601a565b6051565b565b6000604c7f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc546001600160a01b031690565b905090565b3660008037600080366000845af43d6000803e808015606f573d6000f35b3d6000fdfea2646970667358221220";

async function main() {
    const provider = new ethers.JsonRpcProvider("https://mainnet.base.org", undefined, {
        staticNetwork: true
    });
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    console.log("Deploying Treasury Proxy with:", wallet.address);

    const balance = await provider.getBalance(wallet.address);
    console.log("Account balance:", ethers.formatEther(balance), "ETH");

    // Load Treasury ABI to encode initialize call
    const treasuryArtifact = JSON.parse(
        readFileSync("./artifacts/src/SuiteTreasury.sol/SuiteTreasury.json", "utf8")
    );

    // Encode the initialize function call
    const iface = new ethers.Interface(treasuryArtifact.abi);
    const initData = iface.encodeFunctionData("initialize", [
        SUITE_TOKEN,
        USDC_BASE,
        wallet.address
    ]);

    console.log("\nDeploying ERC1967 Proxy...");
    console.log("Implementation:", TREASURY_IMPL);
    console.log("Init data:", initData.slice(0, 20) + "...");

    // Deploy proxy using CREATE
    // The proxy constructor takes (implementation, initData)
    const ProxyFactory = new ethers.ContractFactory(
        ["constructor(address implementation, bytes memory _data)"],
        ERC1967_PROXY_BYTECODE,
        wallet
    );

    try {
        const proxy = await ProxyFactory.deploy(TREASURY_IMPL, initData, {
            gasLimit: 1000000
        });
        await proxy.waitForDeployment();
        const proxyAddress = await proxy.getAddress();

        console.log("✅ Treasury Proxy deployed to:", proxyAddress);

        console.log("\n=== TREASURY READY ===");
        console.log("Use this address for deposits:", proxyAddress);
        console.log("\nUpdate wallet.html with this new Treasury address!");

    } catch (error) {
        console.error("Proxy deployment failed:", error.message);

        // Fallback - try simpler approach
        console.log("\n--- Trying alternative approach ---");
        console.log("The implementation contract might work for testing.");
        console.log("For production, recommend deploying via OpenZeppelin Defender or Remix.");
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
