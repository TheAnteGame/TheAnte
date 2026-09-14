import Image from "next/image";

// The wordmark, in the right colour for the ground it sits on. The dark site (the
// default) shows the white wordmark from /logo.png; the light site shows the black
// wordmark from /logo-on-light.png. Both are the owner's own files from
// assets/ante logo/ ("Colored White" and "Colored Black"), same ring, same size.
// Light exists only under [data-theme="light"] (D-061), so the swap is one CSS rule
// pair in globals.css — no client code, no flash.

export function Logo({
  alt,
  width,
  height,
  className,
  priority,
}: {
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <>
      <Image src="/logo.png" alt={alt} width={width} height={height} className={`logo-for-dark ${className ?? ""}`} priority={priority} />
      <Image src="/logo-on-light.png" alt={alt} width={width} height={height} className={`logo-for-light ${className ?? ""}`} priority={priority} />
    </>
  );
}
