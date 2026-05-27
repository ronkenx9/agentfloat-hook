"use client";

import { useState } from "react";
import { useWallet } from "@/lib/wallet";
import { postReject } from "@/lib/api";

export function RejectButton({ proposalId }: { proposalId: string }) {
  const wallet = useWallet();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return <span className="mono text-[10px] uppercase text-ink-faint">Rejected · refresh to update view</span>;
  }

  const onReject = async () => {
    setError(null);
    if (!wallet.address) {
      await wallet.connect();
      return;
    }

    setSubmitting(true);
    const signed = await wallet.signSiwe(`Reject AgentFloat proposal ${proposalId}`);
    if (!signed) {
      setSubmitting(false);
      setError("Signature cancelled");
      return;
    }

    const result = await postReject(proposalId, signed.message, signed.signature, "Rejected via dashboard");
    setSubmitting(false);

    if (result.ok) {
      setDone(true);
    } else {
      setError(result.error || "Reject failed");
    }
  };

  return (
    <>
      <button
        onClick={onReject}
        disabled={submitting}
        className="mono uppercase text-ink-soft hover:text-accent disabled:opacity-50"
      >
        {submitting ? "Signing…" : wallet.address ? "Reject" : "Connect to reject"}
      </button>
      {error && <span className="mono text-[10px] text-accent ml-2">{error}</span>}
    </>
  );
}
