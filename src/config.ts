import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export const BASE_CHAIN_ID = 8453;
export const BASE_RPC_URL =
  process.env.BASE_RPC_URL || "https://mainnet.base.org";

export const KYBERSWAP_BASE_URL =
  "https://aggregator-api.kyberswap.com/base/api/v1";

// Well-known BASE token addresses
export const TOKENS: Record<string, { address: string; decimals: number; symbol: string }> = {
  ETH: {
    address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    decimals: 18,
    symbol: "ETH",
  },
  WETH: {
    address: "0x4200000000000000000000000000000000000006",
    decimals: 18,
    symbol: "WETH",
  },
  USDC: {
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    decimals: 6,
    symbol: "USDC",
  },
  USDT: {
    address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
    decimals: 6,
    symbol: "USDT",
  },
  DAI: {
    address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    decimals: 18,
    symbol: "DAI",
  },
  CBETH: {
    address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
    decimals: 18,
    symbol: "CBETH",
  },
};

export const WALLET_FILE = path.resolve(process.cwd(), "wallet.json");
export const PRIVATE_KEY = process.env.PRIVATE_KEY;
export const KYBERSWAP_CLIENT_ID = process.env.KYBERSWAP_CLIENT_ID || "swaptest-bot";
