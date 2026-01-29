// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/staking/StakingRewards.sol";

/**
 * @title DeployStakingRewards
 * @notice Deploy the StakingRewards contract for reward pool distribution
 *
 * Usage:
 *   # Dry run
 *   forge script script/DeployStakingRewards.s.sol --rpc-url base --private-key $PRIVATE_KEY
 *
 *   # Deploy
 *   forge script script/DeployStakingRewards.s.sol --rpc-url base --private-key $PRIVATE_KEY --broadcast
 *
 *   # Deploy + verify on Basescan
 *   forge script script/DeployStakingRewards.s.sol --rpc-url base --private-key $PRIVATE_KEY --broadcast --verify
 */
contract DeployStakingRewards is Script {
    // Deployed contract addresses (Base Mainnet)
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant SUITE_TOKEN = 0xbec717C3E8f7C62628BF35c59Cea2142C340A89f;
    address constant SUITE_STAKING = 0x539d3fE65339c0dA7aaa6D0a528b520d8B010F54;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deployer:", deployer);
        console.log("USDC:", USDC);
        console.log("SuiteToken:", SUITE_TOKEN);
        console.log("SuiteStaking:", SUITE_STAKING);

        vm.startBroadcast(deployerPrivateKey);

        StakingRewards rewards = new StakingRewards(
            USDC,
            SUITE_TOKEN,
            SUITE_STAKING,
            deployer // owner
        );

        console.log("StakingRewards deployed:", address(rewards));
        console.log("Rewards duration: 30 days (default)");

        vm.stopBroadcast();

        console.log("\n========== DEPLOYMENT COMPLETE ==========");
        console.log("StakingRewards:", address(rewards));
        console.log("\nDepositor functions:");
        console.log("- depositRewards(uint256 amount): Deposit USDC to distribute");
        console.log("\nStaker functions:");
        console.log("- earned(address): View accrued USDC rewards");
        console.log("- claimUsdc(): Withdraw earned USDC");
        console.log("- claimAndCompound(): Convert rewards to more credits");
        console.log("\nUpdate base-mainnet.json with the deployed address!");
    }
}
