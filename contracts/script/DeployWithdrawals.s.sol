// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/SuiteToken.sol";
import "../src/staking/SuiteStaking.sol";
import "../src/staking/UsdcWithdrawals.sol";

/**
 * @title DeployWithdrawals
 * @notice Deploy updated SuiteStaking and new UsdcWithdrawals
 *
 * Usage:
 *   # Dry run
 *   forge script script/DeployWithdrawals.s.sol --rpc-url base
 *
 *   # Deploy
 *   forge script script/DeployWithdrawals.s.sol --rpc-url base --broadcast
 *
 *   # Deploy + Verify
 *   forge script script/DeployWithdrawals.s.sol --rpc-url base --broadcast --verify
 */
contract DeployWithdrawals is Script {
    // Existing contracts on Base
    address constant SUITE_TOKEN = 0xbec717C3E8f7C62628BF35c59Cea2142C340A89f;
    address constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deployer:", deployer);
        console.log("Using existing SuiteToken:", SUITE_TOKEN);
        console.log("USDC:", USDC_BASE);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy new SuiteStaking (with bonus credits support)
        SuiteStaking staking = new SuiteStaking(
            SUITE_TOKEN,
            USDC_BASE,
            deployer,  // treasury
            deployer   // owner
        );
        console.log("SuiteStaking deployed:", address(staking));

        // 2. Deploy UsdcWithdrawals
        UsdcWithdrawals withdrawals = new UsdcWithdrawals(
            USDC_BASE,
            address(staking),
            deployer   // owner
        );
        console.log("UsdcWithdrawals deployed:", address(withdrawals));

        // 3. Link staking to withdrawals
        staking.setWithdrawalContract(address(withdrawals));
        console.log("Withdrawal contract linked");

        // 4. Authorize staking as minter on SuiteToken
        SuiteToken token = SuiteToken(SUITE_TOKEN);
        token.addMinter(address(staking));
        console.log("Staking authorized as minter");

        vm.stopBroadcast();

        console.log("\n========== DEPLOYMENT COMPLETE ==========");
        console.log("SuiteToken (existing):", SUITE_TOKEN);
        console.log("SuiteStaking (NEW):", address(staking));
        console.log("UsdcWithdrawals (NEW):", address(withdrawals));
        console.log("Owner/Treasury:", deployer);
        console.log("\n=== UPDATE THESE IN profile.html ===");
        console.log("SUITE_STAKING_ADDRESS =", address(staking));
        console.log("USDC_WITHDRAWALS_ADDRESS =", address(withdrawals));
    }
}
