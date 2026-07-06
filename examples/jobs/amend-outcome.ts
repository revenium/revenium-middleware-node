import 'dotenv/config';
import {
  reportJobOutcome,
  amendJobOutcome,
  getJobOutcomeHistory,
  OutcomeAlreadyReportedError,
  OutcomeNotReportedError,
  OutcomeAmendConflictError,
} from '@revenium/middleware';

async function main() {
  const jobId = 'loan-app-12345';

  const job = await reportJobOutcome(jobId, {
    executionStatus: 'SUCCESS',
    outcomeType: 'CONVERTED',
    outcomeValue: 150.00,
    outcomeCurrency: 'USD',
    reportedBy: 'loan-processor',
  });
  console.log('Initial outcome reported:', job.agenticJobId);

  try {
    await reportJobOutcome(jobId, { executionStatus: 'SUCCESS' });
  } catch (err) {
    if (err instanceof OutcomeAlreadyReportedError) {
      console.log(`Duplicate blocked: reported at ${err.reportedAt}, updates: ${err.updateCount}`);
    }
  }

  try {
    const updated = await amendJobOutcome(jobId, {
      reason: 'Customer churned 30 days after initial conversion',
      executionStatus: 'FAILED',
      outcomeValue: 0,
    });
    console.log('Outcome amended, update count:', updated.outcomeUpdateCount);
  } catch (err) {
    if (err instanceof OutcomeNotReportedError) {
      console.log('No outcome to amend');
    } else if (err instanceof OutcomeAmendConflictError) {
      console.log('Concurrent update, refetch and retry');
    }
  }

  const history = await getJobOutcomeHistory(jobId);
  for (const entry of history) {
    console.log(`#${entry.sequence}: ${entry.executionStatus} (${entry.reason ?? 'initial report'})`);
  }
}

main().catch(console.error);
