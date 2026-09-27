import { Capacitor, registerPlugin } from '@capacitor/core';

interface GoogleDriveResult {
  cancelled?: boolean;
  email?: string;
  fileId?: string;
  name?: string;
  data?: string;
}

interface GoogleDriveBackupPlugin {
  verifyEmail(options: { email: string }): Promise<GoogleDriveResult>;
  removeAccount(options: { email: string }): Promise<void>;
  saveBackup(options: { email: string; data: string; fileId?: string }): Promise<GoogleDriveResult>;
  openBackup(options: { email: string; fileId?: string }): Promise<GoogleDriveResult>;
}

const GoogleDriveBackup = registerPlugin<GoogleDriveBackupPlugin>('GoogleDriveBackup');

function requireAndroid(): void {
  if (Capacitor.getPlatform() !== 'android') {
    throw new Error('Google Drive backup is currently available in the installed Android app.');
  }
}

export async function verifyGoogleDriveEmail(email: string): Promise<GoogleDriveResult> {
  requireAndroid();
  return GoogleDriveBackup.verifyEmail({ email });
}

export async function removeGoogleDriveAccount(email: string): Promise<void> {
  requireAndroid();
  return GoogleDriveBackup.removeAccount({ email });
}

export async function saveGoogleDriveBackup(
  email: string,
  data: string,
  fileId?: string,
): Promise<GoogleDriveResult> {
  requireAndroid();
  return GoogleDriveBackup.saveBackup({ email, data, fileId });
}

export async function openGoogleDriveBackup(email: string, fileId?: string): Promise<GoogleDriveResult> {
  requireAndroid();
  return GoogleDriveBackup.openBackup({ email, fileId });
}
