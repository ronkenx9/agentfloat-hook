// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "./base/BaseHook.sol";
import {FloatVault} from "./FloatVault.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId} from "v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary, toBeforeSwapDelta} from "v4-core/src/types/BeforeSwapDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/src/types/PoolOperation.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";
import {CurrencySettler} from "v4-core/test/utils/CurrencySettler.sol";
import {FullMath} from "v4-core/src/libraries/FullMath.sol";

/// @notice Optional router interface — adapted from the uniswap-v4-hooks
///         security skill (igoryuzo). Routers that implement msgSender() can be
///         allowlisted so the hook resolves the *real* LP instead of decoding
///         it from untrusted hookData.
interface IMsgSender {
    function msgSender() external view returns (address);
}

/// @title AgentFloatHookV2 — settlement-enabled JIT recall
/// @notice Adds a real `BeforeSwapDelta` settlement leg on top of V1's park/recall.
///         Permission bits = afterAddLiquidity + afterRemoveLiquidity + beforeSwap
///         + **beforeSwapReturnDelta** = 0x588. Deploy via CREATE2 salt mining.
///
/// AUDIT STATUS: PENDING.
/// Per the project hardening spec (docs/settlement-hardening.md), enabling
/// `beforeSwapReturnDelta` (1<<3) moves AgentFloat's risk tier from Medium → High.
/// This contract MUST NOT be deployed to mainnet without:
///   - 2 audits (≥1 math specialist)
///   - mandatory bug bounty
///   - active monitoring
/// The current `0x580` AgentFloatHook stays in production. V2 ships when audited.
contract AgentFloatHookV2 is BaseHook {
    using SafeERC20 for IERC20;
    using StateLibrary for IPoolManager;
    using CurrencySettler for Currency;

    FloatVault public immutable vault;
    IERC20 public immutable usdc;

    /// @notice Tracks USDC parked on behalf of each LP (unchanged from V1).
    mapping(address => uint256) public userDeposits;

    /// @notice Allowlist of routers that implement IMsgSender. Owner-managed.
    ///         The hook trusts these routers to report the real end-user via
    ///         msgSender(). Anything else falls back to the `sender` param,
    ///         which in v4 is the router itself, not the user.
    address public immutable owner;
    mapping(address => bool) public trustedRouters;

    /// EIP-1153 transient slot for recall accounting within a single tx.
    bytes32 private constant TRANSIENT_PARKED_USDC_SLOT =
        keccak256("agentfloat.transient.parked.usdc");

    event IdleLPParked(address indexed lpProvider, PoolId indexed poolId, uint256 amount, int24 currentTick);
    event JITRecallTriggered(address indexed sender, PoolId indexed poolId, uint256 amount, int24 currentTick);
    event JITSettled(PoolId indexed poolId, bool zeroForOne, uint256 inputAbsorbed, uint256 outputProvided);
    event RouterTrustChanged(address indexed router, bool trusted);

    error UntrustedRouter(address router);
    error NotOwner();

    constructor(IPoolManager _poolManager, FloatVault _vault) BaseHook(_poolManager) {
        require(address(_vault) != address(0), "Zero address vault");
        vault = _vault;
        usdc = _vault.usdc();
        owner = msg.sender;
    }

    function setTrustedRouter(address router, bool trusted) external {
        if (msg.sender != owner) revert NotOwner();
        trustedRouters[router] = trusted;
        emit RouterTrustChanged(router, trusted);
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
            beforeSwapReturnDelta: true, // NEW vs V1 — required for settlement
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    /// @dev Resolve the real LP. Prefers IMsgSender on trusted routers,
    ///      falls back to hookData decode (V1 behavior), final fallback is sender.
    function _resolveLp(address sender, bytes calldata hookData) internal view returns (address) {
        if (trustedRouters[sender]) {
            try IMsgSender(sender).msgSender() returns (address user) {
                if (user != address(0)) return user;
            } catch {
                // Router claimed support but reverted — fall through to hookData.
            }
        }
        if (hookData.length >= 64) {
            (address lp,) = abi.decode(hookData, (address, uint256));
            return lp;
        }
        return sender;
    }

    function _afterAddLiquidity(
        address sender,
        PoolKey calldata key,
        ModifyLiquidityParams calldata params,
        BalanceDelta delta,
        BalanceDelta,
        bytes calldata hookData
    ) internal override returns (bytes4, BalanceDelta) {
        (, int24 currentTick,,) = poolManager.getSlot0(key.toId());

        if (currentTick < params.tickLower || currentTick > params.tickUpper) {
            address lpProvider = _resolveLp(sender, hookData);

            uint256 idleAmount = 100 * 10 ** 6;
            if (hookData.length >= 64) {
                (, idleAmount) = abi.decode(hookData, (address, uint256));
            } else if (hookData.length >= 32) {
                idleAmount = abi.decode(hookData, (uint256));
            }

            emit IdleLPParked(lpProvider, key.toId(), idleAmount, currentTick);

            if (usdc.allowance(lpProvider, address(this)) >= idleAmount) {
                // FoT guard — park what actually arrived.
                uint256 balBefore = usdc.balanceOf(address(this));
                usdc.safeTransferFrom(lpProvider, address(this), idleAmount);
                uint256 received = usdc.balanceOf(address(this)) - balBefore;

                usdc.forceApprove(address(vault), received);
                vault.park(received);

                userDeposits[lpProvider] += received;

                bytes32 slot = TRANSIENT_PARKED_USDC_SLOT;
                assembly {
                    let current := tload(slot)
                    tstore(slot, add(current, received))
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
        bytes calldata hookData
    ) internal override returns (bytes4, BalanceDelta) {
        address lpProvider = _resolveLp(sender, hookData);

        uint256 userDep = userDeposits[lpProvider];
        if (userDep > 0) {
            userDeposits[lpProvider] = 0;

            uint256 vaultBal = vault.deposits(address(this));
            uint256 toWithdraw = vaultBal >= userDep ? userDep : vaultBal;
            if (toWithdraw > 0) {
                vault.withdraw(toWithdraw);
            }

            uint256 hookBal = usdc.balanceOf(address(this));
            uint256 refund = userDep <= hookBal ? userDep : hookBal;
            if (refund > 0) {
                usdc.safeTransfer(lpProvider, refund);
            }
        }
        return (BaseHook.afterRemoveLiquidity.selector, delta);
    }

    /// @dev JIT recall + settlement.
    ///
    /// Coverage policy (intentionally conservative for the first cut):
    ///   - Only attempts settlement when the hook actually holds enough USDC
    ///     (post-recall) to cover the swap's required output amount at the
    ///     current pool spot price.
    ///   - Only handles **exact-in swaps where USDC is the output** today.
    ///     Other shapes (exact-out, USDC-input) fall through to ZERO_DELTA
    ///     and let the pool's normal AMM math run — same behavior as V1.
    ///   - Math uses `FullMath.mulDiv` on `sqrtPriceX96`-derived price; we
    ///     intentionally use spot price for this cut. Slippage/price-impact
    ///     handling and partial coverage land in a follow-up after the math
    ///     audit. Rounding is always against the hook (user gets at-least
    ///     the AMM-equivalent or the swap reverts on insufficient balance).
    function _beforeSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        bytes calldata hookData
    ) internal override returns (bytes4, BeforeSwapDelta, uint24) {
        (uint160 sqrtPriceX96, int24 currentTick,,) = poolManager.getSlot0(key.toId());

        // ── Recall: pull parked USDC back into the hook (V1 behavior).
        uint256 recallAmount = 100 * 10 ** 6;
        if (hookData.length >= 32) recallAmount = abi.decode(hookData, (uint256));
        emit JITRecallTriggered(sender, key.toId(), recallAmount, currentTick);

        bytes32 slot = TRANSIENT_PARKED_USDC_SLOT;
        uint256 transientParked;
        assembly { transientParked := tload(slot) }

        if (transientParked >= recallAmount) {
            assembly { tstore(slot, sub(transientParked, recallAmount)) }
            vault.withdraw(recallAmount);
        } else {
            uint256 persistent = vault.deposits(address(this));
            if (persistent >= recallAmount) {
                vault.withdraw(recallAmount);
            }
        }

        // ── Settlement: only the conservative case described above.
        bool exactIn = params.amountSpecified < 0;
        bool usdcIsCurrency0 = address(usdc) == Currency.unwrap(key.currency0);
        bool usdcIsOutput = (params.zeroForOne && !usdcIsCurrency0) || (!params.zeroForOne && usdcIsCurrency0);

        if (!exactIn || !usdcIsOutput) {
            return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
        }

        uint256 inputAmount = uint256(-params.amountSpecified);

        // Convert input → USDC output at current spot price.
        // price = (sqrtPriceX96 / 2^96)^2 expressed as currency1/currency0.
        // We use FullMath.mulDiv to avoid intermediate overflow.
        uint256 outputAmount;
        if (usdcIsCurrency0) {
            // USDC is currency0, input is currency1 → output = input / price
            // = input * 2^192 / sqrtPriceX96^2
            uint256 sqrtP2 = FullMath.mulDiv(uint256(sqrtPriceX96), uint256(sqrtPriceX96), 1);
            outputAmount = FullMath.mulDiv(inputAmount, 1 << 192, sqrtP2);
        } else {
            // USDC is currency1, input is currency0 → output = input * price
            // = input * sqrtPriceX96^2 / 2^192
            uint256 sqrtP2 = FullMath.mulDiv(uint256(sqrtPriceX96), uint256(sqrtPriceX96), 1);
            outputAmount = FullMath.mulDiv(inputAmount, sqrtP2, 1 << 192);
        }

        // Solvency check — we only settle if we can actually pay.
        if (usdc.balanceOf(address(this)) < outputAmount) {
            return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
        }

        // ── Execute settlement.
        Currency inputCurrency = params.zeroForOne ? key.currency0 : key.currency1;
        Currency outputCurrency = params.zeroForOne ? key.currency1 : key.currency0;

        // Take the user's input from the PoolManager → hook owes nothing back.
        inputCurrency.take(poolManager, address(this), inputAmount, false);

        // Settle the output to the PoolManager from the hook's USDC balance.
        usdc.forceApprove(address(poolManager), outputAmount);
        outputCurrency.settle(poolManager, address(this), outputAmount, false);

        emit JITSettled(key.toId(), params.zeroForOne, inputAmount, outputAmount);

        // Delta accounting: specified = +inputAmount (we absorbed the user's input),
        // unspecified = -outputAmount (we delivered the output).
        return (
            BaseHook.beforeSwap.selector,
            toBeforeSwapDelta(int128(int256(inputAmount)), -int128(int256(outputAmount))),
            0
        );
    }
}
