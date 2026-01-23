'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Link from 'next/link';

export default function ScenariosPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    if (status === 'unauthenticated') {
        router.push('/login');
        return null;
    }

    if (status === 'loading') {
        return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f', color: '#a855f7' }}>Loading...</div>;
    }

    return (
        <>
            <Navbar />
            <div style={{ minHeight: '100vh', background: '#0a0a0f', padding: '100px 20px 40px 20px', color: '#f1f5f9' }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    <Link href="/simulator" style={{ color: '#a855f7', textDecoration: 'none', fontSize: '14px', display: 'inline-block', marginBottom: '24px' }}>
                        ← Back to Modes
                    </Link>

                    <h1 style={{ fontSize: '36px', marginBottom: '16px' }}>🎯 Guided Scenarios</h1>
                    <p style={{ fontSize: '18px', color: '#64748b', marginBottom: '40px' }}>
                        Practice specific DeFi skills with structured tasks and clear objectives.
                    </p>

                    <div style={{ background: 'linear-gradient(135deg, #1e1e2f 0%, #2d2d44 100%)', border: '1px solid #3d3d5c', borderRadius: '16px', padding: '48px', textAlign: 'center' }}>
                        <span style={{ fontSize: '64px', display: 'block', marginBottom: '16px' }}>🚧</span>
                        <p style={{ color: '#94a3b8', marginBottom: '16px' }}>Scenarios coming soon!</p>
                        <p style={{ color: '#64748b', fontSize: '14px' }}>
                            We&apos;re creating guided challenges to help you learn:
                            <br />• Your first swap
                            <br />• Earning yield
                            <br />• Managing risk
                            <br />• And more...
                        </p>
                    </div>
            </div>
        </div >
    </>
  );
}
