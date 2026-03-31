// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/math/Math.sol";

/// @title BrainMath — On-chain trend detection math for AutoVault3Mode
/// @notice Deployed as a linked library to reduce main contract bytecode.
///         All functions are public so they generate DELEGATECALL (not inlined).
library BrainMath {
    uint256 internal constant FAST_SMA = 4;

    /// @dev Get price from circular buffer. offset=0 is most recent.
    function getPrice(uint256[14] memory prices, uint256 count, uint256 offset)
        public pure returns (uint256)
    {
        return prices[((count - 1) - offset) % 14];
    }

    /// @dev Simple moving average over `period` most recent prices.
    function calculateSMA(uint256[14] memory prices, uint256 count, uint256 period)
        public pure returns (uint256)
    {
        uint256 sum;
        for (uint256 i; i < period; i++) {
            sum += getPrice(prices, count, i);
        }
        return sum / period;
    }

    /// @dev 14-day annualized volatility as integer percentage (80 = 80%).
    function calculateVolatility(uint256[14] memory prices, uint256 count)
        public pure returns (uint256)
    {
        uint256 n = count < 14 ? count : 14;
        if (n < 2) return 0;
        uint256 nr = n - 1;

        int256[] memory r = new int256[](nr);
        int256 sr;
        for (uint256 i; i < nr; i++) {
            uint256 pn = getPrice(prices, count, i);
            uint256 po = getPrice(prices, count, i + 1);
            if (po == 0) return 0;
            r[i] = (int256(pn) - int256(po)) * 1e6 / int256(po);
            sr += r[i];
        }
        int256 mean = sr / int256(nr);

        uint256 ssq;
        for (uint256 i; i < nr; i++) {
            int256 d = r[i] - mean;
            ssq += uint256(d * d);
        }
        return (Math.sqrt(ssq / nr) * 19) / 1e4;
    }

    /// @dev 4-day weighted momentum in permille (3 = 0.3%).
    function calculateMomentum(uint256[14] memory prices, uint256 count)
        public pure returns (int256)
    {
        uint256 n = count < 14 ? count : 14;
        if (n < FAST_SMA + 1) return 0;

        int256 ws; uint256 tw;
        for (uint256 i; i < FAST_SMA; i++) {
            uint256 pn = getPrice(prices, count, i);
            uint256 po = getPrice(prices, count, i + 1);
            if (po == 0) return 0;
            int256 dr = (int256(pn) - int256(po)) * 1000 / int256(po);
            uint256 w = FAST_SMA - i;
            ws += dr * int256(w);
            tw += w;
        }
        return ws / int256(tw);
    }
}
