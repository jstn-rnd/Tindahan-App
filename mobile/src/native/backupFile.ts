import { Capacitor, registerPlugin } from '@capacitor/core';

interface BackupFileResult {
  cancelled?: boolean;
  uri?: string;
  name?: string;
  data?: string;
}

interface BackupFilePlugin {
  saveBackup(options: { data: string; uri?: string; fileName: string }): Promise<BackupFileResult>;
  openBackup(): Promise<BackupFileResult>;
}

const BackupFile = registerPlugin<BackupFilePlugin>('BackupFile');

function requireAndroid(): void {
  if (Capacitor.getPlatform() !== 'android') {
    throw new Error('Single-file backup is currently available in the installed Android app.');
  }
}

export async function saveBackupFile(data: string, uri?: string): Promise<BackupFileResult> {
  requireAndroid();
  return BackupFile.saveBackup({ data, uri, fileName: 'ACDC-backup.json' });
}

export async function openBackupFile(): Promise<BackupFileResult> {
  requireAndroid();
  return BackupFile.openBackup();
}
