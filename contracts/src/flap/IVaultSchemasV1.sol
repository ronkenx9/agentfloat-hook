// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IVaultSchemasV1 {
    struct ApproveAction {
        string tokenType;      // e.g., "taxToken"
        string amountFieldName; // e.g., "amount"
    }

    struct FieldDescriptor {
        string name;        // e.g., "recipient", "bps", "amount"
        string fieldType;   // e.g., "address", "uint256"
        string description; // e.g., "Address to send funds", "Percentage to send"
    }

    struct VaultMethodSchema {
        string name;
        string description;
        FieldDescriptor[] inputs;
        FieldDescriptor[] outputs;
        ApproveAction[] approvals;
        bool isInputArray;
        bool isOutputArray;
        bool isWriteMethod;
    }

    struct VaultUISchema {
        string vaultType;
        string description;
        VaultMethodSchema[] methods;
    }
}
