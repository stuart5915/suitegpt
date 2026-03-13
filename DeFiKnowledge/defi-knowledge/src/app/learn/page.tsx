'use client';

import Navbar from '@/components/Navbar';

export default function LearnPage() {

    return (
        <>
            <Navbar />
            <div style={{ minHeight: '100vh', background: '#0a0a0f', padding: '100px 20px 40px 20px', color: '#f1f5f9' }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    <h1 style={{ fontSize: '36px', marginBottom: '16px' }}>📚 Learn DeFi</h1>
                    <p style={{ fontSize: '18px', color: '#64748b', marginBottom: '40px' }}>
                        Educational content coming soon - guides, tutorials, and DeFi concepts explained.
                    </p>
                    <div style={{ background: 'linear-gradient(135deg, #1e1e2f 0%, #2d2d44 100%)', border: '1px solid #3d3d5c', borderRadius: '16px', padding: '48px', textAlign: 'center' }}>
                        <span style={{ fontSize: '64px', display: 'block', marginBottom: '16px' }}>🚧</span>
                        <p style={{ color: '#94a3b8' }}>This section is under construction</p>
                    </div>
                </div>
            </div>
        </>
    );
}
