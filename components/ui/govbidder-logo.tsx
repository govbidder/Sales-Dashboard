"use client"

interface LogoProps {
  /** "horizontal" = inline para topbar. "stack" = apilado para login. */
  variant?: "horizontal" | "stack"
  className?: string
}

/**
 * Logo tipográfico de GovBidder.
 * Solo texto — el wordmark "GOVBIDDER" en navy + tagline "The Bid That Wins"
 * en rojo cursiva. No depende de archivos externos.
 *
 * Para usar la imagen oficial del águila, guardá el PNG/SVG en
 * public/govbidder-logo.png y reemplazá este componente por <Image>.
 */
export function GovBidderLogo({ variant = "horizontal", className = "" }: LogoProps) {
  if (variant === "stack") {
    return (
      <div className={`flex flex-col items-center leading-none ${className}`}>
        <div className="text-[34px] font-black tracking-[0.10em] text-[#1e3a8a]">
          GOVBIDDER
        </div>
        <div className="mt-2 text-[16px] italic font-semibold text-[#E42D2C]" style={{ fontFamily: '"Brush Script MT", "Lucida Handwriting", cursive' }}>
          The Bid That Wins
        </div>
      </div>
    )
  }

  // horizontal — para topbar
  return (
    <div className={`flex flex-col leading-none ${className}`}>
      <span className="text-[16px] font-black tracking-[0.06em] text-[#1e3a8a]">
        GOVBIDDER
      </span>
      <span className="text-[10px] italic font-semibold text-[#E42D2C] mt-0.5" style={{ fontFamily: '"Brush Script MT", "Lucida Handwriting", cursive' }}>
        The Bid That Wins
      </span>
    </div>
  )
}
