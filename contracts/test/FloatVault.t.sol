// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/FloatVault.sol";
import "../src/strategies/IdleStrategy.sol";
import "../src/strategies/MockYieldStrategy.sol";
import "./mocks/MockUSDC.sol";

contract FloatVaultTest is Test {
    FloatVault public vault;
    MockUSDC public usdc;
    
    IdleStrategy public idleStrategy;
    MockYieldStrategy public yieldStrategy;
    
    address public owner = address(1);
    address public promoter = address(2);
    address public user = address(3);

    function setUp() public {
        vm.startPrank(owner);
        usdc = new MockUSDC();
        vault = new FloatVault(address(usdc));
        
        idleStrategy = new IdleStrategy(address(usdc), address(vault));
        yieldStrategy = new MockYieldStrategy(address(usdc), address(vault), 1000); // 1000 = 0.1% per block
        
        vault.setPromoter(promoter);
        vm.stopPrank();
        
        // Mint tokens to user
        usdc.mint(user, 1000 * 10**6);
    }

    function test_RegisterStrategy() public {
        vm.startPrank(owner);
        uint256 id1 = vault.registerStrategy(address(idleStrategy), false); // active
        uint256 id2 = vault.registerStrategy(address(yieldStrategy), true);  // shadow
        vm.stopPrank();

        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(vault.activeStrategyId(), 1);
        
        (address stratAddr1, bool active1, bool shadow1, , , ) = vault.strategies(1);
        assertEq(stratAddr1, address(idleStrategy));
        assertTrue(active1);
        assertFalse(shadow1);

        (address stratAddr2, bool active2, bool shadow2, , , ) = vault.strategies(2);
        assertEq(stratAddr2, address(yieldStrategy));
        assertFalse(active2);
        assertTrue(shadow2);
    }

    function test_ParkAndWithdraw() public {
        vm.startPrank(owner);
        vault.registerStrategy(address(idleStrategy), false);
        vm.stopPrank();

        vm.startPrank(user);
        usdc.approve(address(vault), 500 * 10**6);
        vault.park(500 * 10**6);
        
        assertEq(vault.deposits(user), 500 * 10**6);
        assertEq(vault.totalDeposits(), 500 * 10**6);
        // Verify USDC was routed to the idle strategy
        assertEq(usdc.balanceOf(address(idleStrategy)), 500 * 10**6);
        assertEq(idleStrategy.currentValue(), 500 * 10**6);

        // Withdraw half
        vault.withdraw(200 * 10**6);
        assertEq(vault.deposits(user), 300 * 10**6);
        assertEq(usdc.balanceOf(address(idleStrategy)), 300 * 10**6);
        assertEq(usdc.balanceOf(user), 700 * 10**6);
        vm.stopPrank();
    }

    function test_Revert_DirectStrategyWithdraw() public {
        // Fund the active strategy via the vault
        vm.startPrank(owner);
        vault.registerStrategy(address(idleStrategy), false);
        vm.stopPrank();

        vm.startPrank(user);
        usdc.approve(address(vault), 500 * 10**6);
        vault.park(500 * 10**6);
        vm.stopPrank();

        // An attacker must NOT be able to drain the strategy directly, bypassing the vault.
        address attacker = address(0xBAD);
        vm.prank(attacker);
        vm.expectRevert(bytes("Only vault"));
        idleStrategy.withdraw(500 * 10**6);

        // Direct deposit is also gated.
        vm.prank(attacker);
        vm.expectRevert(bytes("Only vault"));
        idleStrategy.deposit(1);

        // Funds remain intact in the strategy.
        assertEq(usdc.balanceOf(address(idleStrategy)), 500 * 10**6);
    }

    function test_PostScore() public {
        vm.startPrank(owner);
        vault.registerStrategy(address(idleStrategy), false);
        vm.stopPrank();

        vm.prank(promoter);
        vault.postScore(1, 100);

        (, , , , uint256 lastScore, uint256 lastScoreAt) = vault.strategies(1);
        assertEq(lastScore, 100);
        assertEq(lastScoreAt, block.number);
    }

    function test_Promote() public {
        vm.startPrank(owner);
        vault.registerStrategy(address(idleStrategy), false); // Active (id = 1)
        vault.registerStrategy(address(yieldStrategy), true);  // Shadow (id = 2)
        vm.stopPrank();

        // User parks some funds
        vm.startPrank(user);
        usdc.approve(address(vault), 100 * 10**6);
        vault.park(100 * 10**6);
        vm.stopPrank();

        assertEq(usdc.balanceOf(address(idleStrategy)), 100 * 10**6);
        assertEq(usdc.balanceOf(address(yieldStrategy)), 0);

        // Promote id = 2
        vm.prank(promoter);
        vault.promote(2);

        // Verify active strategy changed
        assertEq(vault.activeStrategyId(), 2);
        
        // Verify old strategy is deactivated
        (, bool active1, bool shadow1, , , ) = vault.strategies(1);
        assertFalse(active1);
        assertTrue(shadow1);

        // Verify new strategy is activated
        (, bool active2, bool shadow2, , , ) = vault.strategies(2);
        assertTrue(active2);
        assertFalse(shadow2);

        // Verify funds migrated from idleStrategy to yieldStrategy
        assertEq(usdc.balanceOf(address(idleStrategy)), 0);
        assertEq(usdc.balanceOf(address(yieldStrategy)), 100 * 10**6);
    }

    function test_Revert_NonPromoterPromote() public {
        vm.startPrank(owner);
        vault.registerStrategy(address(idleStrategy), false);
        vault.registerStrategy(address(yieldStrategy), true);
        vm.stopPrank();

        vm.prank(user);
        vm.expectRevert("Not eligible and not promoter/owner");
        vault.promote(2);
    }

    function test_DecentralizedPromotion_Success() public {
        vm.startPrank(owner);
        vault.registerStrategy(address(idleStrategy), false); // Active (id = 1)
        vault.registerStrategy(address(yieldStrategy), true);  // Shadow (id = 2)
        vm.stopPrank();

        // User parks some funds
        vm.startPrank(user);
        usdc.approve(address(vault), 100 * 10**6);
        vault.park(100 * 10**6);
        vm.stopPrank();

        // Simulate 5 consecutive wins for yieldStrategy (id = 2)
        // Score threshold delta: minDeltaBps = 10
        // active score = 100, shadow score = 115 (delta = 15 bps >= 10)
        for (uint256 i = 0; i < 5; i++) {
            vm.roll(block.number + 1);
            vm.startPrank(promoter);
            vault.postScore(1, 100);
            vault.postScore(2, 115);
            vm.stopPrank();
        }

        // Verify consecutive wins is 5
        assertEq(vault.consecutiveWins(2), 5);

        // Now, anyone (user) can call promote(2)
        vm.prank(user);
        vault.promote(2);

        // Verify active strategy is now 2, and consecutiveWins has been reset to 0
        assertEq(vault.activeStrategyId(), 2);
        assertEq(vault.consecutiveWins(2), 0);
    }

    function test_DecentralizedPromotion_WinsResetOnLoss() public {
        vm.startPrank(owner);
        vault.registerStrategy(address(idleStrategy), false); // Active (id = 1)
        vault.registerStrategy(address(yieldStrategy), true);  // Shadow (id = 2)
        vm.stopPrank();

        // Simulate 3 wins
        for (uint256 i = 0; i < 3; i++) {
            vm.roll(block.number + 1);
            vm.startPrank(promoter);
            vault.postScore(1, 100);
            vault.postScore(2, 115);
            vm.stopPrank();
        }
        assertEq(vault.consecutiveWins(2), 3);

        // Simulate a loss (shadow score = 105, delta = 5 bps < 10)
        vm.roll(block.number + 1);
        vm.startPrank(promoter);
        vault.postScore(1, 100);
        vault.postScore(2, 105);
        vm.stopPrank();

        assertEq(vault.consecutiveWins(2), 0);
    }
}

