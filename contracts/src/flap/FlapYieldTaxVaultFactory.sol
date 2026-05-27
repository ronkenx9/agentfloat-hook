// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./FlapYieldTaxVault.sol";

contract FlapYieldTaxVaultFactory {
    address public immutable floatVault;
    address public immutable guardian;

    event VaultCreated(address indexed vault, address indexed taxToken, address indexed creator);

    constructor(address _floatVault, address _guardian) {
        require(_floatVault != address(0), "Zero float vault");
        require(_guardian != address(0), "Zero guardian");
        floatVault = _floatVault;
        guardian = _guardian;
    }

    function newVault(
        address taxToken,
        address quoteToken,
        address creator,
        bytes calldata /* vaultData */
    ) external returns (address vault) {
        FlapYieldTaxVault newContract = new FlapYieldTaxVault(
            taxToken,
            quoteToken,
            creator,
            floatVault,
            guardian
        );
        vault = address(newContract);
        emit VaultCreated(vault, taxToken, creator);
    }
}
