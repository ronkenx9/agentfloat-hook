// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IVaultSchemasV1.sol";

abstract contract VaultBaseV2 is IVaultSchemasV1 {
    address public immutable guardian;

    constructor(address _guardian) {
        require(_guardian != address(0), "Zero guardian address");
        guardian = _guardian;
    }

    function description() external view virtual returns (string memory);
    function vaultUISchema() external view virtual returns (VaultUISchema memory);

    receive() external payable virtual {}
}
