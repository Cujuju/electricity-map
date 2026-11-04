export {};
declare global {
  interface Window {
    electricityDesktop?: {
      platform: string;
      minimize(): void;
      toggleMaximize(): void;
      close(): void;
      showMenu(): void;
      getWindowState(): Promise<{ maximized: boolean }>;
      getAppIcon(): Promise<'blue' | 'purple'>;
      setAppIcon(icon: 'blue' | 'purple'): Promise<'blue' | 'purple'>;
      onMaximized(callback: (maximized: boolean) => void): () => void;
    };
  }
}
