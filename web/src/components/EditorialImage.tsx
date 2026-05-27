import Image from "next/image";
import { ReactNode } from "react";

type OverlayPosition = "left" | "bottom-left" | "bottom-right" | "center";
type OverlayTone = "ink" | "paper";

interface EditorialImageProps {
  src: string;
  alt: string;
  /** Number from 0 to 1 — what fraction of viewport height the image fills. Default 0.65 */
  heightRatio?: number;
  /** Object position for the image (e.g. "center", "top", "right"). */
  position?: string;
  /** Overlay content positioned on the image. */
  overlay?: ReactNode;
  /** Where the overlay sits. Default "bottom-left". */
  overlayPosition?: OverlayPosition;
  /** Text colour. "ink" = dark text on the light area of the image. "paper" = cream text with a soft dark scrim. */
  overlayTone?: OverlayTone;
}

const POSITION_CLASS: Record<OverlayPosition, string> = {
  left: "left-0 top-0 bottom-0 flex items-center pl-6 md:pl-12",
  "bottom-left": "left-0 bottom-0 right-0 md:right-auto pl-6 md:pl-12 pb-8 md:pb-12 flex items-end",
  "bottom-right": "right-0 bottom-0 pr-6 md:pr-12 pb-8 md:pb-12 flex items-end",
  center:
    "inset-0 flex items-center justify-center text-center px-6",
};

export function EditorialImage({
  src,
  alt,
  heightRatio = 0.65,
  position = "center",
  overlay,
  overlayPosition = "bottom-left",
  overlayTone = "paper",
}: EditorialImageProps) {
  const heightStyle = { height: `${Math.round(heightRatio * 100)}vh`, minHeight: "360px" };
  const toneClass =
    overlayTone === "ink" ? "text-ink" : "text-paper";

  return (
    <figure className="relative w-full overflow-hidden" style={heightStyle}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes="100vw"
        style={{ objectFit: "cover", objectPosition: position }}
        priority={false}
      />

      {overlay && (
        <div className={`absolute ${POSITION_CLASS[overlayPosition]} ${toneClass}`}>
          <div className="max-w-[640px]">{overlay}</div>
        </div>
      )}
    </figure>
  );
}
