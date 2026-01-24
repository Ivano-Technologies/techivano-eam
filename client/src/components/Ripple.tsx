interface RippleProps {
  ripples: Array<{
    x: number;
    y: number;
    size: number;
    id: number;
  }>;
}

export function Ripple({ ripples }: RippleProps) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-lg">
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="absolute animate-ripple"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0) 70%)',
          }}
        />
      ))}
    </div>
  );
}
