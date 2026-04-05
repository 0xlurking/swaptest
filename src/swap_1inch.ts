import axios from "axios";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
} from "viem";
import { base } from "viem/chains";
import { BASE_RPC_URL, ONEINCH_BASE_URL, ONEINCH_API_KEY } from "./config";
import { getAccount, WalletInfo } from "./wallet";
import { QuoteParams, QuoteResult } from "./swap";

const ERC20_APPROVE_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

function authHeaders(): Record<string, string> {
  if (!ONEINCH_API_KEY) {
    throw new Error(
      "ONEINCH_API_KEY is not set. Add it to your .env file."
    );
  }
  return { Authorization: `Bearer ${ONEINCH_API_KEY}` };
}

/**
 * Fetch a swap quote from 1inch aggregator.
 */
export async function getQuote(params: QuoteParams): Promise<QuoteResult> {
  const amountInRaw = parseUnits(params.amountIn, params.decimalsIn).toString();

  const res = await axios.get(`${ONEINCH_BASE_URL}/quote`, {
    params: {
      src: params.tokenIn,
      dst: params.tokenOut,
      amount: amountInRaw,
      includeGas: true,
    },
    headers: authHeaders(),
  });

  const data = res.data as {
    dstAmount: string;
    gas?: number;
    router?: string;
    tx?: { to: string };
  };

  // /quote does not return calldata or a router address — those require /swap
  return {
    amountOut: formatUnits(BigInt(data.dstAmount), params.decimalsOut),
    amountOutRaw: data.dstAmount,
    routerAddress: data.router ?? data.tx?.to ?? "",
    encodedSwapData: "",
    gas: data.gas?.toString() ?? "N/A",
    priceImpact: "N/A",
  };
}

/**
 * Execute a token swap on BASE chain via 1inch aggregator.
 */
export async function executeSwap(
  walletInfo: WalletInfo,
  params: QuoteParams,
  _quote: QuoteResult
): Promise<string> {
  const account = getAccount(walletInfo);

  const publicClient = createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL),
  });

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(BASE_RPC_URL),
  });

  // 1inch slippage is in percentage (e.g. 0.5 for 0.5%); params.slippage is in bps (e.g. 50 = 0.5%)
  const amountInRaw = parseUnits(params.amountIn, params.decimalsIn).toString();
  const slippagePct = ((params.slippage ?? 50) / 100).toString();

  const res = await axios.get(`${ONEINCH_BASE_URL}/swap`, {
    params: {
      src: params.tokenIn,
      dst: params.tokenOut,
      amount: amountInRaw,
      from: account.address,
      slippage: slippagePct,
      disableEstimate: false,
    },
    headers: authHeaders(),
  });

  const swapData = res.data as {
    dstAmount: string;
    tx: {
      to: string;
      data: string;
      value: string;
      gas: number;
    };
  };

  const { to, data, value } = swapData.tx;
  const isNativeIn = params.tokenIn.toLowerCase() === NATIVE_TOKEN.toLowerCase();

  // Approve ERC-20 spend allowance if needed
  if (!isNativeIn) {
    const amountInBig = BigInt(amountInRaw);
    const allowance = (await publicClient.readContract({
      address: params.tokenIn as `0x${string}`,
      abi: ERC20_APPROVE_ABI,
      functionName: "allowance",
      args: [account.address, to as `0x${string}`],
    })) as bigint;

    if (allowance < amountInBig) {
      console.log("  Approving token spend...");
      const approveTx = await walletClient.writeContract({
        address: params.tokenIn as `0x${string}`,
        abi: ERC20_APPROVE_ABI,
        functionName: "approve",
        args: [to as `0x${string}`, amountInBig],
      });
      console.log(`  Approval tx: ${approveTx}`);
      await publicClient.waitForTransactionReceipt({ hash: approveTx });
      console.log("  Approval confirmed.");
    }
  }

  const txHash = await walletClient.sendTransaction({
    to: to as `0x${string}`,
    data: data as `0x${string}`,
    value: isNativeIn ? BigInt(value) : 0n,
  });

  return txHash;
}
