// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/SuiteToken.sol";
import "../src/staking/SuiteStaking.sol";

/**
 * @title DeployStaking
 * @notice Deployment script for SUITE Token and Staking contracts
 *
 * Usage:
 *   # Dry run (simulation)
 *   forge script script/DeployStaking.s.sol --rpc-url base --private-key $PRIVATE_KEY
 *
 *   # Actual deployment
 *   forge script script/DeployStaking.s.sol --rpc-url base --private-key $PRIVATE_KEY --broadcast
 *
 *   # With verification
 *   forge script script/DeployStaking.s.sol --rpc-url base --private-key $PRIVATE_KEY --broadcast --verify
 */
contract DeployStaking is Script {
    // ============ CONFIGURATION ============

    // USDC addresses by network
    address constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant USDC_MAINNET = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    // Initial SUITE to mint (for LP seeding) - 1 million SUITE
    uint256 constant INITIAL_MINT = 1_000_000 * 1e18;

    // ============ DEPLOYMENT ============

    function run() external {
        // Get deployer from private key
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Detect network and set USDC address
        address usdc;
        uint256 chainId = block.chainid;

        if (chainId == 8453) {
            // Base
            usdc = USDC_BASE;
            console.log("Deploying to Base");
        } else if (chainId == 1) {
            // Ethereum Mainnet
            usdc = USDC_MAINNET;
            console.log("Deploying to Ethereum Mainnet");
        } else {
            revert("Unsupported network");
        }

        console.log("Deployer:", deployer);
        console.log("USDC:", usdc);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy SuiteToken
        SuiteToken suiteToken = new SuiteToken(deployer);
        console.log("SuiteToken deployed:", address(suiteToken));

        // 2. Deploy SuiteStaking
        SuiteStaking staking = new SuiteStaking(
            address(suiteToken),
            usdc,
            deployer,  // treasury = deployer for now
            deployer   // owner = deployer
        );
        console.log("SuiteStaking deployed:", address(staking));

        // 3. Authorize staking contract as minter
        suiteToken.addMinter(address(staking));
        console.log("Staking authorized as minter");

        vm.stopBroadcast();

        // Output summary
        console.log("\n========== DEPLOYMENT COMPLETE ==========");
        console.log("SuiteToken:", address(suiteToken));
        console.log("SuiteStaking:", address(staking));
        console.log("Owner/Treasury:", deployer);
        console.log("\nUser functions:");
        console.log("- buy(usdcAmount): USDC -> SUITE to wallet");
        console.log("- stake(amount): SUITE -> staked for credits");
        console.log("- buyAndStake(usdcAmount): USDC -> SUITE -> staked");
        console.log("- unstake(amount): Get SUITE back (minus used credits)");
    }
}
