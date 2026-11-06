import Link from "next/link";
import Image from "next/image";

export function BrandLogo({
  className = "",
  size = "md",
  showTagline = false,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
}) {
  const iconSize = size === "sm" ? 32 : size === "lg" ? 48 : 40;
  return (
    <Link href="/" aria-label="Janus home" className={`relay-logo ${className}`}>
      <span
        style={{
          width: iconSize,
          height: iconSize,
          borderRadius: "50%",
          background: "#ffffff",
          display: "grid",
          placeItems: "center",
          boxShadow: "0 4px 14px rgba(0, 0, 0, 0.16)",
          flexShrink: 0,
          transition: "transform 0.2s ease",
        }}
      >
        <Image
          src="/assets/logo.webp"
          alt="Janus"
          width={iconSize}
          height={iconSize}
          style={{ width: "72%", height: "72%", objectFit: "contain" }}
          unoptimized
        />
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <strong style={{ fontSize: size === "lg" ? "20px" : "17px", fontWeight: 700, letterSpacing: "-0.5px", color: "#ffffff" }}>
          janus
        </strong>
        {showTagline && (
          <small style={{ fontSize: "9px", letterSpacing: "1px", textTransform: "uppercase", color: "#8e8e8e" }}>
            AGENT PAYMENT INFRASTRUCTURE
          </small>
        )}
      </span>
    </Link>
  );
}
