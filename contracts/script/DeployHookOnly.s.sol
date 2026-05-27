// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {AgentFloatHook} from "../src/AgentFloatHook.sol";
import {FloatVault} from "../src/FloatVault.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";

/// @title Deploy AgentFloatHook against an already-deployed FloatVault
/// @notice Mines a CREATE2 salt + deploys via the universal CREATE2 deployer in one tx.
contract DeployHookOnly is Script {
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    // Required low-14-bit mask: AFTER_ADD_LIQUIDITY (0x400) | AFTER_REMOVE_LIQUIDITY (0x100) | BEFORE_SWAP (0x80)
    uint160 constant REQUIRED_FLAGS = 0x580;
    uint160 constant FLAG_MASK = 0x3FFF;

    function run() public {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address poolManager = vm.envAddress("POOL_MANAGER_ADDRESS");
        address vaultAddr = vm.envAddress("VAULT_ADDRESS");

        bytes memory creationCode = type(AgentFloatHook).creationCode;
        bytes memory bytecode = abi.encodePacked(creationCode, abi.encode(poolManager, vaultAddr));
        bytes32 bytecodeHash = keccak256(bytecode);

        bytes32 salt;
        address predicted;
        for (uint256 i = 0; i < 200_000; i++) {
            salt = bytes32(i);
            predicted = address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), CREATE2_DEPLOYER, salt, bytecodeHash)))));
            if ((uint160(predicted) & FLAG_MASK) == REQUIRED_FLAGS) {
                console.log("Mined salt after", i, "attempts");
                console.logBytes32(salt);
                console.log("Predicted hook address:", predicted);
                break;
            }
        }
        require((uint160(predicted) & FLAG_MASK) == REQUIRED_FLAGS, "Salt search failed; widen range");

        vm.startBroadcast(pk);

        // Deploy via the universal CREATE2 deployer with a single call
        (bool ok, ) = CREATE2_DEPLOYER.call(abi.encodePacked(salt, bytecode));
        require(ok, "CREATE2 deploy call failed");

        vm.stopBroadcast();

        // Verify
        uint256 size;
        assembly { size := extcodesize(predicted) }
        require(size > 0, "Hook bytecode empty at predicted address");

        console.log("");
        console.log("=== Hook deployed ===");
        console.log("Address:", predicted);
        console.log("Code size:", size);
    }
}
