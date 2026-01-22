// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/staking/SuiteStaking.sol";
import "../src/staking/UsdcWithdrawals.sol";
import "../src/SuiteToken.sol";

/**
 * @title BonusCreditsAndWithdrawalsTest
 * @notice Tests for bonus credits and USDC withdrawal system
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

contract BonusCreditsAndWithdrawalsTest is Test {
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
    event WithdrawalRequested(address indexed user, uint256 credits, uint256 usdcEquivalent);
    event WithdrawalFunded(address indexed user, uint256 usdcAmount, address indexed funder);
    event WithdrawalClaimed(address indexed user, uint256 usdcAmount);

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
        withdrawals = new UsdcWithdrawals(address(usdc), owner);

        // Setup
        vm.prank(owner);
        suiteToken.addMinter(address(staking));

        // Give users USDC
        usdc.mint(user1, 100e6);
        usdc.mint(owner, 1000e6); // For funding withdrawals
    }

    // ============ Bonus Credits Tests ============

    function test_OwnerCanAddBonusCredits() public {
        vm.prank(owner);
        staking.addBonusCredits(user1, 1000e18);

        assertEq(staking.bonusCredits(user1), 1000e18);
        assertEq(staking.availableCredits(user1), 1000e18);
    }

    function test_DistributorCanAddBonusCredits() public {
        // Add distributor
        vm.prank(owner);
        staking.addRewardDistributor(distributor);

        // Distributor adds bonus credits
        vm.prank(distributor);
        staking.addBonusCredits(user1, 500e18);

        assertEq(staking.bonusCredits(user1), 500e18);
    }

    function test_UnauthorizedCannotAddBonusCredits() public {
        vm.prank(user1);
        vm.expectRevert(SuiteStaking.UnauthorizedDistributor.selector);
        staking.addBonusCredits(user2, 100e18);
    }

    function test_BonusCreditsAddToAvailableCredits() public {
        // User stakes via buyAndStake
        vm.prank(user1);
        usdc.approve(address(staking), 10e6);
        vm.prank(user1);
        staking.buyAndStake(10e6); // 10,000 credits from staking

        // Owner adds bonus credits
        vm.prank(owner);
        staking.addBonusCredits(user1, 5000e18); // 5,000 bonus credits

        // Total should be 15,000
        assertEq(staking.availableCredits(user1), 15000e18);
        assertEq(staking.totalCredits(user1), 15000e18);
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
    }

    function test_BonusCreditsCanBeUsedByApps() public {
        // Add bonus credits
        vm.prank(owner);
        staking.addBonusCredits(user1, 1000e18);

        // Authorize an app
        address app = address(100);
        vm.prank(owner);
        staking.authorizeApp(app);

        // App uses credits
        vm.prank(app);
        staking.useCredits(user1, 300e18);

        assertEq(staking.availableCredits(user1), 700e18);
        assertEq(staking.usedCredits(user1), 300e18);
    }

    // ============ USDC Withdrawal Tests ============

    function test_UserCanRequestWithdrawal() public {
        uint256 credits = 10000e18; // 10,000 credits = $10

        vm.prank(user1);
        withdrawals.requestWithdrawal(credits);

        (uint256 pending, uint256 usdcEq) = withdrawals.getPendingWithdrawal(user1);
        assertEq(pending, credits);
        assertEq(usdcEq, 10e6); // $10 USDC
    }

    function test_OwnerCanFundWithdrawal() public {
        // User requests withdrawal
        uint256 credits = 10000e18; // $10 worth
        vm.prank(user1);
        withdrawals.requestWithdrawal(credits);

        // Owner funds it
        vm.prank(owner);
        usdc.approve(address(withdrawals), 10e6);
        vm.prank(owner);
        withdrawals.fundWithdrawal(user1, 10e6);

        // Check state
        assertEq(withdrawals.pendingWithdrawals(user1), 0);
        assertEq(withdrawals.fundedWithdrawals(user1), 10e6);
    }

    function test_UserCanClaimFundedUsdc() public {
        // Request
        vm.prank(user1);
        withdrawals.requestWithdrawal(10000e18);

        // Fund
        vm.prank(owner);
        usdc.approve(address(withdrawals), 10e6);
        vm.prank(owner);
        withdrawals.fundWithdrawal(user1, 10e6);

        // Claim
        uint256 balanceBefore = usdc.balanceOf(user1);
        vm.prank(user1);
        withdrawals.claimUsdc();

        assertEq(usdc.balanceOf(user1), balanceBefore + 10e6);
        assertEq(withdrawals.fundedWithdrawals(user1), 0);
    }

    function test_UserCanCancelWithdrawal() public {
        vm.prank(user1);
        withdrawals.requestWithdrawal(10000e18);

        vm.prank(user1);
        withdrawals.cancelWithdrawal();

        assertEq(withdrawals.pendingWithdrawals(user1), 0);
    }

    function test_PartialFunding() public {
        // Request $10 worth
        vm.prank(user1);
        withdrawals.requestWithdrawal(10000e18);

        // Fund only $5
        vm.prank(owner);
        usdc.approve(address(withdrawals), 5e6);
        vm.prank(owner);
        withdrawals.fundWithdrawal(user1, 5e6);

        // $5 funded, $5 still pending
        assertEq(withdrawals.fundedWithdrawals(user1), 5e6);
        assertEq(withdrawals.pendingWithdrawals(user1), 5000e18);
    }

    function test_BatchFunding() public {
        // Two users request
        vm.prank(user1);
        withdrawals.requestWithdrawal(10000e18); // $10
        vm.prank(user2);
        withdrawals.requestWithdrawal(20000e18); // $20

        // Batch fund
        address[] memory users = new address[](2);
        users[0] = user1;
        users[1] = user2;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 10e6;
        amounts[1] = 20e6;

        vm.prank(owner);
        usdc.approve(address(withdrawals), 30e6);
        vm.prank(owner);
        withdrawals.fundWithdrawalsBatch(users, amounts);

        assertEq(withdrawals.fundedWithdrawals(user1), 10e6);
        assertEq(withdrawals.fundedWithdrawals(user2), 20e6);
    }

    function test_CannotClaimWithoutFunding() public {
        vm.prank(user1);
        vm.expectRevert(UsdcWithdrawals.NoFundedWithdrawal.selector);
        withdrawals.claimUsdc();
    }

    function test_CreditsToUsdcConversion() public view {
        // 1000 credits (18 decimals) = $0.001 = 1000 USDC units (but USDC is 6 decimals)
        // Actually: 1000e18 credits / 1000 / 1e12 = 1e6 = $1 USDC
        // So 1000 credits = $1

        assertEq(withdrawals.creditsToUsdc(1000e18), 1e6);   // 1000 credits = $1
        assertEq(withdrawals.creditsToUsdc(10000e18), 10e6); // 10,000 credits = $10
        assertEq(withdrawals.creditsToUsdc(1e18), 1e3);      // 1 credit = $0.001
    }

    function test_UsdcToCreditsConversion() public view {
        assertEq(withdrawals.usdcToCredits(1e6), 1000e18);   // $1 = 1000 credits
        assertEq(withdrawals.usdcToCredits(10e6), 10000e18); // $10 = 10,000 credits
    }

    // ============ Integration Test ============

    function test_FullRewardsFlow() public {
        // 1. User buys and stakes
        vm.prank(user1);
        usdc.approve(address(staking), 10e6);
        vm.prank(user1);
        staking.buyAndStake(10e6); // 10,000 credits

        // 2. Owner adds bonus credits as rewards
        vm.prank(owner);
        staking.addBonusCredits(user1, 500e18); // +500 bonus credits

        // User now has 10,500 credits
        assertEq(staking.availableCredits(user1), 10500e18);

        // 3. User wants to withdraw bonus as USDC
        // (In real app, frontend would reduce bonusCredits first)
        vm.prank(user1);
        withdrawals.requestWithdrawal(500e18); // Request $0.50

        // 4. Owner sees request and funds it
        vm.prank(owner);
        usdc.approve(address(withdrawals), 1e6);
        vm.prank(owner);
        withdrawals.fundWithdrawal(user1, 500e3); // Fund $0.50 (500000 = 0.5 USDC)

        // 5. User claims USDC
        uint256 balanceBefore = usdc.balanceOf(user1);
        vm.prank(user1);
        withdrawals.claimUsdc();

        assertEq(usdc.balanceOf(user1), balanceBefore + 500e3);
    }
}
