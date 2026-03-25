import * as os from 'node:os';
import { exec } from 'node:child_process';

export function openFile(filePath: string): void {
  const platform = os.platform();
  let cmd: string;

  if (platform === 'win32') {
    cmd = `start "" "${filePath}"`;
  } else if (platform === 'darwin') {
    cmd = `open "${filePath}"`;
  } else {
    cmd = `xdg-open "${filePath}"`;
  }

  exec(cmd, (_err) => {
    // Silently fail — not critical
  });
}
