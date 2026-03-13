'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import ModeCard from '@/components/simulator/ModeCard';

export default function SimulatorHub() {
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
            <div className="simulator-hub">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="hub-content"
                >
                    <h1>Choose Your Mode</h1>
                    <p className="subtitle">Select how you want to learn DeFi today</p>

                    <div className="modes-grid">
                        <ModeCard
                            icon="🎮"
                            title="Sandbox Mode"
                            description="Free play - experiment with all platforms and features at your own pace"
                            href="/simulator/sandbox"
                            color="purple"
                            badge="Popular"
                        />
                        <ModeCard
                            icon="🎯"
                            title="Guided Scenarios"
                            description="Complete specific tasks and challenges designed to teach DeFi concepts"
                            href="/simulator/scenarios"
                            color="blue"
                        />
                        <ModeCard
                            icon="📚"
                            title="Tutorial Mode"
                            description="Step-by-step walkthrough perfect for absolute beginners"
                            href="/simulator/tutorial"
                            color="orange"
                            badge="Coming Soon"
                        />
                    </div>
                </motion.div>

                <style jsx>{`
          .simulator-hub {
            min-height: 100vh;
            background: #0a0a0f;
            padding: 100px 20px 40px 20px;
          }

          .hub-content {
            max-width: 1200px;
            margin: 0 auto;
          }

          .hub-content h1 {
            font-size: 48px;
            font-weight: 800;
            color: #f1f5f9;
            margin: 0 0 12px 0;
            text-align: center;
          }

          .subtitle {
            font-size: 20px;
            color: #64748b;
            margin: 0 0 60px 0;
            text-align: center;
          }

          .modes-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 24px;
          }

          @media (max-width: 768px) {
            .hub-content h1 {
              font-size: 36px;
            }
            .modes-grid {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
            </div>
        </>
    );
}
