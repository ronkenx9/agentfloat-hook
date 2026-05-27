// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Deployers} from "v4-core/test/utils/Deployers.sol";
import {AgentFloatHook} from "../src/AgentFloatHook.sol";
import {FloatVault} from "../src/FloatVault.sol";
import {IdleStrategy} from "../src/strategies/IdleStrategy.sol";
import {MockYieldStrategy} from "../src/strategies/MockYieldStrategy.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId} from "v4-core/src/types/PoolId.sol";
import {ModifyLiquidityParams} from "v4-core/src/types/PoolOperation.sol";
import {Currency, CurrencyLibrary} from "v4-core/src/types/Currency.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";

contract AgentFloatHookTest is Test, Deployers {
    using StateLibrary for IPoolManager;

    MockUSDC public mockUsdc;
    FloatVault public vault;
    IdleStrategy public idleStrategy;
    AgentFloatHook public hook;

    function setUp() public {
        // 1. Setup pool manager and routers
        deployFreshManagerAndRouters();

        // 2. Deploy Mock USDC and FloatVault
        mockUsdc = new MockUSDC();
        vault = new FloatVault(address(mockUsdc));

        // 3. Deploy IdleStrategy and register it in the Vault
        idleStrategy = new IdleStrategy(address(mockUsdc));
        vault.registerStrategy(address(idleStrategy), false); // Active strategy

        // 4. Determine target address with correct permission flags encoded in low 14 bits
        //    afterAddLiquidity, afterRemoveLiquidity, beforeSwap
        address targetHookAddress = address(
            uint160(
                Hooks.AFTER_ADD_LIQUIDITY_FLAG
                    | Hooks.AFTER_REMOVE_LIQUIDITY_FLAG
                    | Hooks.BEFORE_SWAP_FLAG
            )
        );

        // 5. Deploy AgentFloatHook directly at targetHookAddress so that BaseHook's
        //    validateHookAddress(this) check sees the correct permission bits.
        deployCodeTo("AgentFloatHook.sol:AgentFloatHook", abi.encode(manager, vault), targetHookAddress);
        hook = AgentFloatHook(targetHookAddress);

        // 7. Deploy another Mock ERC20 token for the pool
        MockUSDC mockTokenB = new MockUSDC();

        // 8. Sort tokens to match Uniswap v4 expectations
        if (address(mockUsdc) < address(mockTokenB)) {
            currency0 = Currency.wrap(address(mockUsdc));
            currency1 = Currency.wrap(address(mockTokenB));
        } else {
            currency0 = Currency.wrap(address(mockTokenB));
            currency1 = Currency.wrap(address(mockUsdc));
        }

        // Mint tokens to this test contract for liquidity adding
        mockUsdc.mint(address(this), 10_000_000_000 * 10**18);
        mockTokenB.mint(address(this), 10_000_000_000 * 10**18);

        // Approve routers to spend our tokens
        mockUsdc.approve(address(modifyLiquidityRouter), type(uint256).max);
        mockTokenB.approve(address(modifyLiquidityRouter), type(uint256).max);
        mockUsdc.approve(address(swapRouter), type(uint256).max);
        mockTokenB.approve(address(swapRouter), type(uint256).max);

        // 9. Initialize the pool at SQRT_PRICE_1_1 (tick 0)
        (key, ) = initPool(currency0, currency1, IHooks(address(hook)), 3000, SQRT_PRICE_1_1);
    }

    function test_Integration_Workflow() public {
        // A. Add in-range liquidity to seed the pool for swaps (tick range covers current tick 0)
        modifyLiquidityRouter.modifyLiquidity(
            key,
            ModifyLiquidityParams({
                tickLower: -120,
                tickUpper: 120,
                liquidityDelta: 10 ether,
                salt: 0
            }),
            ZERO_BYTES
        );

        // Verify that the vault has no deposits yet, since the added liquidity was in-range
        assertEq(vault.deposits(address(hook)), 0);

        // B. Add out-of-range liquidity
        // Tick 0 is current price. Out-of-range is tick 120 to 240.
        // We approve the hook to pull our USDC for parking
        uint256 idleAmount = 500 * 10**6; // 500 USDC
        // Mint USDC to the router and approve the hook
        mockUsdc.mint(address(modifyLiquidityRouter), idleAmount);
        vm.prank(address(modifyLiquidityRouter));
        mockUsdc.approve(address(hook), type(uint256).max);

        modifyLiquidityRouter.modifyLiquidity(
            key,
            ModifyLiquidityParams({
                tickLower: 120,
                tickUpper: 240,
                liquidityDelta: 5 ether,
                salt: 0
            }),
            abi.encode(idleAmount)
        );

        // Verify that the hook transferred the USDC to the vault and deposited it
        assertEq(vault.deposits(address(hook)), idleAmount);
        assertEq(mockUsdc.balanceOf(address(idleStrategy)), idleAmount);

        // C. Execute a swap to bring range back / trigger recall (the hook recalls on any swap in this stubbed implementation)
        // We perform a swap from tokenB to USDC (or vice versa depending on sorting)
        bool zeroForOne = Currency.unwrap(key.currency0) != address(mockUsdc);
        
        uint256 beforeHookBalance = mockUsdc.balanceOf(address(hook));
        
        // Execute the swap
        swap(key, zeroForOne, -1000, abi.encode(idleAmount));

        // D. Assert recall: hook should have withdrawn the recall amount from the vault
        assertEq(vault.deposits(address(hook)), 0);
        assertEq(mockUsdc.balanceOf(address(hook)), beforeHookBalance + idleAmount);
    }
}
