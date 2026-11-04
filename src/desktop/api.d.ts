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
      onMaximized(callback: (maximized: boolean) => void): () => void;
    };
  }
}
