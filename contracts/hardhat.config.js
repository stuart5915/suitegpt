import "@nomicfoundation/hardhat-ethers";
import dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";

const config = {
    solidity: {
        version: "0.8.20",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    },
    paths: {
        sources: "./src",
        artifacts: "./artifacts",
        cache: "./cache"
    },
    networks: {
        base: {
            type: "http",
            url: "https://mainnet.base.org",
            accounts: [PRIVATE_KEY],
            chainId: 8453,
        },
        baseSepolia: {
            type: "http",
            url: "https://sepolia.base.org",
            accounts: [PRIVATE_KEY],
            chainId: 84532,
        }
    }
};

export default config;
