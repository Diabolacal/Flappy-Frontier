interface ReadyOverlayProps {
  isVisible: boolean;
}

export function ReadyOverlay({ isVisible }: ReadyOverlayProps) {
  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
      <div className="text-center">
        <div className="text-white text-xl font-bold mb-2 animate-pulse"
             style={{ textShadow: '1px 1px 3px rgba(0,0,0,0.8)' }}>
          Click or press Space
        </div>
        <div className="text-gray-400 text-sm">to start</div>
      </div>
    </div>
  );
}
