export function NarrowScreenGate() {
  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-black text-white px-6 text-center gap-6">
      <img
        src="/assets/branding/flappy-frontier-logo.png"
        alt="Flappy Frontier"
        className="w-24 h-24 rounded-xl"
      />
      <h1 className="text-xl font-bold">Flappy Frontier</h1>
      <p className="text-gray-400 text-sm max-w-xs leading-relaxed">
        Flappy Frontier is designed for desktop browsers and the EVE Frontier
        in-game client.
      </p>
      <p className="text-gray-500 text-xs max-w-xs">
        Open this page on a wider screen to play.
      </p>
      <a
        href="https://flappy-frontier.pages.dev/"
        className="text-blue-400 text-xs underline"
      >
        flappy-frontier.pages.dev
      </a>
    </div>
  );
}
