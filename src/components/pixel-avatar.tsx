import { cn } from "@/lib/utils";
import {
  normalizePixelAvatarColor,
  normalizePixelAvatarId,
  pixelAvatarLabels,
  type PixelAvatarId,
} from "@/lib/pixel-avatars";

type PixelAvatarProps = {
  avatarId?: string | null;
  color?: string | null;
  label?: string | null;
  className?: string;
};

export function PixelAvatar({
  avatarId,
  color,
  label,
  className,
}: PixelAvatarProps) {
  const id = normalizePixelAvatarId(avatarId);
  const avatarColor = normalizePixelAvatarColor(color);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted text-foreground",
        className,
      )}
      aria-label={label ?? pixelAvatarLabels[id]}
      role="img"
    >
      <svg viewBox="0 0 16 16" className="size-full" shapeRendering="crispEdges">
        {renderAvatar(id, avatarColor)}
      </svg>
    </span>
  );
}

function P({
  x,
  y,
  w = 1,
  h = 1,
  fill,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  fill: string;
}) {
  return <rect x={x} y={y} width={w} height={h} fill={fill} />;
}

function renderAvatar(id: PixelAvatarId, color: string) {
  const ink = "#111827";
  const light = mixHex(color, "#ffffff", 0.54);
  const shadow = mixHex(color, "#000000", 0.24);
  const page = "#f8fafc";

  if (id === "cat") {
    return (
      <>
        <P x={3} y={3} fill={color} />
        <P x={4} y={4} fill={color} />
        <P x={11} y={3} fill={color} />
        <P x={10} y={4} fill={color} />
        <P x={4} y={5} w={8} h={7} fill={color} />
        <P x={5} y={6} w={6} h={1} fill={light} />
        <P x={6} y={8} fill={ink} />
        <P x={10} y={8} fill={ink} />
        <P x={8} y={9} fill={shadow} />
        <P x={6} y={11} w={5} fill={shadow} />
      </>
    );
  }

  if (id === "dog") {
    return (
      <>
        <P x={3} y={5} w={2} h={5} fill={shadow} />
        <P x={11} y={5} w={2} h={5} fill={shadow} />
        <P x={5} y={4} w={6} h={7} fill={color} />
        <P x={6} y={5} w={4} h={1} fill={light} />
        <P x={6} y={8} fill={ink} />
        <P x={10} y={8} fill={ink} />
        <P x={7} y={10} w={3} h={2} fill={shadow} />
        <P x={8} y={10} fill={ink} />
      </>
    );
  }

  if (id === "wizard") {
    return (
      <>
        <P x={7} y={1} w={2} h={1} fill={shadow} />
        <P x={6} y={2} w={4} h={2} fill={color} />
        <P x={5} y={4} w={6} h={1} fill={shadow} />
        <P x={4} y={5} w={8} h={1} fill={color} />
        <P x={5} y={6} w={6} h={5} fill={light} />
        <P x={6} y={8} fill={ink} />
        <P x={10} y={8} fill={ink} />
        <P x={7} y={11} w={3} h={3} fill={color} />
        <P x={3} y={12} w={10} h={1} fill={shadow} />
      </>
    );
  }

  if (id === "owl") {
    return (
      <>
        <P x={4} y={3} w={8} h={8} fill={color} />
        <P x={3} y={5} w={1} h={3} fill={shadow} />
        <P x={12} y={5} w={1} h={3} fill={shadow} />
        <P x={5} y={6} w={3} h={3} fill={page} />
        <P x={9} y={6} w={3} h={3} fill={page} />
        <P x={6} y={7} fill={ink} />
        <P x={10} y={7} fill={ink} />
        <P x={8} y={9} fill={shadow} />
        <P x={6} y={12} w={1} h={1} fill={shadow} />
        <P x={10} y={12} w={1} h={1} fill={shadow} />
      </>
    );
  }

  if (id === "robot") {
    return (
      <>
        <P x={7} y={2} w={2} h={2} fill={shadow} />
        <P x={4} y={4} w={8} h={8} fill={color} />
        <P x={5} y={5} w={6} h={1} fill={light} />
        <P x={6} y={7} fill={ink} />
        <P x={10} y={7} fill={ink} />
        <P x={6} y={10} w={5} h={1} fill={shadow} />
        <P x={3} y={6} w={1} h={3} fill={shadow} />
        <P x={12} y={6} w={1} h={3} fill={shadow} />
      </>
    );
  }

  return (
    <>
      <P x={3} y={8} w={4} h={4} fill={page} />
      <P x={9} y={8} w={4} h={4} fill={page} />
      <P x={7} y={9} w={2} h={3} fill={shadow} />
      <P x={4} y={7} w={3} h={1} fill={shadow} />
      <P x={9} y={7} w={3} h={1} fill={shadow} />
      <P x={5} y={4} w={6} h={3} fill={color} />
      <P x={4} y={5} fill={color} />
      <P x={11} y={5} fill={color} />
      <P x={6} y={5} fill={ink} />
      <P x={10} y={5} fill={ink} />
      <P x={8} y={6} fill={shadow} />
      <P x={5} y={12} w={6} h={1} fill={color} />
    </>
  );
}

function mixHex(base: string, overlay: string, amount: number) {
  const baseRgb = hexToRgb(base);
  const overlayRgb = hexToRgb(overlay);
  const mixed = baseRgb.map((channel, index) => {
    const overlayChannel = overlayRgb[index] ?? channel;

    return Math.round(channel * (1 - amount) + overlayChannel * amount);
  });

  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}
