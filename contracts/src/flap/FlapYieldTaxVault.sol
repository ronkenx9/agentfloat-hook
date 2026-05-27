// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./VaultBaseV2.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IFloatVault {
    function usdc() external view returns (address);
    function park(uint256 amount) external;
    function withdraw(uint256 amount) external;
    function deposits(address depositor) external view returns (uint256);
}

interface IWOKB {
    function deposit() external payable;
    function withdraw(uint256 wad) external;
}

contract FlapYieldTaxVault is VaultBaseV2 {
    using SafeERC20 for IERC20;

    // Wrapped OKB Address on X Layer Mainnet
    address public constant WOKB_ADDRESS = 0xe538905cf8410324e03A5A23C1c177a474D59b2b;

    address public immutable taxToken;
    address public immutable quoteToken;
    address public immutable creator;
    IFloatVault public immutable floatVault;
    IERC20 public immutable usdc;

    event TaxesParked(uint256 amount);
    event TaxesWithdrawn(address indexed recipient, uint256 amount);

    constructor(
        address _taxToken,
        address _quoteToken,
        address _creator,
        address _floatVault,
        address _guardian
    ) VaultBaseV2(_guardian) {
        require(_taxToken != address(0), "Zero tax token");
        require(_floatVault != address(0), "Zero float vault");
        taxToken = _taxToken;
        quoteToken = _quoteToken;
        creator = _creator;
        floatVault = IFloatVault(_floatVault);
        usdc = IERC20(floatVault.usdc());
    }

    // Called when the tax token sends native quote tokens (e.g. OKB)
    receive() external payable override {
        // If the vault is configured for WOKB, wrap native OKB to WOKB and park it
        if (address(usdc) == WOKB_ADDRESS) {
            uint256 amount = msg.value;
            if (amount > 0) {
                IWOKB(WOKB_ADDRESS).deposit{value: amount}();
                IERC20(WOKB_ADDRESS).approve(address(floatVault), amount);
                floatVault.park(amount);
                emit TaxesParked(amount);
            }
        }
    }

    // Check the vault's raw underlying balance and park it in FloatVault to start earning yield
    function parkTaxes() public {
        if (quoteToken == address(usdc)) {
            uint256 rawBalance = usdc.balanceOf(address(this));
            if (rawBalance > 0) {
                usdc.approve(address(floatVault), rawBalance);
                floatVault.park(rawBalance);
                emit TaxesParked(rawBalance);
            }
        }
    }

    // Accept ERC20 taxes and deposit them to FloatVault
    function depositTaxERC20(uint256 amount) external {
        require(quoteToken != address(0), "Native quote token");
        require(msg.sender == taxToken || msg.sender == creator, "Not authorized");
        
        IERC20(quoteToken).safeTransferFrom(msg.sender, address(this), amount);

        if (quoteToken == address(usdc)) {
            IERC20(quoteToken).approve(address(floatVault), amount);
            floatVault.park(amount);
            emit TaxesParked(amount);
        }
    }

    // Withdraw taxes along with any accrued yield
    function withdrawTaxes(uint256 amount) external {
        require(msg.sender == creator || msg.sender == guardian, "Not creator or guardian");

        if (quoteToken == address(usdc)) {
            // First park any raw USDC/USDT0 to ensure all yield is counted
            parkTaxes();

            // Check deposits in FloatVault
            uint256 deposited = floatVault.deposits(address(this));
            require(deposited >= amount, "Insufficient deposited balance");

            // Withdraw from FloatVault to this contract
            floatVault.withdraw(amount);
            
            // Transfer to creator/guardian
            usdc.safeTransfer(msg.sender, amount);
        } else if (quoteToken == address(0)) {
            // Native OKB withdrawal
            if (address(usdc) == WOKB_ADDRESS) {
                // Withdraw WOKB from FloatVault
                floatVault.withdraw(amount);
                // Unwrap WOKB to native OKB
                IWOKB(WOKB_ADDRESS).withdraw(amount);
                // Send native OKB to creator/guardian
                payable(msg.sender).transfer(amount);
            } else {
                require(address(this).balance >= amount, "Insufficient native balance");
                payable(msg.sender).transfer(amount);
            }
        } else {
            // Standard ERC20
            IERC20(quoteToken).safeTransfer(msg.sender, amount);
        }

        emit TaxesWithdrawn(msg.sender, amount);
    }

    function withdrawAll() external {
        require(msg.sender == creator || msg.sender == guardian, "Not creator or guardian");

        if (quoteToken == address(usdc)) {
            parkTaxes();
            
            uint256 deposited = floatVault.deposits(address(this));
            if (deposited > 0) {
                floatVault.withdraw(deposited);
            }
            uint256 balance = usdc.balanceOf(address(this));
            if (balance > 0) {
                usdc.safeTransfer(msg.sender, balance);
                emit TaxesWithdrawn(msg.sender, balance);
            }
        } else if (quoteToken == address(0)) {
            if (address(usdc) == WOKB_ADDRESS) {
                uint256 deposited = floatVault.deposits(address(this));
                if (deposited > 0) {
                    floatVault.withdraw(deposited);
                    IWOKB(WOKB_ADDRESS).withdraw(deposited);
                }
            }
            uint256 nativeBalance = address(this).balance;
            if (nativeBalance > 0) {
                payable(msg.sender).transfer(nativeBalance);
                emit TaxesWithdrawn(msg.sender, nativeBalance);
            }
        } else {
            uint256 balance = IERC20(quoteToken).balanceOf(address(this));
            if (balance > 0) {
                IERC20(quoteToken).safeTransfer(msg.sender, balance);
                emit TaxesWithdrawn(msg.sender, balance);
            }
        }
    }

    // Get current total value (including yield from FloatVault)
    function totalValue() public view returns (uint256) {
        if (quoteToken == address(usdc)) {
            return floatVault.deposits(address(this)) + usdc.balanceOf(address(this));
        } else if (quoteToken == address(0)) {
            if (address(usdc) == WOKB_ADDRESS) {
                return floatVault.deposits(address(this)) + address(this).balance;
            } else {
                return address(this).balance;
            }
        } else {
            return IERC20(quoteToken).balanceOf(address(this));
        }
    }

    function description() external view override returns (string memory) {
        return "AgentFloat Yield-generating Flap Tax Vault. Routes accumulated taxes to FloatVault to earn optimized on-chain yield.";
    }

    function vaultUISchema() external view override returns (VaultUISchema memory) {
        VaultMethodSchema[] memory methods = new VaultMethodSchema[](4);

        // 1. depositTaxERC20
        FieldDescriptor[] memory depositInputs = new FieldDescriptor[](1);
        depositInputs[0] = FieldDescriptor("amount", "uint256", "Amount of quote token tax to deposit");
        FieldDescriptor[] memory depositOutputs = new FieldDescriptor[](0);
        ApproveAction[] memory depositApprovals = new ApproveAction[](1);
        depositApprovals[0] = ApproveAction("quoteToken", "amount");
        methods[0] = VaultMethodSchema(
            "depositTaxERC20",
            "Deposits quote token tax into the vault, routing it to FloatVault if it is USDC/USDT0 to generate yield.",
            depositInputs,
            depositOutputs,
            depositApprovals,
            false,
            false,
            true
        );

        // 2. withdrawTaxes
        FieldDescriptor[] memory withdrawInputs = new FieldDescriptor[](1);
        withdrawInputs[0] = FieldDescriptor("amount", "uint256", "Amount to withdraw");
        FieldDescriptor[] memory withdrawOutputs = new FieldDescriptor[](0);
        ApproveAction[] memory withdrawApprovals = new ApproveAction[](0);
        methods[1] = VaultMethodSchema(
            "withdrawTaxes",
            "Withdraws tax tokens along with accrued yield to the creator or guardian.",
            withdrawInputs,
            withdrawOutputs,
            withdrawApprovals,
            false,
            false,
            true
        );

        // 3. withdrawAll
        FieldDescriptor[] memory withdrawAllInputs = new FieldDescriptor[](0);
        FieldDescriptor[] memory withdrawAllOutputs = new FieldDescriptor[](0);
        ApproveAction[] memory withdrawAllApprovals = new ApproveAction[](0);
        methods[2] = VaultMethodSchema(
            "withdrawAll",
            "Withdraws all tax tokens along with accrued yield to the creator or guardian.",
            withdrawAllInputs,
            withdrawAllOutputs,
            withdrawAllApprovals,
            false,
            false,
            true
        );

        // 4. totalValue
        FieldDescriptor[] memory valueInputs = new FieldDescriptor[](0);
        FieldDescriptor[] memory valueOutputs = new FieldDescriptor[](1);
        valueOutputs[0] = FieldDescriptor("value", "uint256", "Total value of taxes currently held in the vault");
        ApproveAction[] memory valueApprovals = new ApproveAction[](0);
        methods[3] = VaultMethodSchema(
            "totalValue",
            "Returns the total value of taxes currently held (including yield).",
            valueInputs,
            valueOutputs,
            valueApprovals,
            false,
            false,
            false
        );

        return VaultUISchema("AgentFloatYieldVault", "Yield-generating Flap Tax Vault", methods);
    }
}
