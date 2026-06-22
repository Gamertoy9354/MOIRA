export function MeshBackground() {
    return (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden>
            {/* Void base */}
            <div className="absolute inset-0" style={{ background: '#080610' }} />

            {/* Deep purple orb — top left */}
            <div
                className="absolute mesh-orb-1 rounded-full"
                style={{
                    top: '-10%', left: '-8%',
                    width: '55vw', height: '55vw',
                    background: 'radial-gradient(circle at center, rgba(74,14,143,0.38) 0%, rgba(74,14,143,0.06) 60%, transparent 80%)',
                    filter: 'blur(70px)',
                }}
            />

            {/* Gold accent orb — top right */}
            <div
                className="absolute mesh-orb-2 rounded-full"
                style={{
                    top: '-15%', right: '-12%',
                    width: '50vw', height: '50vw',
                    background: 'radial-gradient(circle at center, rgba(200,169,110,0.15) 0%, rgba(200,169,110,0.03) 55%, transparent 75%)',
                    filter: 'blur(80px)',
                }}
            />

            {/* Deep purple orb — bottom right */}
            <div
                className="absolute mesh-orb-3 rounded-full"
                style={{
                    bottom: '-15%', right: '-10%',
                    width: '45vw', height: '45vw',
                    background: 'radial-gradient(circle at center, rgba(107,31,191,0.28) 0%, rgba(74,14,143,0.05) 60%, transparent 80%)',
                    filter: 'blur(65px)',
                }}
            />

            {/* Gold accent — bottom left */}
            <div
                className="absolute mesh-orb-4 rounded-full"
                style={{
                    bottom: '-5%', left: '-8%',
                    width: '40vw', height: '40vw',
                    background: 'radial-gradient(circle at center, rgba(200,169,110,0.1) 0%, rgba(74,14,143,0.04) 50%, transparent 70%)',
                    filter: 'blur(75px)',
                }}
            />

            {/* Center ambient glow */}
            <div
                className="absolute"
                style={{
                    top: '25%', left: '30%',
                    width: '40vw', height: '40vw',
                    background: 'radial-gradient(circle at center, rgba(74,14,143,0.1) 0%, transparent 65%)',
                    filter: 'blur(90px)',
                }}
            />

            {/* Fine noise grain overlay */}
            <div
                className="absolute inset-0"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'repeat',
                    backgroundSize: '200px 200px',
                    opacity: 0.5,
                    mixBlendMode: 'overlay',
                }}
            />
        </div>
    );
}
