import { ImageResponse } from '@vercel/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
    try {
        const { appName, tagline, iconUrl, buildNumber } = await req.json()

        // Generate build number if not provided
        const buildNum = buildNumber || String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')

        const imageResponse = new ImageResponse(
            (
                <div
                    style={{
                        width: '1200px',
                        height: '675px',
                        display: 'flex',
                        flexDirection: 'column',
                        background: 'linear-gradient(135deg, #1a0a2e 0%, #16082a 50%, #0f0520 100%)',
                        fontFamily: 'sans-serif',
                        position: 'relative',
                        overflow: 'hidden',
                    }}
                >
                    {/* Grid overlay */}
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundImage: 'linear-gradient(rgba(168, 85, 247, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(168, 85, 247, 0.03) 1px, transparent 1px)',
                            backgroundSize: '40px 40px',
                        }}
                    />

                    {/* Glow effects */}
                    <div
                        style={{
                            position: 'absolute',
                            width: '600px',
                            height: '600px',
                            background: 'radial-gradient(circle, rgba(255, 149, 0, 0.15) 0%, transparent 70%)',
                            top: '-200px',
                            left: '-100px',
                        }}
                    />
                    <div
                        style={{
                            position: 'absolute',
                            width: '500px',
                            height: '500px',
                            background: 'radial-gradient(circle, rgba(236, 72, 153, 0.1) 0%, transparent 70%)',
                            bottom: '-150px',
                            right: '-100px',
                        }}
                    />

                    {/* Header badge */}
                    <div
                        style={{
                            position: 'absolute',
                            top: '32px',
                            left: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                        }}
                    >
                        <div
                            style={{
                                background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                                color: 'white',
                                padding: '8px 16px',
                                borderRadius: '100px',
                                fontSize: '14px',
                                fontWeight: 800,
                                letterSpacing: '0.5px',
                                display: 'flex',
                                alignItems: 'center',
                            }}
                        >
                            AI FLEET
                        </div>
                        <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px', fontWeight: 600 }}>
                            BUILD #{buildNum}
                        </span>
                    </div>

                    {/* Main content */}
                    <div
                        style={{
                            position: 'absolute',
                            top: '100px',
                            left: '40px',
                            right: '40px',
                            bottom: '40px',
                            display: 'flex',
                            gap: '60px',
                        }}
                    >
                        {/* Left: App Info */}
                        <div
                            style={{
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                            }}
                        >
                            {/* App header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '16px' }}>
                                {/* App icon */}
                                <div
                                    style={{
                                        width: '80px',
                                        height: '80px',
                                        borderRadius: '20px',
                                        background: iconUrl ? 'transparent' : 'linear-gradient(135deg, #ff9500, #ff6b9d)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 8px 32px rgba(255, 149, 0, 0.3)',
                                        overflow: 'hidden',
                                    }}
                                >
                                    {iconUrl ? (
                                        <img
                                            src={iconUrl}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            alt=""
                                        />
                                    ) : (
                                        <span style={{ fontSize: '36px', color: 'white', fontWeight: 800 }}>APP</span>
                                    )}
                                </div>
                                <div style={{ fontSize: '42px', fontWeight: 900, color: 'white', lineHeight: 1.1 }}>
                                    {appName || 'APP NAME'}
                                </div>
                            </div>

                            {/* Tagline */}
                            <div
                                style={{
                                    fontSize: '20px',
                                    color: 'rgba(255, 255, 255, 0.7)',
                                    lineHeight: 1.5,
                                    marginBottom: '32px',
                                    maxWidth: '500px',
                                }}
                            >
                                {tagline || 'Tagline text placeholder'}
                            </div>

                            {/* Staking CTA */}
                            <div
                                style={{
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '16px',
                                    padding: '20px 24px',
                                    marginBottom: '24px',
                                    maxWidth: '400px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 700, color: '#22c55e', marginBottom: '6px' }}>
                                    Stake ETH or USDC to fund development
                                </div>
                                <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.5)' }}>
                                    Deposit → Yield → Apps → Revenue → Vault → Growth
                                </div>
                            </div>

                            {/* Footer */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div
                                    style={{
                                        background: 'linear-gradient(135deg, #ff9500, #ff6b9d)',
                                        color: 'white',
                                        padding: '14px 28px',
                                        borderRadius: '100px',
                                        fontSize: '16px',
                                        fontWeight: 800,
                                        boxShadow: '0 8px 24px rgba(255, 149, 0, 0.3)',
                                    }}
                                >
                                    Try Free →
                                </div>
                                <span style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '14px', fontWeight: 600 }}>
                                    https://www.getsuite.app/apps
                                </span>
                            </div>
                        </div>

                        {/* Right: Screenshots placeholder */}
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'flex-end' }}>
                            <div
                                style={{
                                    width: '190px',
                                    height: '380px',
                                    borderRadius: '24px',
                                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
                                    border: '2px solid rgba(255, 255, 255, 0.1)',
                                    boxShadow: '0 16px 48px rgba(0, 0, 0, 0.3)',
                                }}
                            />
                            <div
                                style={{
                                    width: '190px',
                                    height: '380px',
                                    borderRadius: '24px',
                                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
                                    border: '2px solid rgba(255, 255, 255, 0.1)',
                                    boxShadow: '0 16px 48px rgba(0, 0, 0, 0.3)',
                                    transform: 'translateY(-20px)',
                                }}
                            />
                            <div
                                style={{
                                    width: '190px',
                                    height: '380px',
                                    borderRadius: '24px',
                                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
                                    border: '2px solid rgba(255, 255, 255, 0.1)',
                                    boxShadow: '0 16px 48px rgba(0, 0, 0, 0.3)',
                                    transform: 'translateY(10px)',
                                }}
                            />
                        </div>
                    </div>

                    {/* SUITE Logo */}
                    <div
                        style={{
                            position: 'absolute',
                            bottom: '32px',
                            right: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            padding: '8px 16px',
                            borderRadius: '100px',
                        }}
                    >
                        <span style={{ color: 'white', fontWeight: 800, fontSize: '14px' }}>SUITE</span>
                    </div>
                </div>
            ),
            {
                width: 1200,
                height: 675,
            }
        )

        // Convert to base64
        const arrayBuffer = await imageResponse.arrayBuffer()
        const base64 = Buffer.from(arrayBuffer).toString('base64')

        return Response.json({
            imageBase64: `data:image/png;base64,${base64}`,
            buildNumber: buildNum,
            success: true
        })

    } catch (error) {
        console.error('Error generating image:', error)
        return Response.json(
            { error: 'Failed to generate image', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}
