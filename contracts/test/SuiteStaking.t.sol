// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/staking/SuiteStaking.sol";
import "../src/SuiteToken.sol";

/**
 * @title SuiteStakingTest
 * @notice Foundry tests for SuiteStaking
 * @dev Run with: forge test --match-contract SuiteStakingTest -vvv
 */

// Mock USDC for testing
contract MockUSDC {
    string public name = "USD Coin";
    string public symbol = "USDC";
    uint8 public decimals = 6;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint256 public totalSupply;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract SuiteStakingTest is Test {
    SuiteStaking public staking;
    SuiteToken public suiteToken;
    MockUSDC public usdc;

    address public owner = address(1);
    address public treasury = address(2);
    address public user1 = address(3);
    address public user2 = address(4);
    address public app1 = address(5);
    address public app2 = address(6);

    // Events (must be declared to use in expectEmit)
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 returned, uint256 burned);
    event Withdrawn(address indexed user, uint256 creditAmount, uint256 usdcAmount);
    event CreditsUsed(address indexed user, address indexed app, uint256 amount);

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

        // Add staking contract as minter (for buyAndStake)
        vm.prank(owner);
        suiteToken.addMinter(address(staking));

        // Mint SUITE to user1 for testing stake/unstake
        vm.prank(owner);
        suiteToken.addMinter(owner);
        vm.prank(owner);
        suiteToken.mint(user1, 1000e18);

        // Give user1 some USDC for buyAndStake tests
        usdc.mint(user1, 100e6); // 100 USDC
    }

    // ============ Stake Tests ============

    function test_StakeIncreasesStakedBalance() public {
        // Approve staking contract
        vm.prank(user1);
        suiteToken.approve(address(staking), 500e18);

        // Stake
        vm.prank(user1);
        staking.stake(500e18);

        assertEq(staking.stakedBalance(user1), 500e18);
    }

    function test_StakeIncreasesAvailableCredits() public {
        // Approve and stake
        vm.prank(user1);
        suiteToken.approve(address(staking), 500e18);
        vm.prank(user1);
        staking.stake(500e18);

        assertEq(staking.availableCredits(user1), 500e18);
    }

    function test_StakeTransfersTokens() public {
        uint256 balanceBefore = suiteToken.balanceOf(user1);

        vm.prank(user1);
        suiteToken.approve(address(staking), 500e18);
        vm.prank(user1);
        staking.stake(500e18);

        assertEq(suiteToken.balanceOf(user1), balanceBefore - 500e18);
        assertEq(suiteToken.balanceOf(address(staking)), 500e18);
    }

    function test_StakeZeroAmountReverts() public {
        vm.prank(user1);
        vm.expectRevert(SuiteStaking.ZeroAmount.selector);
        staking.stake(0);
    }

    function test_MultipleStakes() public {
        vm.prank(user1);
        suiteToken.approve(address(staking), 1000e18);

        vm.prank(user1);
        staking.stake(300e18);
        vm.prank(user1);
        staking.stake(200e18);

        assertEq(staking.stakedBalance(user1), 500e18);
        assertEq(staking.availableCredits(user1), 500e18);
    }

    // ============ UseCredits Tests ============

    function test_UseCreditsDecreasesAvailableCredits() public {
        // Setup: stake and authorize app
        vm.prank(user1);
        suiteToken.approve(address(staking), 500e18);
        vm.prank(user1);
        staking.stake(500e18);
        vm.prank(owner);
        staking.authorizeApp(app1);

        // Use credits
        vm.prank(app1);
        staking.useCredits(user1, 100e18);

        assertEq(staking.availableCredits(user1), 400e18);
    }

    function test_UseCreditsIncreasesUsedCredits() public {
        // Setup
        vm.prank(user1);
        suiteToken.approve(address(staking), 500e18);
        vm.prank(user1);
        staking.stake(500e18);
        vm.prank(owner);
        staking.authorizeApp(app1);

        // Use credits
        vm.prank(app1);
        staking.useCredits(user1, 100e18);

        assertEq(staking.usedCredits(user1), 100e18);
    }

    function test_UnauthorizedAppCannotUseCredits() public {
        // Setup: stake but don't authorize app
        vm.prank(user1);
        suiteToken.approve(address(staking), 500e18);
        vm.prank(user1);
        staking.stake(500e18);

        // Try to use credits from unauthorized app
        vm.prank(app1);
        vm.expectRevert(SuiteStaking.UnauthorizedApp.selector);
        staking.useCredits(user1, 100e18);
    }

    function test_CannotUseMoreCreditsThanAvailable() public {
        // Setup
        vm.prank(user1);
        suiteToken.approve(address(staking), 500e18);
        vm.prank(user1);
        staking.stake(500e18);
        vm.prank(owner);
        staking.authorizeApp(app1);

        // Try to use more credits than available
        vm.prank(app1);
        vm.expectRevert(SuiteStaking.InsufficientCredits.selector);
        staking.useCredits(user1, 600e18);
    }

    // ============ Unstake Tests ============

    function test_UnstakeWithNoUsageReturnsFullAmount() public {
        // Setup: stake
        vm.prank(user1);
        suiteToken.approve(address(staking), 500e18);
        vm.prank(user1);
        staking.stake(500e18);

        uint256 balanceBefore = suiteToken.balanceOf(user1);

        // Unstake
        vm.prank(user1);
        staking.unstake(500e18);

        assertEq(suiteToken.balanceOf(user1), balanceBefore + 500e18);
        assertEq(staking.stakedBalance(user1), 0);
    }

    function test_UnstakeWithUsageBurnsUsedAndReturnsRest() public {
        // Setup: stake 100, use 30
        vm.prank(user1);
        suiteToken.approve(address(staking), 100e18);
        vm.prank(user1);
        staking.stake(100e18);
        vm.prank(owner);
        staking.authorizeApp(app1);
        vm.prank(app1);
        staking.useCredits(user1, 30e18);

        // State: staked=100, used=30, available=70
        assertEq(staking.stakedBalance(user1), 100e18);
        assertEq(staking.usedCredits(user1), 30e18);
        assertEq(staking.availableCredits(user1), 70e18);

        uint256 balanceBefore = suiteToken.balanceOf(user1);

        // Unstake 50: should burn 30 (used) and return 20
        vm.prank(user1);
        staking.unstake(50e18);

        // User receives 20 (50 - 30 burned)
        assertEq(suiteToken.balanceOf(user1), balanceBefore + 20e18);
        // State: staked=50, used=0
        assertEq(staking.stakedBalance(user1), 50e18);
        assertEq(staking.usedCredits(user1), 0);
        assertEq(staking.availableCredits(user1), 50e18);
    }

    function test_UnstakeAllUsedCreditsFullBurn() public {
        // Setup: stake 100, use 80
        vm.prank(user1);
        suiteToken.approve(address(staking), 100e18);
        vm.prank(user1);
        staking.stake(100e18);
        vm.prank(owner);
        staking.authorizeApp(app1);
        vm.prank(app1);
        staking.useCredits(user1, 80e18);

        uint256 balanceBefore = suiteToken.balanceOf(user1);

        // Unstake 50: should burn all 50 (since used=80 > 50)
        vm.prank(user1);
        staking.unstake(50e18);

        // User receives 0 (all burned)
        assertEq(suiteToken.balanceOf(user1), balanceBefore);
        // State: staked=50, used=30 (80-50)
        assertEq(staking.stakedBalance(user1), 50e18);
        assertEq(staking.usedCredits(user1), 30e18);
        assertEq(staking.availableCredits(user1), 20e18);
    }

    function test_CannotUnstakeMoreThanStaked() public {
        vm.prank(user1);
        suiteToken.approve(address(staking), 100e18);
        vm.prank(user1);
        staking.stake(100e18);

        vm.prank(user1);
        vm.expectRevert(SuiteStaking.InsufficientStake.selector);
        staking.unstake(200e18);
    }

    function test_UnstakeZeroAmountReverts() public {
        vm.prank(user1);
        vm.expectRevert(SuiteStaking.ZeroAmount.selector);
        staking.unstake(0);
    }

    // ============ Buy Tests ============

    function test_BuySendsUsdcToTreasury() public {
        uint256 treasuryBalanceBefore = usdc.balanceOf(treasury);

        vm.prank(user1);
        usdc.approve(address(staking), 10e6); // 10 USDC
        vm.prank(user1);
        staking.buy(10e6);

        assertEq(usdc.balanceOf(treasury), treasuryBalanceBefore + 10e6);
    }

    function test_BuyMintsSuiteToWallet() public {
        uint256 balanceBefore = suiteToken.balanceOf(user1);

        vm.prank(user1);
        usdc.approve(address(staking), 10e6); // 10 USDC
        vm.prank(user1);
        staking.buy(10e6);

        // 10 USDC (10e6) * 1000 * 1e12 = 10_000e18 SUITE
        // USDC has 6 decimals, SUITE has 18 decimals
        uint256 expectedSuite = 10e6 * 1000 * 1e12; // 10,000 SUITE in 18 decimals
        assertEq(suiteToken.balanceOf(user1), balanceBefore + expectedSuite);
    }

    function test_BuyDoesNotStake() public {
        vm.prank(user1);
        usdc.approve(address(staking), 10e6);
        vm.prank(user1);
        staking.buy(10e6);

        // Should NOT be staked
        assertEq(staking.stakedBalance(user1), 0);
        assertEq(staking.availableCredits(user1), 0);
    }

    function test_BuyZeroReverts() public {
        vm.prank(user1);
        vm.expectRevert(SuiteStaking.ZeroAmount.selector);
        staking.buy(0);
    }

    // ============ BuyAndStake Tests ============

    function test_BuyAndStakeSendsUsdcToTreasury() public {
        uint256 treasuryBalanceBefore = usdc.balanceOf(treasury);

        vm.prank(user1);
        usdc.approve(address(staking), 10e6); // 10 USDC
        vm.prank(user1);
        staking.buyAndStake(10e6);

        assertEq(usdc.balanceOf(treasury), treasuryBalanceBefore + 10e6);
    }

    function test_BuyAndStakeMintsSuiteAndStakes() public {
        vm.prank(user1);
        usdc.approve(address(staking), 10e6); // 10 USDC
        vm.prank(user1);
        staking.buyAndStake(10e6);

        // 10 USDC (10e6) * 1000 * 1e12 = 10_000e18 SUITE
        // USDC has 6 decimals, SUITE has 18 decimals
        uint256 expectedSuite = 10e6 * 1000 * 1e12; // 10,000 SUITE in 18 decimals
        assertEq(staking.stakedBalance(user1), expectedSuite);
        assertEq(staking.availableCredits(user1), expectedSuite);
    }

    function test_BuyAndStakeZeroReverts() public {
        vm.prank(user1);
        vm.expectRevert(SuiteStaking.ZeroAmount.selector);
        staking.buyAndStake(0);
    }

    // ============ Admin Tests ============

    function test_AuthorizeApp() public {
        assertFalse(staking.authorizedApps(app1));

        vm.prank(owner);
        staking.authorizeApp(app1);

        assertTrue(staking.authorizedApps(app1));
    }

    function test_RevokeApp() public {
        vm.prank(owner);
        staking.authorizeApp(app1);
        assertTrue(staking.authorizedApps(app1));

        vm.prank(owner);
        staking.revokeApp(app1);

        assertFalse(staking.authorizedApps(app1));
    }

    function test_NonOwnerCannotAuthorizeApp() public {
        vm.prank(user1);
        vm.expectRevert();
        staking.authorizeApp(app1);
    }

    function test_SetTreasury() public {
        address newTreasury = address(99);

        vm.prank(owner);
        staking.setTreasury(newTreasury);

        assertEq(staking.treasury(), newTreasury);
    }

    function test_SetSuitePerUsdc() public {
        vm.prank(owner);
        staking.setSuitePerUsdc(2000);

        assertEq(staking.suitePerUsdc(), 2000);
    }

    function test_PauseAndUnpause() public {
        // Pause
        vm.prank(owner);
        staking.pause();

        // Try to stake while paused
        vm.prank(user1);
        suiteToken.approve(address(staking), 100e18);
        vm.prank(user1);
        vm.expectRevert();
        staking.stake(100e18);

        // Unpause
        vm.prank(owner);
        staking.unpause();

        // Stake should work now
        vm.prank(user1);
        staking.stake(100e18);
        assertEq(staking.stakedBalance(user1), 100e18);
    }

    // ============ Event Tests ============

    function test_StakeEmitsEvent() public {
        vm.prank(user1);
        suiteToken.approve(address(staking), 100e18);

        vm.expectEmit(true, false, false, true);
        emit Staked(user1, 100e18);

        vm.prank(user1);
        staking.stake(100e18);
    }

    function test_UnstakeEmitsEvent() public {
        vm.prank(user1);
        suiteToken.approve(address(staking), 100e18);
        vm.prank(user1);
        staking.stake(100e18);

        vm.expectEmit(true, false, false, true);
        emit Unstaked(user1, 100e18, 0);

        vm.prank(user1);
        staking.unstake(100e18);
    }

    function test_CreditsUsedEmitsEvent() public {
        vm.prank(user1);
        suiteToken.approve(address(staking), 100e18);
        vm.prank(user1);
        staking.stake(100e18);
        vm.prank(owner);
        staking.authorizeApp(app1);

        vm.expectEmit(true, true, false, true);
        emit CreditsUsed(user1, app1, 50e18);

        vm.prank(app1);
        staking.useCredits(user1, 50e18);
    }

    // ============ Withdraw Tests ============

    function test_WithdrawReturnsUsdc() public {
        // Setup: buyAndStake 10 USDC = 10,000 credits
        vm.prank(user1);
        usdc.approve(address(staking), 10e6);
        vm.prank(user1);
        staking.buyAndStake(10e6);

        // Treasury needs USDC and must approve staking contract
        usdc.mint(treasury, 100e6);
        vm.prank(treasury);
        usdc.approve(address(staking), type(uint256).max);

        uint256 usdcBalanceBefore = usdc.balanceOf(user1);
        uint256 creditsBefore = staking.availableCredits(user1);

        // Withdraw 5,000 credits = 5 USDC
        uint256 creditsToWithdraw = 5000e18;
        vm.prank(user1);
        staking.withdraw(creditsToWithdraw);

        // User should receive 5 USDC
        assertEq(usdc.balanceOf(user1), usdcBalanceBefore + 5e6);
        // Credits should decrease
        assertEq(staking.availableCredits(user1), creditsBefore - creditsToWithdraw);
        assertEq(staking.stakedBalance(user1), creditsBefore - creditsToWithdraw);
    }

    function test_WithdrawBurnsSuiteTokens() public {
        // Setup: buyAndStake 10 USDC
        vm.prank(user1);
        usdc.approve(address(staking), 10e6);
        vm.prank(user1);
        staking.buyAndStake(10e6);

        // Treasury setup
        usdc.mint(treasury, 100e6);
        vm.prank(treasury);
        usdc.approve(address(staking), type(uint256).max);

        uint256 contractBalanceBefore = suiteToken.balanceOf(address(staking));

        // Withdraw 5,000 credits
        uint256 creditsToWithdraw = 5000e18;
        vm.prank(user1);
        staking.withdraw(creditsToWithdraw);

        // SUITE tokens should be burned (contract balance decreases)
        assertEq(suiteToken.balanceOf(address(staking)), contractBalanceBefore - creditsToWithdraw);
    }

    function test_WithdrawZeroReverts() public {
        vm.prank(user1);
        vm.expectRevert(SuiteStaking.ZeroAmount.selector);
        staking.withdraw(0);
    }

    function test_WithdrawMoreThanAvailableReverts() public {
        // Setup: stake some tokens
        vm.prank(user1);
        suiteToken.approve(address(staking), 100e18);
        vm.prank(user1);
        staking.stake(100e18);

        // Try to withdraw more than available
        vm.prank(user1);
        vm.expectRevert(SuiteStaking.InsufficientCredits.selector);
        staking.withdraw(200e18);
    }

    function test_WithdrawWithUsedCreditsReverts() public {
        // Setup: stake 100, use 80 credits
        vm.prank(user1);
        suiteToken.approve(address(staking), 100e18);
        vm.prank(user1);
        staking.stake(100e18);
        vm.prank(owner);
        staking.authorizeApp(app1);
        vm.prank(app1);
        staking.useCredits(user1, 80e18);

        // Available credits = 20
        assertEq(staking.availableCredits(user1), 20e18);

        // Try to withdraw 50 (more than available 20)
        vm.prank(user1);
        vm.expectRevert(SuiteStaking.InsufficientCredits.selector);
        staking.withdraw(50e18);
    }

    function test_WithdrawEmitsEvent() public {
        // Setup: buyAndStake 10 USDC
        vm.prank(user1);
        usdc.approve(address(staking), 10e6);
        vm.prank(user1);
        staking.buyAndStake(10e6);

        // Treasury setup
        usdc.mint(treasury, 100e6);
        vm.prank(treasury);
        usdc.approve(address(staking), type(uint256).max);

        // Withdraw 5,000 credits = 5 USDC
        uint256 creditsToWithdraw = 5000e18;
        uint256 expectedUsdc = 5e6;

        vm.expectEmit(true, false, false, true);
        emit Withdrawn(user1, creditsToWithdraw, expectedUsdc);

        vm.prank(user1);
        staking.withdraw(creditsToWithdraw);
    }

    function test_WithdrawFullAmount() public {
        // Setup: buyAndStake 10 USDC = 10,000 credits
        vm.prank(user1);
        usdc.approve(address(staking), 10e6);
        vm.prank(user1);
        staking.buyAndStake(10e6);

        // Treasury setup
        usdc.mint(treasury, 100e6);
        vm.prank(treasury);
        usdc.approve(address(staking), type(uint256).max);

        uint256 fullCredits = staking.availableCredits(user1);

        // Withdraw all credits
        vm.prank(user1);
        staking.withdraw(fullCredits);

        // User should have 0 credits left
        assertEq(staking.availableCredits(user1), 0);
        assertEq(staking.stakedBalance(user1), 0);
    }
}
