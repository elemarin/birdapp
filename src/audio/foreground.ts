type AppStateSource = {
  currentState: string | null;
  addEventListener(event: 'change', listener: (state: string) => void): { remove(): void };
};

export function shouldPauseRecording(state: string, active: boolean, starting: boolean, requestingPermission: boolean) {
  return state !== 'active' && (active || (starting && !requestingPermission));
}

export async function requestForegroundRecordingPermission(
  appState: AppStateSource,
  requestPermission: () => Promise<string>,
  timeoutMs = 5000,
) {
  const permission = await requestPermission();
  if (permission !== 'Granted' || appState.currentState === 'active') return permission;

  await new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timeout);
      subscription.remove();
      if (error) reject(error);
      else resolve();
    };
    const timeout = setTimeout(() => {
      finish(new Error('Return to Birdsong and tap the microphone again.'));
    }, timeoutMs);
    const subscription = appState.addEventListener('change', (state) => {
      if (state === 'active') finish();
    });
    if (appState.currentState === 'active') finish();
  });
  return permission;
}
