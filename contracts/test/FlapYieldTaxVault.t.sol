// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {FlapYieldTaxVault} from "../src/flap/FlapYieldTaxVault.sol";
import {FlapYieldTaxVaultFactory} from "../src/flap/FlapYieldTaxVaultFactory.sol";
import {FloatVault} from "../src/FloatVault.sol";
import {IdleStrategy} from "../src/strategies/IdleStrategy.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract FlapYieldTaxVaultTest is Test {
    MockUSDC public mockUsdc;
    FloatVault public floatVault;
    IdleStrategy public idle;
    FlapYieldTaxVaultFactory public factory;
    
    address public taxToken = address(0x1111);
    address public creator = address(0x2222);
    address public guardian = address(0x3333);

    function setUp() public {
        mockUsdc = new MockUSDC();
        floatVault = new FloatVault(address(mockUsdc));
        
        idle = new IdleStrategy(address(mockUsdc), address(floatVault));
        floatVault.registerStrategy(address(idle), false); // Register idle as active (ID 1)
        
        factory = new FlapYieldTaxVaultFactory(address(floatVault), guardian);
    }

    function test_CreateVault() public {
        address quoteToken = address(mockUsdc);
        
        address vaultAddr = factory.newVault(taxToken, quoteToken, creator, "");
        FlapYieldTaxVault vault = FlapYieldTaxVault(payable(vaultAddr));
        
        assertEq(vault.taxToken(), taxToken);
        assertEq(vault.quoteToken(), quoteToken);
        assertEq(vault.creator(), creator);
        assertEq(address(vault.floatVault()), address(floatVault));
        assertEq(vault.guardian(), guardian);
    }

    function test_DepositAndParkTaxes() public {
        address quoteToken = address(mockUsdc);
        address vaultAddr = factory.newVault(taxToken, quoteToken, creator, "");
        FlapYieldTaxVault vault = FlapYieldTaxVault(payable(vaultAddr));

        uint256 taxAmount = 1000 * 10 ** 6; // 1000 USDC
        mockUsdc.mint(address(this), taxAmount);

        // 1. Direct transfer of taxes to the vault (simulating Flap contract fee liquidation)
        mockUsdc.transfer(address(vault), taxAmount);
        
        assertEq(mockUsdc.balanceOf(address(vault)), taxAmount);
        assertEq(floatVault.deposits(address(vault)), 0);

        // 2. Call parkTaxes to sweep and deposit to FloatVault
        vault.parkTaxes();

        // 3. Verify that the taxes have been swept to FloatVault
        assertEq(mockUsdc.balanceOf(address(vault)), 0);
        assertEq(floatVault.deposits(address(vault)), taxAmount);
        assertEq(mockUsdc.balanceOf(address(idle)), taxAmount);
    }

    function test_WithdrawTaxes() public {
        address quoteToken = address(mockUsdc);
        address vaultAddr = factory.newVault(taxToken, quoteToken, creator, "");
        FlapYieldTaxVault vault = FlapYieldTaxVault(payable(vaultAddr));

        uint256 taxAmount = 1000 * 10 ** 6;
        mockUsdc.mint(address(this), taxAmount);
        mockUsdc.transfer(address(vault), taxAmount);

        // Sweeps automatically on withdraw
        vm.prank(creator);
        vault.withdrawTaxes(taxAmount);

        // Verify balance was transferred to creator
        assertEq(mockUsdc.balanceOf(creator), taxAmount);
        assertEq(floatVault.deposits(address(vault)), 0);
    }

    function test_Revert_UnauthorizedWithdraw() public {
        address quoteToken = address(mockUsdc);
        address vaultAddr = factory.newVault(taxToken, quoteToken, creator, "");
        FlapYieldTaxVault vault = FlapYieldTaxVault(payable(vaultAddr));

        uint256 taxAmount = 1000 * 10 ** 6;
        mockUsdc.mint(address(this), taxAmount);
        mockUsdc.transfer(address(vault), taxAmount);

        // Expect revert if unauthorized EOA calls withdraw
        vm.expectRevert();
        vm.prank(address(0x9999));
        vault.withdrawTaxes(taxAmount);
    }
}
