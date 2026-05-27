// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {FloatVault} from "../src/FloatVault.sol";
import {AgentFloatHook} from "../src/AgentFloatHook.sol";
import {IdleStrategy} from "../src/strategies/IdleStrategy.sol";
import {AaveStrategy} from "../src/strategies/AaveStrategy.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {XLayerMainnet} from "./XLayerMainnet.sol";

/// @title Deploy to X Layer mainnet
/// @notice Attaches AgentFloat to the canonical Uniswap v4 PoolManager on X Layer.
///         Uses real USDT (the asset Aave reserves on X Layer) and the live Aave V3 Pool.
///         Mines a hook salt offline first -set HOOK_SALT in env before running.
///
/// One-shot deploy:
///   forge script script/DeployMainnet.s.sol --rpc-url $X_LAYER_MAINNET_RPC \
///     --broadcast --legacy --priority-gas-price 50000000
///
/// Expected cost: ~8M gas at ~0.1 gwei ≈ 0.0008 OKB ≈ $0.20.
contract DeployMainnet is Script {
    function run() public {
        require(block.chainid == XLayerMainnet.CHAIN_ID, "Wrong chain -this script targets X Layer mainnet (196)");

        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address promoter = vm.envOr("PROMOTER_ADDRESS", deployer);
        bytes32 hookSalt = bytes32(vm.envBytes32("HOOK_SALT"));

        console.log("=== AgentFloat - X Layer Mainnet Deploy ===");
        console.log("Deployer    :", deployer);
        console.log("Promoter    :", promoter);
        console.log("PoolManager :", XLayerMainnet.POOL_MANAGER);
        console.log("USDT        :", XLayerMainnet.USDT);
        console.log("Aave Pool   :", XLayerMainnet.AAVE_POOL);
        console.log("---");

        vm.startBroadcast(deployerPrivateKey);

        // 1. FloatVault (vault holds USDT, distributes to strategies)
        FloatVault vault = new FloatVault(XLayerMainnet.USDT);
        if (promoter != deployer) {
            vault.setPromoter(promoter);
        }
        console.log("FloatVault  :", address(vault));

        // 2. IdleStrategy (baseline floor -holds USDT, no yield)
        IdleStrategy idle = new IdleStrategy(XLayerMainnet.USDT);
        console.log("IdleStrategy:", address(idle));

        // 3. AaveStrategy (real Aave V3 USDT lending market)
        AaveStrategy aave = new AaveStrategy(
            XLayerMainnet.USDT,
            XLayerMainnet.AAVE_POOL,
            XLayerMainnet.AUSDT
        );
        console.log("AaveStrategy:", address(aave));

        // 4. AgentFloatHook -deployed via CREATE2 at the mined salt
        //    The salt must encode permission flags (afterAddLiquidity + afterRemoveLiquidity + beforeSwap)
        AgentFloatHook hook = new AgentFloatHook{salt: hookSalt}(
            IPoolManager(XLayerMainnet.POOL_MANAGER),
            vault
        );
        console.log("Hook        :", address(hook));

        // 5. Register strategies on the vault.
        //    Idle starts active (floor); Aave starts as shadow until it earns promotion.
        vault.registerStrategy(address(idle), false);   // false = NOT shadow → becomes active
        vault.registerStrategy(address(aave), true);    // true  = shadow
        console.log("Strategies registered");

        vm.stopBroadcast();

        console.log("");
        console.log("=== Done ===");
        console.log("Add to ~/brain/skills/agentfloat-strategies/<name>.md");
        console.log("Update agent/.env with mainnet addresses + X_LAYER_CHAIN_ID=196");
        console.log("Restart agent; chain_actions_allowed[196] bounds AI to register/retire/scoring");
    }
}
