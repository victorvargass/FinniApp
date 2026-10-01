export type BackupOperation = 'backup' | 'restore';

export type BackupStage =
  | 'preparing'
  | 'encrypting'
  | 'uploading'
  | 'downloading'
  | 'decrypting'
  | 'validating'
  | 'replacing'
  | 'finalizing';

export type BackupProgress = {
  operation: BackupOperation;
  stage: BackupStage;
  progress: number;
  startedAt: number;
};

export type BackupStageTiming = {
  stage: BackupStage;
  durationMs: number;
};

export type BackupOperationMetrics = {
  operation: BackupOperation;
  totalDurationMs: number;
  stages: BackupStageTiming[];
};

export type BackupProgressListener = (progress: BackupProgress) => void;

export function createBackupOperationTracker(
  operation: BackupOperation,
  onProgress?: BackupProgressListener
) {
  const startedAt = Date.now();
  let stageStartedAt = startedAt;
  let currentStage: BackupStage | null = null;
  const stages: BackupStageTiming[] = [];

  return {
    start(stage: BackupStage, progress: number) {
      const now = Date.now();
      if (currentStage) {
        stages.push({ stage: currentStage, durationMs: now - stageStartedAt });
      }
      currentStage = stage;
      stageStartedAt = now;
      onProgress?.({ operation, stage, progress, startedAt });
    },
    finish(): BackupOperationMetrics {
      const now = Date.now();
      if (currentStage) {
        stages.push({ stage: currentStage, durationMs: now - stageStartedAt });
      }
      return { operation, totalDurationMs: now - startedAt, stages };
    },
  };
}
