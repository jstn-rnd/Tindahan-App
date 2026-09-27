import { copyFile, mkdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const mobileDirectory = resolve(scriptDirectory, '..');
const source = resolve(mobileDirectory, 'android/app/build/outputs/apk/debug/app-debug.apk');
const destination = resolve(mobileDirectory, '../android/ACDC.apk');

await stat(source);
await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
console.log(`Copied APK to ${destination}`);
