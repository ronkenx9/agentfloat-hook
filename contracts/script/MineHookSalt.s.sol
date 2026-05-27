// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {AgentFloatHook} from "../src/AgentFloatHook.sol";
import {FloatVault} from "../src/FloatVault.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {XLayerMainnet} from "./XLayerMainnet.sol";

/// @title Mine a CREATE2 salt for AgentFloatHook
/// @notice Run this BEFORE DeployMainnet — outputs HOOK_SALT to set in env.
///
///   forge script script/MineHookSalt.s.sol --rpc-url $X_LAYER_MAINNET_RPC
///
/// Outputs the salt and predicted hook address. Set HOOK_SALT in .env before running DeployMainnet.
contract MineHookSalt is Script {
    uint160 constant REQUIRED_FLAGS =
        uint160(Hooks.AFTER_ADD_LIQUIDITY_FLAG)
            | uint160(Hooks.AFTER_REMOVE_LIQUIDITY_FLAG)
            | uint160(Hooks.BEFORE_SWAP_FLAG);
    uint160 constant FLAG_MASK = uint160((1 << 14) - 1);

    function run() public view {
        address deployer = vm.envAddress("DEPLOYER_ADDRESS");

        // The FloatVault address will be deterministic from the deployer's nonce on mainnet.
        // For simulation here, we assume the FloatVault has been deployed at the address
        // computed from the deployer's nonce at the time of the actual mainnet broadcast.
        // To make this practical, deploy in two transactions OR mine after FloatVault is known.

        address mockVault = vm.envOr("VAULT_ADDRESS", address(0));
        require(mockVault != address(0), "Set VAULT_ADDRESS in env (deploy FloatVault first OR pass predicted address)");

        bytes memory creationCode = abi.encodePacked(
            type(AgentFloatHook).creationCode,
            abi.encode(XLayerMainnet.POOL_MANAGER, mockVault)
        );

        for (uint256 i = 0; i < 1_000_000; i++) {
            bytes32 salt = bytes32(i);
            address predicted = computeCreate2Address(deployer, salt, keccak256(creationCode));
            if ((uint160(predicted) & FLAG_MASK) == REQUIRED_FLAGS) {
                console.log("Found valid salt after", i, "attempts");
                console.logBytes32(salt);
                console.log("Predicted hook address:", predicted);
                return;
            }
        }
        revert("No valid salt found in 1M attempts; widen search");
    }

    function computeCreate2Address(address deployer, bytes32 salt, bytes32 codeHash) internal pure returns (address) {
        bytes32 hash = keccak256(abi.encodePacked(bytes1(0xff), deployer, salt, codeHash));
        return address(uint160(uint256(hash)));
    }
}
