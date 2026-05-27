// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/FloatVault.sol";
import "../src/AgentFloatHook.sol";
import "../src/strategies/IdleStrategy.sol";
import "../src/strategies/MockYieldStrategy.sol";
import "../test/mocks/MockUSDC.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolManager} from "v4-core/src/PoolManager.sol";

contract DeployScript is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Deploy PoolManager (if needed, or use existing)
        address poolManagerAddr = vm.envOr("POOL_MANAGER_ADDRESS", address(0));
        if (poolManagerAddr == address(0)) {
            PoolManager manager = new PoolManager(deployer);
            poolManagerAddr = address(manager);
            console.log("Deployed PoolManager at:", poolManagerAddr);
        } else {
            console.log("Using PoolManager at:", poolManagerAddr);
        }

        // 2. Deploy Mock USDC (if needed, or use existing)
        address usdcAddr = vm.envOr("USDC_ADDRESS", address(0));
        if (usdcAddr == address(0)) {
            MockUSDC mockUSDC = new MockUSDC();
            usdcAddr = address(mockUSDC);
            console.log("Deployed MockUSDC at:", usdcAddr);
        } else {
            console.log("Using USDC at:", usdcAddr);
        }

        // 3. Deploy FloatVault
        FloatVault vault = new FloatVault(usdcAddr);
        console.log("Deployed FloatVault at:", address(vault));

        // 4. Deploy Strategies
        IdleStrategy idle = new IdleStrategy(usdcAddr);
        console.log("Deployed IdleStrategy at:", address(idle));

        MockYieldStrategy yieldStrat = new MockYieldStrategy(usdcAddr, address(vault), 1000); // 10 bps per block
        console.log("Deployed MockYieldStrategy at:", address(yieldStrat));

        // 5. Register strategies in FloatVault
        vault.registerStrategy(address(idle), false);      // active (id = 1)
        vault.registerStrategy(address(yieldStrat), true);  // shadow (id = 2)
        console.log("Registered strategies in FloatVault");

        // 6. Mine hook salt & deploy AgentFloatHook
        bytes32 salt = mineHookSalt(
            deployer,
            poolManagerAddr,
            address(vault)
        );
        console.log("Mined salt:", vm.toString(salt));

        AgentFloatHook hook = new AgentFloatHook{salt: salt}(IPoolManager(poolManagerAddr), vault);
        console.log("Deployed AgentFloatHook at:", address(hook));
        
        vm.stopBroadcast();
    }

    // Mines a CREATE2 salt for AgentFloatHook
    function mineHookSalt(
        address deployer,
        address poolManager,
        address vault
    ) internal view returns (bytes32) {
        bytes memory creationCode = type(AgentFloatHook).creationCode;
        bytes memory bytecode = abi.encodePacked(
            creationCode,
            abi.encode(poolManager, vault)
        );
        bytes32 bytecodeHash = keccak256(bytecode);

        uint256 count = 0;
        while (true) {
            bytes32 salt = bytes32(count);
            address predicted = predictedAddress(deployer, salt, bytecodeHash);
            // Check flags: AFTER_ADD_LIQUIDITY_FLAG (bit 10), AFTER_REMOVE_LIQUIDITY_FLAG (bit 8), BEFORE_SWAP_FLAG (bit 7)
            // Mask is 0x0580 in lower 14 bits of address
            if (uint160(predicted) & 0x3FFF == 0x0580) {
                return salt;
            }
            count++;
        }
        revert("Salt not found");
    }

    function predictedAddress(
        address deployer,
        bytes32 salt,
        bytes32 bytecodeHash
    ) internal pure returns (address) {
        return address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(
                            bytes1(0xff),
                            deployer,
                            salt,
                            bytecodeHash
                        )
                    )
                )
            )
        );
    }
}
