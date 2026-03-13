interface ScoreOverlayProps {
  score: number;
}

export function ScoreOverlay({ score }: ScoreOverlayProps) {
  return (
    <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none select-none">
      <div className="text-center pt-4">
        <span className="text-white text-5xl font-bold drop-shadow-lg"
              style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
          {score}
        </span>
      </div>
    </div>
  );
}
