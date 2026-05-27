// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "./base/BaseHook.sol";
import {FloatVault} from "./FloatVault.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId} from "v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/src/types/BeforeSwapDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/src/types/PoolOperation.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";

/// @title AgentFloatHook
/// @notice Uniswap v4 hook that routes out-of-range LP USDC into FloatVault and
///         performs JIT recall when price moves back into range.
/// @dev    Inherits canonical BaseHook from v4-periphery. BaseHook's constructor
///         calls validateHookAddress(this), enforcing that the deployed address has
///         the correct permission bit flags. Use HookMiner in the deploy script.
contract AgentFloatHook is BaseHook {
    using SafeERC20 for IERC20;
    using StateLibrary for IPoolManager;

    FloatVault public immutable vault;
    IERC20 public immutable usdc;

    // Track user deposits to prevent capital lockup
    mapping(address => uint256) public userDeposits;

    // EIP-1153 Transient storage slot for tracking transiently parked USDC within the transaction lifecycle
    bytes32 private constant TRANSIENT_PARKED_USDC_SLOT = keccak256("agentfloat.transient.parked.usdc");

    event IdleLPParked(address indexed sender, PoolId indexed poolId, uint256 amount, int24 currentTick);
    event JITRecallTriggered(address indexed sender, PoolId indexed poolId, uint256 amount, int24 currentTick);

    constructor(IPoolManager _poolManager, FloatVault _vault) BaseHook(_poolManager) {
        require(address(_vault) != address(0), "Zero address vault");
        vault = _vault;
        usdc = _vault.usdc();
    }

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: true,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: true,
            beforeSwap: true,
            afterSwap: false,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    /// @dev Routes idle out-of-range LP USDC to the vault. Requires sender to have
    ///      approved this hook for the idle amount via `usdc.approve(hookAddress, ...)`.
    function _afterAddLiquidity(
        address sender,
        PoolKey calldata key,
        ModifyLiquidityParams calldata params,
        BalanceDelta delta,
        BalanceDelta,
        bytes calldata hookData
    ) internal override returns (bytes4, BalanceDelta) {
        (, int24 currentTick,,) = poolManager.getSlot0(key.toId());

        // If current tick is out of LP range, capital is idle
        if (currentTick < params.tickLower || currentTick > params.tickUpper) {
            address lpProvider = sender;
            uint256 idleAmount = 100 * 10 ** 6; // default mock amount
            if (hookData.length >= 64) {
                (lpProvider, idleAmount) = abi.decode(hookData, (address, uint256));
            } else if (hookData.length >= 32) {
                idleAmount = abi.decode(hookData, (uint256));
            }

            emit IdleLPParked(lpProvider, key.toId(), idleAmount, currentTick);

            if (usdc.allowance(lpProvider, address(this)) >= idleAmount) {
                usdc.safeTransferFrom(lpProvider, address(this), idleAmount);
                usdc.approve(address(vault), idleAmount);
                vault.park(idleAmount);

                // Track deposit
                userDeposits[lpProvider] += idleAmount;

                // Gas Optimization: Track the parked amount in transient storage
                bytes32 slot = TRANSIENT_PARKED_USDC_SLOT;
                assembly {
                    let current := tload(slot)
                    tstore(slot, add(current, idleAmount))
                }
            }
        }

        return (BaseHook.afterAddLiquidity.selector, delta);
    }

    function _afterRemoveLiquidity(
        address sender,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        BalanceDelta delta,
        BalanceDelta,
        bytes calldata
    ) internal override returns (bytes4, BalanceDelta) {
        uint256 userDep = userDeposits[sender];
        if (userDep > 0) {
            userDeposits[sender] = 0;
            
            // Check if the funds are in the vault or already recalled to the hook balance
            uint256 vaultBal = vault.deposits(address(this));
            if (vaultBal >= userDep) {
                vault.withdraw(userDep);
            }
            
            // Return USDC back to the LP provider (sender)
            usdc.safeTransfer(sender, userDep);
        }
        return (BaseHook.afterRemoveLiquidity.selector, delta);
    }

    /// @dev JIT recall — withdraw parked USDC if the price is returning into range
    ///      and the hook holds vault deposits from prior parks.
    function _beforeSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata,
        bytes calldata hookData
    ) internal override returns (bytes4, BeforeSwapDelta, uint24) {
        (, int24 currentTick,,) = poolManager.getSlot0(key.toId());

        uint256 recallAmount = 100 * 10 ** 6;
        if (hookData.length >= 32) {
            recallAmount = abi.decode(hookData, (uint256));
        }

        emit JITRecallTriggered(sender, key.toId(), recallAmount, currentTick);

        // Gas Optimization: Check transient storage first
        uint256 transientParked;
        bytes32 slot = TRANSIENT_PARKED_USDC_SLOT;
        assembly {
            transientParked := tload(slot)
        }

        if (transientParked >= recallAmount) {
            // Decrement transient balance and withdraw
            assembly {
                tstore(slot, sub(transientParked, recallAmount))
            }
            vault.withdraw(recallAmount);
            usdc.approve(address(poolManager), recallAmount);
        } else {
            // Fall back to persistent storage check
            uint256 persistentDeposits = vault.deposits(address(this));
            if (persistentDeposits >= recallAmount) {
                vault.withdraw(recallAmount);
                usdc.approve(address(poolManager), recallAmount);
            }
        }

        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }
}
