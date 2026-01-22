// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/staking/StakingRewards.sol";
import "../src/staking/SuiteStaking.sol";
import "../src/SuiteToken.sol";

/**
 * @title StakingRewardsTest
 * @notice Tests for StakingRewards contract
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

contract StakingRewardsTest is Test {
    StakingRewards public rewards;
    SuiteStaking public staking;
    SuiteToken public suiteToken;
    MockUSDC public usdc;

    address public owner = address(1);
    address public treasury = address(2);
    address public user1 = address(3);
    address public user2 = address(4);
    address public rewardDepositor = address(5);

    event RewardAdded(uint256 reward, address indexed depositor);
    event RewardPaid(address indexed user, uint256 reward);

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

        // Deploy StakingRewards
        vm.prank(owner);
        rewards = new StakingRewards(
            address(suiteToken),
            address(staking),
            owner
        );

        // Setup minters
        vm.prank(owner);
        suiteToken.addMinter(address(staking));
        vm.prank(owner);
        suiteToken.addMinter(owner);

        // Give users USDC to buy/stake
        usdc.mint(user1, 100e6);
        usdc.mint(user2, 100e6);

        // Give reward depositor some SUITE for rewards
        vm.prank(owner);
        suiteToken.mint(rewardDepositor, 100_000e18);
    }

    // ============ Basic Tests ============

    function test_DeploymentState() public view {
        assertEq(address(rewards.rewardToken()), address(suiteToken));
        assertEq(rewards.stakingContract(), address(staking));
        assertEq(rewards.rewardsDuration(), 7 days);
    }

    function test_TotalStakedReadsFromStakingContract() public {
        // User stakes via SuiteStaking
        vm.prank(user1);
        usdc.approve(address(staking), 10e6);
        vm.prank(user1);
        staking.buyAndStake(10e6);

        // StakingRewards should see the staked balance
        uint256 expectedStake = 10e6 * 1000 * 1e12; // 10M SUITE
        assertEq(rewards.totalStaked(), expectedStake);
    }

    function test_StakedBalanceReadsFromStakingContract() public {
        vm.prank(user1);
        usdc.approve(address(staking), 10e6);
        vm.prank(user1);
        staking.buyAndStake(10e6);

        uint256 expectedStake = 10e6 * 1000 * 1e12;
        assertEq(rewards.stakedBalance(user1), expectedStake);
        assertEq(rewards.stakedBalance(user2), 0);
    }

    // ============ Reward Distribution Tests ============

    function test_DepositRewardsStartsRewardPeriod() public {
        // Deposit rewards
        vm.prank(rewardDepositor);
        suiteToken.approve(address(rewards), 7000e18);
        vm.prank(rewardDepositor);
        rewards.depositRewards(7000e18);

        // Check reward rate (7000 over 7 days = 1000/day ≈ 0.0115/sec)
        assertGt(rewards.rewardRate(), 0);
        assertEq(rewards.periodFinish(), block.timestamp + 7 days);
    }

    function test_EarnedCalculatesCorrectly() public {
        // User1 stakes
        vm.prank(user1);
        usdc.approve(address(staking), 10e6);
        vm.prank(user1);
        staking.buyAndStake(10e6);

        // Deposit rewards
        vm.prank(rewardDepositor);
        suiteToken.approve(address(rewards), 7000e18);
        vm.prank(rewardDepositor);
        rewards.depositRewards(7000e18);

        // Fast forward 1 day
        vm.warp(block.timestamp + 1 days);

        // User1 should have earned ~1000 SUITE (1/7 of rewards)
        uint256 earnedAmount = rewards.earned(user1);
        assertApproxEqRel(earnedAmount, 1000e18, 0.01e18); // 1% tolerance
    }

    function test_TwoUsersShareRewardsProportionally() public {
        // User1 stakes 10 USDC
        vm.prank(user1);
        usdc.approve(address(staking), 10e6);
        vm.prank(user1);
        staking.buyAndStake(10e6);

        // User2 stakes 30 USDC (3x more)
        vm.prank(user2);
        usdc.approve(address(staking), 30e6);
        vm.prank(user2);
        staking.buyAndStake(30e6);

        // Deposit rewards
        vm.prank(rewardDepositor);
        suiteToken.approve(address(rewards), 7000e18);
        vm.prank(rewardDepositor);
        rewards.depositRewards(7000e18);

        // Fast forward full period
        vm.warp(block.timestamp + 7 days);

        // User1 should get 25%, User2 should get 75%
        uint256 earned1 = rewards.earned(user1);
        uint256 earned2 = rewards.earned(user2);

        assertApproxEqRel(earned1, 1750e18, 0.01e18); // 25% of 7000
        assertApproxEqRel(earned2, 5250e18, 0.01e18); // 75% of 7000
    }

    function test_ClaimReward() public {
        // User1 stakes
        vm.prank(user1);
        usdc.approve(address(staking), 10e6);
        vm.prank(user1);
        staking.buyAndStake(10e6);

        // Deposit rewards
        vm.prank(rewardDepositor);
        suiteToken.approve(address(rewards), 7000e18);
        vm.prank(rewardDepositor);
        rewards.depositRewards(7000e18);

        // Fast forward
        vm.warp(block.timestamp + 7 days);

        uint256 balanceBefore = suiteToken.balanceOf(user1);
        uint256 pendingReward = rewards.earned(user1);

        // Claim
        vm.prank(user1);
        rewards.claimReward();

        // Check balance increased
        assertEq(suiteToken.balanceOf(user1), balanceBefore + pendingReward);
        assertEq(rewards.earned(user1), 0);
    }

    function test_AnyoneCanDepositRewards() public {
        // Random address deposits rewards
        address randomDepositor = address(99);
        vm.prank(owner);
        suiteToken.mint(randomDepositor, 1000e18);

        vm.prank(randomDepositor);
        suiteToken.approve(address(rewards), 1000e18);

        vm.expectEmit(true, true, false, true);
        emit RewardAdded(1000e18, randomDepositor);

        vm.prank(randomDepositor);
        rewards.depositRewards(1000e18);

        assertGt(rewards.rewardRate(), 0);
    }

    function test_AddingRewardsExtendsAndIncreasesRate() public {
        // First deposit
        vm.prank(rewardDepositor);
        suiteToken.approve(address(rewards), 14000e18);
        vm.prank(rewardDepositor);
        rewards.depositRewards(7000e18);

        uint256 initialRate = rewards.rewardRate();

        // Fast forward 3.5 days (half period)
        vm.warp(block.timestamp + 3.5 days);

        // Second deposit
        vm.prank(rewardDepositor);
        rewards.depositRewards(7000e18);

        // Rate should be higher (remaining + new over 7 days)
        assertGt(rewards.rewardRate(), initialRate);
    }

    // ============ Admin Tests ============

    function test_SetRewardsDuration() public {
        vm.prank(owner);
        rewards.setRewardsDuration(14 days);
        assertEq(rewards.rewardsDuration(), 14 days);
    }

    function test_CannotSetDurationDuringActivePeriod() public {
        // Start reward period
        vm.prank(rewardDepositor);
        suiteToken.approve(address(rewards), 1000e18);
        vm.prank(rewardDepositor);
        rewards.depositRewards(1000e18);

        // Try to change duration
        vm.prank(owner);
        vm.expectRevert(StakingRewards.RewardPeriodNotFinished.selector);
        rewards.setRewardsDuration(14 days);
    }

    function test_SetStakingContract() public {
        address newStaking = address(99);
        vm.prank(owner);
        rewards.setStakingContract(newStaking);
        assertEq(rewards.stakingContract(), newStaking);
    }

    // ============ Edge Cases ============

    function test_NoRewardsWhenNoStakers() public {
        // Deposit rewards with no stakers
        vm.prank(rewardDepositor);
        suiteToken.approve(address(rewards), 1000e18);
        vm.prank(rewardDepositor);
        rewards.depositRewards(1000e18);

        // Fast forward
        vm.warp(block.timestamp + 7 days);

        // No one earned anything
        assertEq(rewards.earned(user1), 0);
    }

    function test_ClaimZeroRewardsNoOp() public {
        uint256 balanceBefore = suiteToken.balanceOf(user1);

        vm.prank(user1);
        rewards.claimReward();

        assertEq(suiteToken.balanceOf(user1), balanceBefore);
    }

    function test_DepositZeroReverts() public {
        vm.prank(rewardDepositor);
        vm.expectRevert(StakingRewards.ZeroAmount.selector);
        rewards.depositRewards(0);
    }
}
