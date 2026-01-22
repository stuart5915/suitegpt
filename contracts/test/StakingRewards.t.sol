// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/staking/SuiteStaking.sol";
import "../src/staking/UsdcWithdrawals.sol";
import "../src/SuiteToken.sol";

/**
 * @title RedemptionPoolTest
 * @notice Tests for bonus credits and USDC redemption pool system
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
    address public distributor = address(5);

    event BonusCreditsAdded(address indexed user, uint256 amount, address indexed distributor);
    event BonusCreditsRedeemed(address indexed user, uint256 amount);
    event PoolDeposit(uint256 amount, address indexed depositor);
    event Redeemed(address indexed user, uint256 creditsRedeemed, uint256 usdcReceived);

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

        // Give owner USDC for pool deposits
        usdc.mint(owner, 10000e6); // $10,000
    }

    // ============ Bonus Credits Tests ============

    function test_OwnerCanAddBonusCredits() public {
        vm.prank(owner);
        staking.addBonusCredits(user1, 1000e18);

        assertEq(staking.bonusCredits(user1), 1000e18);
        assertEq(staking.totalBonusCredits(), 1000e18);
        assertEq(staking.availableCredits(user1), 1000e18);
    }

    function test_DistributorCanAddBonusCredits() public {
        vm.prank(owner);
        staking.addRewardDistributor(distributor);

        vm.prank(distributor);
        staking.addBonusCredits(user1, 500e18);

        assertEq(staking.bonusCredits(user1), 500e18);
        assertEq(staking.totalBonusCredits(), 500e18);
    }

    function test_UnauthorizedCannotAddBonusCredits() public {
        vm.prank(user1);
        vm.expectRevert(SuiteStaking.UnauthorizedDistributor.selector);
        staking.addBonusCredits(user2, 100e18);
    }

    function test_BonusCreditsBatch() public {
        address[] memory users = new address[](2);
        users[0] = user1;
        users[1] = user2;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 1000e18;
        amounts[1] = 2000e18;

        vm.prank(owner);
        staking.addBonusCreditsBatch(users, amounts);

        assertEq(staking.bonusCredits(user1), 1000e18);
        assertEq(staking.bonusCredits(user2), 2000e18);
        assertEq(staking.totalBonusCredits(), 3000e18);
    }

    function test_TotalBonusCreditsTracking() public {
        vm.prank(owner);
        staking.addBonusCredits(user1, 1000e18);

        vm.prank(owner);
        staking.addBonusCredits(user2, 2000e18);

        assertEq(staking.totalBonusCredits(), 3000e18);
    }

    // ============ Redemption Pool Tests ============

    function test_OwnerCanDepositToPool() public {
        vm.prank(owner);
        usdc.approve(address(withdrawals), 100e6);

        vm.prank(owner);
        withdrawals.depositToPool(100e6);

        assertEq(withdrawals.totalRedeemableUsdc(), 100e6);
        assertEq(usdc.balanceOf(address(withdrawals)), 100e6);
    }

    function test_RedemptionRateCalculation() public {
        // Give users bonus credits
        vm.prank(owner);
        staking.addBonusCredits(user1, 100000e18); // 100,000 credits

        vm.prank(owner);
        staking.addBonusCredits(user2, 100000e18); // 100,000 credits

        // Total: 200,000 credits = $200 face value

        // Deposit $160 (80% rate)
        vm.prank(owner);
        usdc.approve(address(withdrawals), 160e6);
        vm.prank(owner);
        withdrawals.depositToPool(160e6);

        // Check redemption percentage (should be ~80% = 0.8e18)
        uint256 percentage = withdrawals.getRedemptionPercentage();
        assertEq(percentage, 0.8e18);
    }

    function test_UserCanRedeemCredits() public {
        // Setup: Give user1 100,000 bonus credits ($100 face value)
        vm.prank(owner);
        staking.addBonusCredits(user1, 100000e18);

        // Deposit $80 to pool (80% rate)
        vm.prank(owner);
        usdc.approve(address(withdrawals), 80e6);
        vm.prank(owner);
        withdrawals.depositToPool(80e6);

        // User redeems all their credits
        uint256 expectedUsdc = withdrawals.getRedeemableAmount(user1);
        assertEq(expectedUsdc, 80e6); // Should get $80

        vm.prank(user1);
        withdrawals.redeemAll();

        // Check results
        assertEq(usdc.balanceOf(user1), 80e6);
        assertEq(staking.bonusCredits(user1), 0);
        assertEq(staking.totalBonusCredits(), 0);
        assertEq(withdrawals.totalRedeemableUsdc(), 0);
        assertEq(withdrawals.totalRedeemedUsdc(), 80e6);
    }

    function test_PartialRedemption() public {
        // Give user 100,000 credits
        vm.prank(owner);
        staking.addBonusCredits(user1, 100000e18);

        // Deposit $100 (100% rate)
        vm.prank(owner);
        usdc.approve(address(withdrawals), 100e6);
        vm.prank(owner);
        withdrawals.depositToPool(100e6);

        // Redeem only half (50,000 credits = $50)
        vm.prank(user1);
        withdrawals.redeem(50000e18);

        assertEq(usdc.balanceOf(user1), 50e6);
        assertEq(staking.bonusCredits(user1), 50000e18);
        assertEq(staking.totalBonusCredits(), 50000e18);
        assertEq(withdrawals.totalRedeemableUsdc(), 50e6);
    }

    function test_MultipleUsersRedeem() public {
        // Give users credits
        vm.prank(owner);
        staking.addBonusCredits(user1, 100000e18); // $100 face

        vm.prank(owner);
        staking.addBonusCredits(user2, 200000e18); // $200 face

        // Total: $300 face value

        // Deposit $240 (80% rate)
        vm.prank(owner);
        usdc.approve(address(withdrawals), 240e6);
        vm.prank(owner);
        withdrawals.depositToPool(240e6);

        // User1 should get $80 (100k credits at 80%)
        assertEq(withdrawals.getRedeemableAmount(user1), 80e6);

        // User2 should get $160 (200k credits at 80%)
        assertEq(withdrawals.getRedeemableAmount(user2), 160e6);

        // Both redeem
        vm.prank(user1);
        withdrawals.redeemAll();

        vm.prank(user2);
        withdrawals.redeemAll();

        assertEq(usdc.balanceOf(user1), 80e6);
        assertEq(usdc.balanceOf(user2), 160e6);
        assertEq(withdrawals.totalRedeemableUsdc(), 0);
    }

    function test_RedemptionRateIncreases() public {
        // User has 100,000 credits
        vm.prank(owner);
        staking.addBonusCredits(user1, 100000e18);

        // Initially deposit $80 (80% rate)
        vm.prank(owner);
        usdc.approve(address(withdrawals), 200e6);
        vm.prank(owner);
        withdrawals.depositToPool(80e6);

        assertEq(withdrawals.getRedemptionPercentage(), 0.8e18);
        assertEq(withdrawals.getRedeemableAmount(user1), 80e6);

        // Admin earns more yield, deposits another $40
        vm.prank(owner);
        withdrawals.depositToPool(40e6);

        // Now rate is 120%!
        assertEq(withdrawals.getRedemptionPercentage(), 1.2e18);
        assertEq(withdrawals.getRedeemableAmount(user1), 120e6);

        // User redeems and gets MORE than face value
        vm.prank(user1);
        withdrawals.redeemAll();

        assertEq(usdc.balanceOf(user1), 120e6);
    }

    function test_CannotRedeemMoreThanBonusCredits() public {
        vm.prank(owner);
        staking.addBonusCredits(user1, 1000e18);

        vm.prank(owner);
        usdc.approve(address(withdrawals), 100e6);
        vm.prank(owner);
        withdrawals.depositToPool(100e6);

        vm.prank(user1);
        vm.expectRevert(UsdcWithdrawals.InsufficientBonusCredits.selector);
        withdrawals.redeem(2000e18);
    }

    function test_CannotRedeemWithEmptyPool() public {
        vm.prank(owner);
        staking.addBonusCredits(user1, 1000e18);

        // No pool deposit

        vm.prank(user1);
        vm.expectRevert(UsdcWithdrawals.NothingToRedeem.selector);
        withdrawals.redeemAll();
    }

    function test_OwnerCanWithdrawFromPool() public {
        // Deposit to pool
        vm.prank(owner);
        usdc.approve(address(withdrawals), 100e6);
        vm.prank(owner);
        withdrawals.depositToPool(100e6);

        uint256 ownerBalanceBefore = usdc.balanceOf(owner);

        // Withdraw half
        vm.prank(owner);
        withdrawals.withdrawFromPool(50e6);

        assertEq(withdrawals.totalRedeemableUsdc(), 50e6);
        assertEq(usdc.balanceOf(owner), ownerBalanceBefore + 50e6);
    }

    // ============ Integration Test ============

    function test_FullRewardsFlow() public {
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

        // Each user now has 110,000 total credits (100k staked + 10k bonus)
        assertEq(staking.availableCredits(user1), 110000e18);
        assertEq(staking.availableCredits(user2), 110000e18);

        // 3. Treasury deposits USDC to redemption pool
        // Total bonus = 20,000 credits = $20 face value
        // Deposit $16 = 80% rate
        vm.prank(owner);
        usdc.approve(address(withdrawals), 16e6);
        vm.prank(owner);
        withdrawals.depositToPool(16e6);

        // 4. User1 wants to cash out bonus credits
        uint256 redeemable = withdrawals.getRedeemableAmount(user1);
        assertEq(redeemable, 8e6); // $8 (10k credits at 80%)

        vm.prank(user1);
        withdrawals.redeemAll();

        // 5. Verify final state
        assertEq(usdc.balanceOf(user1), 8e6); // Got $8
        assertEq(staking.bonusCredits(user1), 0); // Bonus credits burned
        assertEq(staking.stakedBalance(user1), 100000e18); // Staked credits unchanged
        assertEq(staking.availableCredits(user1), 100000e18); // Only staked remains

        // User2 still has their bonus credits
        assertEq(staking.bonusCredits(user2), 10000e18);
    }

    // ============ Authorization Tests ============

    function test_OnlyWithdrawalContractCanRedeem() public {
        vm.prank(owner);
        staking.addBonusCredits(user1, 1000e18);

        // Random address tries to call redeemBonusCredits
        vm.prank(user1);
        vm.expectRevert(SuiteStaking.UnauthorizedWithdrawalContract.selector);
        staking.redeemBonusCredits(user1, 500e18);
    }

    function test_OnlyOwnerCanDepositToPool() public {
        usdc.mint(user1, 100e6);
        vm.prank(user1);
        usdc.approve(address(withdrawals), 100e6);

        vm.prank(user1);
        vm.expectRevert();
        withdrawals.depositToPool(100e6);
    }
}
