export interface InputState {
  pendingFlap: boolean;
}

export function createInputHandler(canvas: HTMLCanvasElement): {
  state: InputState;
  cleanup: () => void;
} {
  const state: InputState = { pendingFlap: false };

  function handleFlap(e: Event) {
    e.preventDefault();
    state.pendingFlap = true;
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'Enter') {
      e.preventDefault();
      state.pendingFlap = true;
    }
  }

  canvas.addEventListener('mousedown', handleFlap);
  document.addEventListener('keydown', handleKeyDown);

  return {
    state,
    cleanup() {
      canvas.removeEventListener('mousedown', handleFlap);
      document.removeEventListener('keydown', handleKeyDown);
    },
  };
}
