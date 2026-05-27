// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/FloatVault.sol";
import "../src/AgentFloatHook.sol";
import "../src/strategies/IdleStrategy.sol";
import "../src/strategies/MockYieldStrategy.sol";
import "../src/strategies/AaveStrategy.sol";
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

        // 5. Register strategies in FloatVault
        vault.registerStrategy(address(idle), false);      // active (id = 1)

        if (block.chainid == 196) {
            // Deploy AaveStrategy
            // Aave Pool on X Layer: 0xE3F3Caefdd7180F884c01E57f65Df979Af84f116
            // aUSDT0 token on X Layer: 0xF356ae412dB5df43BD3a10746f7ad4e1C4De4297
            AaveStrategy aaveStrat = new AaveStrategy(
                usdcAddr, 
                0xE3F3Caefdd7180F884c01E57f65Df979Af84f116, 
                0xF356ae412dB5df43BD3a10746f7ad4e1C4De4297
            );
            console.log("Deployed AaveStrategy at:", address(aaveStrat));
            vault.registerStrategy(address(aaveStrat), true); // shadow (id = 2)

            // Deploy MockYieldStrategy as secondary shadow
            MockYieldStrategy mockStrat = new MockYieldStrategy(usdcAddr, address(vault), 200); // 2 bps per block
            console.log("Deployed MockYieldStrategy at:", address(mockStrat));
            vault.registerStrategy(address(mockStrat), true); // shadow (id = 3)
        } else {
            MockYieldStrategy yieldStrat = new MockYieldStrategy(usdcAddr, address(vault), 1000); // 10 bps per block
            console.log("Deployed MockYieldStrategy at:", address(yieldStrat));
            vault.registerStrategy(address(yieldStrat), true);  // shadow (id = 2)
        }
        console.log("Registered strategies in FloatVault");

        // 6. Mine hook salt & deploy AgentFloatHook
        bytes32 salt = mineHookSalt(
            0x4e59b44847b379578588920cA78FbF26c0B4956C,
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
