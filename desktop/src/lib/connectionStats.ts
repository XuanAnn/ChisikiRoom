export type ConnectionDetails = {
  route: 'direct' | 'relay' | 'unknown';
  protocol?: string;
  relayProtocol?: string;
  roundTripMs?: number;
};

type CandidateStatistics = RTCStats & {
  candidateType?: string;
  protocol?: string;
  relayProtocol?: string;
};

// Only report the pair selected by a transport, not an arbitrary successful check.
export function summarizeConnection(report: RTCStatsReport): ConnectionDetails {
  let selectedPair: RTCIceCandidatePairStats | undefined;
  const entries = new Map<string, RTCStats>();
  report.forEach((entry, id) => entries.set(id, entry));

  report.forEach((entry) => {
    if (entry.type === 'transport' && entry.selectedCandidatePairId) {
      const candidatePair = entries.get(entry.selectedCandidatePairId);
      if (candidatePair?.type === 'candidate-pair') {
        selectedPair = candidatePair as RTCIceCandidatePairStats;
      }
    }
  });

  if (!selectedPair) {
    return { route: 'unknown' };
  }

  const localCandidate = entries.get(selectedPair.localCandidateId) as
    CandidateStatistics | undefined;
  const remoteCandidate = entries.get(selectedPair.remoteCandidateId) as
    CandidateStatistics | undefined;
  const relayed =
    localCandidate?.candidateType === 'relay' || remoteCandidate?.candidateType === 'relay';
  const candidatesKnown = Boolean(localCandidate?.candidateType && remoteCandidate?.candidateType);
  let route: ConnectionDetails['route'] = 'unknown';

  if (relayed) {
    route = 'relay';
  } else if (candidatesKnown) {
    route = 'direct';
  }

  let roundTripMs: number | undefined;
  const roundTripSeconds = selectedPair.currentRoundTripTime;
  if (
    typeof roundTripSeconds === 'number' &&
    Number.isFinite(roundTripSeconds) &&
    roundTripSeconds >= 0
  ) {
    roundTripMs = Math.round(roundTripSeconds * 1000);
  }

  return {
    route,
    protocol: localCandidate?.protocol,
    relayProtocol: localCandidate?.relayProtocol,
    roundTripMs,
  };
}
