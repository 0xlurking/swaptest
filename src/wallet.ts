import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http, formatEther } from "viem";
import { base } from "viem/chains";
import fs from "fs";
import path from "path";
import { WALLET_FILE, BASE_RPC_URL } from "./config";

export interface WalletInfo {
  address: string;
  privateKey: string;
  createdAt: string;
}

/**
 * Generate a new random wallet and save it to wallet.json.
 * Returns the wallet info. Warns if a wallet file already exists.
 */
export function createWallet(overwrite = false): WalletInfo {
  if (fs.existsSync(WALLET_FILE) && !overwrite) {
    const existing = loadWallet();
    console.log(
      "⚠️  Wallet file already exists. Use --overwrite to replace it."
    );
    console.log(`   Address: ${existing.address}`);
    return existing;
  }

  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  const walletInfo: WalletInfo = {
    address: account.address,
    privateKey: privateKey,
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync(WALLET_FILE, JSON.stringify(walletInfo, null, 2), {
    mode: 0o600,
  });

  return walletInfo;
}

/**
 * Load wallet from wallet.json or from PRIVATE_KEY env var.
 */
export function loadWallet(): WalletInfo {
  // Prefer env var over file
  const envKey = process.env.PRIVATE_KEY;
  if (envKey) {
    const key = envKey.startsWith("0x") ? envKey : `0x${envKey}`;
    const account = privateKeyToAccount(key as `0x${string}`);
    return {
      address: account.address,
      privateKey: key,
      createdAt: "from-env",
    };
  }

  if (!fs.existsSync(WALLET_FILE)) {
    throw new Error(
      `No wallet found. Run 'create-wallet' command first, or set PRIVATE_KEY in .env`
    );
  }

  const raw = fs.readFileSync(WALLET_FILE, "utf-8");
  return JSON.parse(raw) as WalletInfo;
}

/**
 * Return the viem account object for signing transactions.
 */
export function getAccount(walletInfo: WalletInfo) {
  return privateKeyToAccount(walletInfo.privateKey as `0x${string}`);
}

/**
 * Get ETH balance for an address on BASE.
 */
export async function getBalance(address: string): Promise<string> {
  const client = createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL),
  });

  const balance = await client.getBalance({
    address: address as `0x${string}`,
  });

  return formatEther(balance);
}

/**
 * Get token balance (ERC-20) for an address on BASE.
 */
export async function getTokenBalance(
  address: string,
  tokenAddress: string,
  decimals: number
): Promise<string> {
  const client = createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL),
  });

  const balance = await client.readContract({
    address: tokenAddress as `0x${string}`,
    abi: [
      {
        name: "balanceOf",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
      },
    ],
    functionName: "balanceOf",
    args: [address as `0x${string}`],
  });

  const raw = balance as bigint;
  const divisor = BigInt(10 ** decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, 6);
  return `${whole}.${fracStr}`;
}

/**
 * Display wallet info safely (masks private key).
 */
export function displayWallet(info: WalletInfo, showKey = false): void {
  console.log("\n=== Wallet Info ===");
  console.log(`Address    : ${info.address}`);
  console.log(
    `Private Key: ${showKey ? info.privateKey : "****** (use --show-key to reveal)"}`
  );
  if (info.createdAt !== "from-env") {
    console.log(`Created At : ${info.createdAt}`);
    console.log(`Saved to   : ${path.resolve(WALLET_FILE)}`);
  } else {
    console.log(`Source     : PRIVATE_KEY environment variable`);
  }
  console.log("===================\n");
}
