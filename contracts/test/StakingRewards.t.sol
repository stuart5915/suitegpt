// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/staking/SuiteStaking.sol";
import "../src/staking/UsdcWithdrawals.sol";
import "../src/SuiteToken.sol";

/**
 * @title RedemptionPoolTest
 * @notice Tests for bonus credits and USDC redemption system
 */

contract MockUSDC {
    string public name = "USD Coin";
    string public symbol = "USDC";
    uint8 public decimals = 6;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract RedemptionPoolTest is Test {
    SuiteStaking public staking;
    UsdcWithdrawals public withdrawals;
    SuiteToken public suiteToken;
    MockUSDC public usdc;

    address public owner = address(1);
    address public treasury = address(2);
    address public user1 = address(3);
    address public user2 = address(4);
    address public user3 = address(5);

    function setUp() public {
        // Deploy SuiteToken
        vm.prank(owner);
        suiteToken = new SuiteToken(owner);

        // Deploy MockUSDC
        usdc = new MockUSDC();

        // Deploy SuiteStaking
        vm.prank(owner);
        staking = new SuiteStaking(
            address(suiteToken),
            address(usdc),
            treasury,
            owner
        );

        // Deploy UsdcWithdrawals
        vm.prank(owner);
        withdrawals = new UsdcWithdrawals(address(usdc), address(staking), owner);

        // Setup: Link staking to withdrawals
        vm.prank(owner);
        staking.setWithdrawalContract(address(withdrawals));

        vm.prank(owner);
        suiteToken.addMinter(address(staking));

        // Give owner USDC for pool funding
        usdc.mint(owner, 10000e6); // $10,000
    }

    // ============ Report Liquid Value Tests ============

    function test_OwnerCanReportLiquidValue() public {
        vm.prank(owner);
        withdrawals.reportLiquidValue(800e6); // $800

        assertEq(withdrawals.reportedLiquidValue(), 800e6);
    }

    function test_RedemptionPercentageCalculation() public {
        // Give users bonus credits: 1,000,000 total = $1000 face value
        vm.prank(owner);
        staking.addBonusCredits(user1, 500000e18);
        vm.prank(owner);
        staking.addBonusCredits(user2, 500000e18);

        // Report $800 liquid value = 80% rate
        vm.prank(owner);
        withdrawals.reportLiquidValue(800e6);

        uint256 percentage = withdrawals.getRedemptionPercentage();
        assertEq(percentage, 0.8e18); // 80%
    }

    function test_MaxRedeemableCalculation() public {
        // User1 has 100,000 credits ($100 face value)
        vm.prank(owner);
        staking.addBonusCredits(user1, 100000e18);

        // Report $80 liquid value (only one user, so 80% rate)
        vm.prank(owner);
        withdrawals.reportLiquidValue(80e6);

        uint256 maxRedeemable = withdrawals.getMaxRedeemable(user1);
        assertEq(maxRedeemable, 80e6); // Can request up to $80
    }

    // ============ Request Redemption Tests ============

    function test_UserCanRequestRedemption() public {
        // Setup: User has 100,000 credits
        vm.prank(owner);
        staking.addBonusCredits(user1, 100000e18);

        // Report $100 liquid value (100% rate)
        vm.prank(owner);
        withdrawals.reportLiquidValue(100e6);

        // User requests $50
        vm.prank(user1);
        withdrawals.requestRedemption(50e6);

        assertEq(withdrawals.pendingRequests(user1), 50e6);
        assertEq(withdrawals.totalPendingRequests(), 50e6);
        assertEq(staking.bonusCredits(user1), 50000e18); // Half credits locked
    }

    function test_UserCanRequestRedemptionAll() public {
        // Setup: User has 100,000 credits
        vm.prank(owner);
        staking.addBonusCredits(user1, 100000e18);

        // Report $80 liquid value (80% rate)
        vm.prank(owner);
        withdrawals.reportLiquidValue(80e6);

        // User requests all
        vm.prank(user1);
        withdrawals.requestRedemptionAll();

        assertEq(withdrawals.pendingRequests(user1), 80e6);
        assertEq(staking.bonusCredits(user1), 0); // All credits locked
    }

    function test_CannotRequestMoreThanMax() public {
        vm.prank(owner);
        staking.addBonusCredits(user1, 100000e18);

        vm.prank(owner);
        withdrawals.reportLiquidValue(80e6);

        // Try to request $100 when max is $80
        vm.prank(user1);
        vm.expectRevert(UsdcWithdrawals.ExceedsMaxRedeemable.selector);
        withdrawals.requestRedemption(100e6);
    }

    function test_CannotRequestTwice() public {
        vm.prank(owner);
        staking.addBonusCredits(user1, 100000e18);

        vm.prank(owner);
        withdrawals.reportLiquidValue(100e6);

        vm.prank(user1);
        withdrawals.requestRedemption(50e6);

        // Try to request again
        vm.prank(user1);
        vm.expectRevert(UsdcWithdrawals.AlreadyHasPendingRequest.selector);
        withdrawals.requestRedemption(25e6);
    }

    // ============ Cancel Request Tests ============

    function test_UserCanCancelRequest() public {
        vm.prank(owner);
        staking.addBonusCredits(user1, 100000e18);

        vm.prank(owner);
        withdrawals.reportLiquidValue(100e6);

        vm.prank(user1);
        withdrawals.requestRedemption(50e6);

        assertEq(staking.bonusCredits(user1), 50000e18);

        // Cancel
        vm.prank(user1);
        withdrawals.cancelRequest();

        assertEq(withdrawals.pendingRequests(user1), 0);
        assertEq(withdrawals.totalPendingRequests(), 0);
        assertEq(staking.bonusCredits(user1), 100000e18); // Credits restored
    }

    // ============ Fund Pool Tests ============

    function test_OwnerCanFundPool() public {
        vm.prank(owner);
        usdc.approve(address(withdrawals), 500e6);

        vm.prank(owner);
        withdrawals.fundPool(500e6);

        assertEq(withdrawals.fundedPool(), 500e6);
        assertEq(usdc.balanceOf(address(withdrawals)), 500e6);
    }

    function test_FundPoolMatchesPendingRequests() public {
        // 3 users request different amounts
        vm.prank(owner);
        staking.addBonusCredits(user1, 100000e18);
        vm.prank(owner);
        staking.addBonusCredits(user2, 200000e18);
        vm.prank(owner);
        staking.addBonusCredits(user3, 100000e18);

        // Report $400 liquid value (100% rate for 400k credits)
        vm.prank(owner);
        withdrawals.reportLiquidValue(400e6);

        // Users request
        vm.prank(user1);
        withdrawals.requestRedemption(80e6); // $80

        vm.prank(user2);
        withdrawals.requestRedemption(120e6); // $120

        vm.prank(user3);
        withdrawals.requestRedemption(50e6); // $50

        // Total pending = $250
        assertEq(withdrawals.totalPendingRequests(), 250e6);

        // Owner funds with single transaction
        vm.prank(owner);
        usdc.approve(address(withdrawals), 250e6);
        vm.prank(owner);
        withdrawals.fundPool(250e6);

        assertEq(withdrawals.fundedPool(), 250e6);
    }

    // ============ Claim Tests ============

    function test_UserCanClaim() public {
        // Setup
        vm.prank(owner);
        staking.addBonusCredits(user1, 100000e18);

        vm.prank(owner);
        withdrawals.reportLiquidValue(100e6);

        vm.prank(user1);
        withdrawals.requestRedemption(80e6);

        // Fund pool
        vm.prank(owner);
        usdc.approve(address(withdrawals), 80e6);
        vm.prank(owner);
        withdrawals.fundPool(80e6);

        // Claim
        vm.prank(user1);
        withdrawals.claim();

        assertEq(usdc.balanceOf(user1), 80e6);
        assertEq(withdrawals.pendingRequests(user1), 0);
        assertEq(withdrawals.fundedPool(), 0);
        assertEq(withdrawals.totalClaimedUsdc(), 80e6);
    }

    function test_MultipleUsersClaim() public {
        // Setup users
        vm.prank(owner);
        staking.addBonusCredits(user1, 100000e18);
        vm.prank(owner);
        staking.addBonusCredits(user2, 100000e18);

        vm.prank(owner);
        withdrawals.reportLiquidValue(200e6);

        // Both request
        vm.prank(user1);
        withdrawals.requestRedemption(80e6);
        vm.prank(user2);
        withdrawals.requestRedemption(60e6);

        // Fund with single transaction
        vm.prank(owner);
        usdc.approve(address(withdrawals), 140e6);
        vm.prank(owner);
        withdrawals.fundPool(140e6);

        // Both claim
        vm.prank(user1);
        withdrawals.claim();
        vm.prank(user2);
        withdrawals.claim();

        assertEq(usdc.balanceOf(user1), 80e6);
        assertEq(usdc.balanceOf(user2), 60e6);
        assertEq(withdrawals.fundedPool(), 0);
    }

    function test_CannotClaimWithoutFunding() public {
        vm.prank(owner);
        staking.addBonusCredits(user1, 100000e18);

        vm.prank(owner);
        withdrawals.reportLiquidValue(100e6);

        vm.prank(user1);
        withdrawals.requestRedemption(80e6);

        // Try to claim without funding
        vm.prank(user1);
        vm.expectRevert(UsdcWithdrawals.InsufficientPool.selector);
        withdrawals.claim();
    }

    function test_CannotClaimWithInsufficientPool() public {
        vm.prank(owner);
        staking.addBonusCredits(user1, 100000e18);

        vm.prank(owner);
        withdrawals.reportLiquidValue(100e6);

        vm.prank(user1);
        withdrawals.requestRedemption(80e6);

        // Fund only $50
        vm.prank(owner);
        usdc.approve(address(withdrawals), 50e6);
        vm.prank(owner);
        withdrawals.fundPool(50e6);

        // Try to claim $80 with only $50 in pool
        vm.prank(user1);
        vm.expectRevert(UsdcWithdrawals.InsufficientPool.selector);
        withdrawals.claim();
    }

    // ============ Rate Increase Over Time ============

    function test_RateIncreasesWhenLiquidValueIncreases() public {
        vm.prank(owner);
        staking.addBonusCredits(user1, 100000e18); // $100 face value

        // Initially 80%
        vm.prank(owner);
        withdrawals.reportLiquidValue(80e6);
        assertEq(withdrawals.getMaxRedeemable(user1), 80e6);

        // Admin earns more yield, reports higher value
        vm.prank(owner);
        withdrawals.reportLiquidValue(120e6);
        assertEq(withdrawals.getMaxRedeemable(user1), 120e6); // 120%!
    }

    // ============ Full Integration Test ============

    function test_FullFlow() public {
        // 1. Users buy credits via buyAndStake
        usdc.mint(user1, 100e6);
        usdc.mint(user2, 100e6);

        vm.prank(user1);
        usdc.approve(address(staking), 100e6);
        vm.prank(user1);
        staking.buyAndStake(100e6); // 100,000 staked credits

        vm.prank(user2);
        usdc.approve(address(staking), 100e6);
        vm.prank(user2);
        staking.buyAndStake(100e6); // 100,000 staked credits

        // 2. Treasury earns yield, distributes as bonus credits
        vm.prank(owner);
        staking.addBonusCredits(user1, 10000e18); // +10,000 bonus

        vm.prank(owner);
        staking.addBonusCredits(user2, 10000e18); // +10,000 bonus

        // Total bonus = 20,000 credits = $20 face value
        assertEq(staking.totalBonusCredits(), 20000e18);

        // 3. Admin reports liquid value (80% rate)
        vm.prank(owner);
        withdrawals.reportLiquidValue(16e6); // $16 for $20 face = 80%

        // 4. User1 wants to cash out
        uint256 maxRedeemable = withdrawals.getMaxRedeemable(user1);
        assertEq(maxRedeemable, 8e6); // $8 (10k credits at 80%)

        vm.prank(user1);
        withdrawals.requestRedemptionAll();

        // 5. Admin sees pending requests
        assertEq(withdrawals.totalPendingRequests(), 8e6);

        // 6. Admin funds the pool
        vm.prank(owner);
        usdc.approve(address(withdrawals), 8e6);
        vm.prank(owner);
        withdrawals.fundPool(8e6);

        // 7. User1 claims
        vm.prank(user1);
        withdrawals.claim();

        // 8. Verify final state
        assertEq(usdc.balanceOf(user1), 8e6); // Got $8
        assertEq(staking.bonusCredits(user1), 0); // Bonus credits gone
        assertEq(staking.stakedBalance(user1), 100000e18); // Staked unchanged

        // User2 still has bonus credits
        assertEq(staking.bonusCredits(user2), 10000e18);
    }
}
