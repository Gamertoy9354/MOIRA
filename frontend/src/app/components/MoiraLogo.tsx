import { useEffect, useRef } from 'react';

interface MoiraLogoProps {
    size?: number;
    showText?: boolean;
    className?: string;
    animate?: boolean;
}

export function MoiraLogo({ size = 40, showText = false, className = '', animate = true }: MoiraLogoProps) {
    const svgRef = useRef<SVGSVGElement>(null);

    return (
        <div className={`flex items-center gap-2.5 ${className}`}>
            <svg
                ref={svgRef}
                width={size}
                height={size}
                viewBox="0 0 80 80"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={animate ? { animation: 'logoBreath 3s ease-in-out infinite' } : {}}
            >
                <defs>
                    {/* Gold gradient */}
                    <linearGradient id="moira-gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%"   stopColor="#E8D5A3" />
                        <stop offset="40%"  stopColor="#C8A96E" />
                        <stop offset="80%"  stopColor="#8A7048" />
                        <stop offset="100%" stopColor="#C8A96E" />
                    </linearGradient>
                    {/* Purple gradient */}
                    <linearGradient id="moira-purple-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%"   stopColor="#8B35D6" />
                        <stop offset="100%" stopColor="#4A0E8F" />
                    </linearGradient>
                    {/* Glow filter */}
                    <filter id="moira-glow" x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="2.5" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                    <filter id="moira-glow-strong" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                    {/* Radial glow */}
                    <radialGradient id="moira-inner-glow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%"   stopColor="#4A0E8F" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#080610" stopOpacity="0" />
                    </radialGradient>
                </defs>

                {/* Background glow disc */}
                <circle cx="40" cy="40" r="36" fill="url(#moira-inner-glow)" />

                {/* Outer ring — spinning slowly */}
                <g style={animate ? { animation: 'threadSpin 18s linear infinite', transformOrigin: '40px 40px' } : {}}>
                    <circle cx="40" cy="40" r="34" stroke="url(#moira-gold-grad)" strokeWidth="0.6" strokeDasharray="4 6" opacity="0.5" fill="none" />
                </g>

                {/* Middle ring — counter-spinning */}
                <g style={animate ? { animation: 'threadSpinReverse 12s linear infinite', transformOrigin: '40px 40px' } : {}}>
                    <circle cx="40" cy="40" r="27" stroke="url(#moira-gold-grad)" strokeWidth="0.9" strokeDasharray="8 4" opacity="0.35" fill="none" />
                </g>

                {/* Solid outer arc — decorative */}
                <circle cx="40" cy="40" r="34" stroke="#C8A96E" strokeWidth="1.2" strokeDasharray="50 164" strokeDashoffset="0" fill="none" opacity="0.7" />
                <circle cx="40" cy="40" r="34" stroke="#4A0E8F" strokeWidth="1.2" strokeDasharray="50 164" strokeDashoffset="107" fill="none" opacity="0.5" />

                {/* The Omega Ω shape — central fate symbol */}
                <g filter="url(#moira-glow)">
                    {/* Main Omega arc */}
                    <path
                        d="M24 47 C24 35 30 27 40 27 C50 27 56 35 56 47 L52 47 C52 37 47 31 40 31 C33 31 28 37 28 47 L24 47 Z"
                        fill="url(#moira-gold-grad)"
                        opacity="0.9"
                    />
                    {/* Omega feet */}
                    <rect x="22" y="49" width="10" height="3" rx="1.5" fill="url(#moira-gold-grad)" opacity="0.85" />
                    <rect x="48" y="49" width="10" height="3" rx="1.5" fill="url(#moira-gold-grad)" opacity="0.85" />
                    {/* Inner cutout — hollow Omega */}
                    <path
                        d="M30 47 C30 38 34 33 40 33 C46 33 50 38 50 47 L46 47 C46 40 43.5 36.5 40 36.5 C36.5 36.5 34 40 34 47 L30 47 Z"
                        fill="#080610"
                    />
                </g>

                {/* Central dot */}
                <circle cx="40" cy="20" r="2.5" fill="#C8A96E" filter="url(#moira-glow)" opacity="0.8" />

                {/* Three fate thread dots at 120° intervals */}
                <g style={animate ? { animation: 'threadSpin 8s linear infinite', transformOrigin: '40px 40px' } : {}}>
                    <circle cx="40" cy="7" r="1.8" fill="#E8D5A3" opacity="0.6" />
                    <circle cx="62.5" cy="51.5" r="1.8" fill="#C8A96E" opacity="0.5" />
                    <circle cx="17.5" cy="51.5" r="1.8" fill="#8A7048" opacity="0.5" />
                </g>

                {/* Inner purple glow circle */}
                <circle cx="40" cy="40" r="18" stroke="url(#moira-purple-grad)" strokeWidth="0.5" fill="none" opacity="0.4" />
            </svg>

            {showText && (
                <div className="flex flex-col leading-none">
                    <span
                        className="font-cinzel font-bold tracking-[0.15em] uppercase"
                        style={{
                            fontSize: size > 36 ? '1.25rem' : '0.875rem',
                            background: 'linear-gradient(135deg, #E8D5A3 0%, #C8A96E 50%, #8A7048 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                        }}
                    >
                        MOIRA
                    </span>
                    {size > 36 && (
                        <span
                            className="font-cinzel tracking-[0.08em] uppercase"
                            style={{ fontSize: '0.52rem', color: 'rgba(200,169,110,0.45)', letterSpacing: '0.2em' }}
                        >
                            Fate Engine
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
