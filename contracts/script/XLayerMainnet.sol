// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title X Layer Mainnet -- canonical external contract addresses
/// @notice Sourced 2026-05-27 from Aave Address Book (bgd-labs) and Uniswap v4 docs.
///         All addresses are EIP-55 checksummed.
library XLayerMainnet {
    // Chain
    uint256 internal constant CHAIN_ID = 196;

    // Uniswap v4 (canonical, do not redeploy)
    address internal constant POOL_MANAGER = 0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32;
    address internal constant POSITION_MANAGER = 0xcF1EAFC6928dC385A342E7C6491d371d2871458b;

    // Aave V3 (live on X Layer mainnet)
    address internal constant AAVE_POOL = 0xE3F3Caefdd7180F884c01E57f65Df979Af84f116;
    address internal constant AAVE_POOL_ADDRESSES_PROVIDER = 0xdFf435BCcf782f11187D3a4454d96702eD78e092;
    address internal constant AAVE_DATA_PROVIDER = 0x6C505C31714f14e8af2A03633EB2Cdfb4959138F;
    address internal constant AAVE_ORACLE = 0x91FC11136d5615575a0fC5981Ab5C0C54418E2C6;

    // USDT on X Layer (the canonical stable; Aave reserves this)
    address internal constant USDT = 0x779Ded0c9e1022225f8E0630b35a9b54bE713736;
    address internal constant AUSDT = 0xF356ae412dB5df43BD3a10746f7ad4e1C4De4297;
}
