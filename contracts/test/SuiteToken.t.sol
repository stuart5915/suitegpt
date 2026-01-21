// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/SuiteToken.sol";

/**
 * @title SuiteTokenTest
 * @notice Foundry tests for SuiteToken
 * @dev Run with: forge test --match-contract SuiteTokenTest -vvv
 */
contract SuiteTokenTest is Test {
    SuiteToken public token;

    address public owner = address(1);
    address public minter = address(2);
    address public burner = address(3);
    address public user1 = address(4);
    address public user2 = address(5);

    function setUp() public {
        vm.prank(owner);
        token = new SuiteToken(owner);
    }

    // ============ Minter Tests ============

    function test_MintByAuthorizedMinter() public {
        // Add minter
        vm.prank(owner);
        token.addMinter(minter);

        // Mint tokens
        vm.prank(minter);
        token.mint(user1, 1000e18);

        assertEq(token.balanceOf(user1), 1000e18);
    }

    function test_MintFailsForNonMinter() public {
        // Try to mint without being a minter
        vm.prank(user1);
        vm.expectRevert("SuiteToken: caller is not a minter");
        token.mint(user2, 1000e18);
    }

    function test_OwnerCanAddMinter() public {
        assertFalse(token.minters(minter));

        vm.prank(owner);
        token.addMinter(minter);

        assertTrue(token.minters(minter));
    }

    function test_OwnerCanRemoveMinter() public {
        vm.prank(owner);
        token.addMinter(minter);
        assertTrue(token.minters(minter));

        vm.prank(owner);
        token.removeMinter(minter);
        assertFalse(token.minters(minter));
    }

    function test_NonOwnerCannotAddMinter() public {
        vm.prank(user1);
        vm.expectRevert();
        token.addMinter(minter);
    }

    function test_CannotAddZeroAddressAsMinter() public {
        vm.prank(owner);
        vm.expectRevert("SuiteToken: minter is zero address");
        token.addMinter(address(0));
    }

    function test_CannotAddExistingMinter() public {
        vm.prank(owner);
        token.addMinter(minter);

        vm.prank(owner);
        vm.expectRevert("SuiteToken: already a minter");
        token.addMinter(minter);
    }

    // ============ Transfer Tests ============

    function test_TransferWorks() public {
        // Mint to user1
        vm.prank(owner);
        token.addMinter(minter);
        vm.prank(minter);
        token.mint(user1, 1000e18);

        // Transfer from user1 to user2
        vm.prank(user1);
        token.transfer(user2, 400e18);

        assertEq(token.balanceOf(user1), 600e18);
        assertEq(token.balanceOf(user2), 400e18);
    }

    function test_ApproveAndTransferFrom() public {
        // Mint to user1
        vm.prank(owner);
        token.addMinter(minter);
        vm.prank(minter);
        token.mint(user1, 1000e18);

        // Approve user2 to spend
        vm.prank(user1);
        token.approve(user2, 500e18);

        // TransferFrom
        vm.prank(user2);
        token.transferFrom(user1, user2, 300e18);

        assertEq(token.balanceOf(user1), 700e18);
        assertEq(token.balanceOf(user2), 300e18);
    }

    // ============ Burner Tests ============

    function test_BurnByAuthorizedBurner() public {
        // Setup
        vm.prank(owner);
        token.addMinter(minter);
        vm.prank(owner);
        token.addBurner(burner);
        vm.prank(minter);
        token.mint(user1, 1000e18);

        // Authorized burner can burn without allowance
        vm.prank(burner);
        token.burnFrom(user1, 200e18);

        assertEq(token.balanceOf(user1), 800e18);
    }

    function test_BurnFromWithAllowance() public {
        // Setup
        vm.prank(owner);
        token.addMinter(minter);
        vm.prank(minter);
        token.mint(user1, 1000e18);

        // User1 approves user2
        vm.prank(user1);
        token.approve(user2, 300e18);

        // User2 burns (not a burner, uses allowance)
        vm.prank(user2);
        token.burnFrom(user1, 200e18);

        assertEq(token.balanceOf(user1), 800e18);
    }

    function test_SelfBurn() public {
        // Setup
        vm.prank(owner);
        token.addMinter(minter);
        vm.prank(minter);
        token.mint(user1, 1000e18);

        // User burns their own tokens
        vm.prank(user1);
        token.burn(300e18);

        assertEq(token.balanceOf(user1), 700e18);
    }

    function test_OwnerCanAddBurner() public {
        assertFalse(token.burners(burner));

        vm.prank(owner);
        token.addBurner(burner);

        assertTrue(token.burners(burner));
    }

    function test_OwnerCanRemoveBurner() public {
        vm.prank(owner);
        token.addBurner(burner);
        assertTrue(token.burners(burner));

        vm.prank(owner);
        token.removeBurner(burner);
        assertFalse(token.burners(burner));
    }
}
