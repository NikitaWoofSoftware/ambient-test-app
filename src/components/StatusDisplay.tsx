/*****************************
 * FILE: src/components/StatusDisplay.tsx
 *****************************/
import React from 'react';

interface StatusDisplayProps {
  status: string;
  error: string | null; // Pass SDK error separately
}

export function StatusDisplay({ status, error }: StatusDisplayProps) {
  const isError = status.toLowerCase().includes('error') || status.toLowerCase().includes('failed') || !!error;
  const isSuccess = status.toLowerCase().includes('successful') || status.toLowerCase().includes('success!');

  const statusClassName = isError ? 'error' : isSuccess ? 'success' : '';

  return (
    <div className={`status-box ${statusClassName}`}>
      <strong>Status:</strong> {status}
      {error && <><br /><strong>SDK Error:</strong> {error}</>}
    </div>
  );
}
