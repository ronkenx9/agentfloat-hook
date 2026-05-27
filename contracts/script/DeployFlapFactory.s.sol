// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/flap/FlapYieldTaxVaultFactory.sol";

contract DeployFlapFactoryScript is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        address floatVault = vm.envOr("VAULT_ADDRESS", address(0));
        require(floatVault != address(0), "Zero vault address");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy FlapYieldTaxVaultFactory using the deployer address as the guardian backup
        FlapYieldTaxVaultFactory factory = new FlapYieldTaxVaultFactory(
            floatVault,
            deployer
        );

        console.log("Deployed FlapYieldTaxVaultFactory at:", address(factory));

        vm.stopBroadcast();
    }
}
