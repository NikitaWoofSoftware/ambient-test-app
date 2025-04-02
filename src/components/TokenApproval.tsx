/*****************************
 * FILE: src/components/TokenApproval.tsx
 *****************************/
import React, { useState, useEffect, useCallback } from 'react';
import { Contract, MaxUint256, formatUnits } from 'ethers'; // Removed unused parseUnits
import { type JsonRpcSigner } from 'ethers';
import { ETH_ADDRESS, AMBIENT_DEX_ADDRESS, ETH_SYMBOL } from '../constants'; // Added ETH_SYMBOL

// Minimal ERC20 ABI for allowance and approve
const ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)" // Include decimals for formatting
];

// Define expected props
interface TokenApprovalProps {
  signer: JsonRpcSigner | null;
  userAddress: string | undefined;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  setStatus: (status: string) => void;
  setIsLoading: (loading: boolean) => void;
  isLoading: boolean;
}

export function TokenApproval({
  signer,
  userAddress,
  tokenAddress,
  tokenSymbol,
  tokenDecimals,
  setStatus,
  setIsLoading,
  isLoading
}: TokenApprovalProps) {
  const [approvalStatus, setApprovalStatus] = useState<'checking' | 'approved' | 'not_approved' | 'error' | 'native'>('checking');
  const [allowance, setAllowance] = useState<bigint | null>(null);

  const checkAllowance = useCallback(async () => {
    if (!signer || !userAddress || !tokenAddress) return;
    if (tokenAddress.toLowerCase() === ETH_ADDRESS.toLowerCase()) {
        setApprovalStatus('native');
        setAllowance(null); // Ensure allowance is null for native
        return;
    }

    setApprovalStatus('checking');
    setAllowance(null);

    try {
      const tokenContract = new Contract(tokenAddress, ERC20_ABI, signer);
      const currentAllowance = await tokenContract.allowance(userAddress, AMBIENT_DEX_ADDRESS);
      setAllowance(currentAllowance);

      // Check if allowance is "enough" (we consider MaxUint256 or a very large number as approved for simplicity)
      // Using half of MaxUint256 as a threshold for "practically approved max".
      const halfMax = MaxUint256 / 2n;
      if (currentAllowance >= halfMax) {
        setApprovalStatus('approved');
      } else {
        setApprovalStatus('not_approved');
      }
      console.log(`${tokenSymbol} allowance check: ${formatUnits(currentAllowance, tokenDecimals)}`);
    } catch (error: any) {
      console.error(`Error checking allowance for ${tokenSymbol}:`, error);
      setStatus(`Error checking ${tokenSymbol} allowance: ${error.message}`);
      setApprovalStatus('error');
    }
  }, [signer, userAddress, tokenAddress, tokenSymbol, tokenDecimals, setStatus]);

  // Check allowance on mount and when dependencies change
  useEffect(() => {
    checkAllowance();
  }, [checkAllowance]);

  const handleApprove = async () => {
    if (!signer || !userAddress || approvalStatus === 'approved' || approvalStatus === 'native') return;

    setIsLoading(true);
    setStatus(`Approving ${tokenSymbol} for maximum amount...`);
    setApprovalStatus('checking'); // Show as checking during approval tx

    try {
      const tokenContract = new Contract(tokenAddress, ERC20_ABI, signer);
      const tx = await tokenContract.approve(AMBIENT_DEX_ADDRESS, MaxUint256);
      setStatus(`Approval transaction sent for ${tokenSymbol}: ${tx.hash}. Waiting for confirmation...`);
      await tx.wait(1); // Wait for 1 confirmation
      setStatus(`${tokenSymbol} approved successfully!`);
      // Don't immediately set to 'approved', let checkAllowance confirm it
      await checkAllowance();
    } catch (error: any) {
      console.error(`Error approving ${tokenSymbol}:`, error);
      let message = error.message;
      if (error.shortMessage) message = error.shortMessage;
      if (message.includes('user rejected transaction')) message = 'Transaction rejected by wallet.';
      setStatus(`Failed to approve ${tokenSymbol}: ${message}`);
      // Re-check allowance in case something partially worked or state is inconsistent
      await checkAllowance();
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusText = () => {
      switch (approvalStatus) {
          case 'native': return `(${ETH_SYMBOL} - No approval needed)`;
          case 'checking': return '(Checking...)';
          case 'approved': return `(Approved: ${allowance !== null ? (allowance === MaxUint256 ? 'Max' : `~${formatUnits(allowance, tokenDecimals).substring(0, 8)}`) : 'Yes'})`; // Show more decimals
          case 'not_approved': return `(Requires Approval: ${allowance !== null ? formatUnits(allowance, tokenDecimals) : '0'} granted)`;
          case 'error': return '(Error checking status)';
          default: return '';
      }
  };

  const getStatusClass = () => {
      switch (approvalStatus) {
          case 'native': return 'checked'; // Treat native as checked
          case 'checking': return 'checking';
          case 'approved': return 'checked';
          case 'not_approved': return 'not-checked';
          case 'error': return 'not-checked'; // Treat error as not approved for action
          default: return '';
      }
  }

  // Render approval button if not native and not already fully approved
  const showApprovalButton = approvalStatus !== 'native' && approvalStatus !== 'checking' && approvalStatus !== 'approved';
  // Also allow re-approval if approved but not max (though unlikely needed with MaxUint check)
  // const canReApprove = approvalStatus === 'approved' && allowance !== null && allowance < MaxUint256 / 2n;

  return (
    <div>
      <span>{tokenSymbol} Approval Status:</span>
      <span className={`approval-status ${getStatusClass()}`}>{getStatusText()}</span>
      {showApprovalButton && (
        <button
          onClick={handleApprove}
          disabled={isLoading || !signer || !userAddress}
          className="approve-button"
        >
          Approve Max {tokenSymbol}
        </button>
      )}
    </div>
  );
}

