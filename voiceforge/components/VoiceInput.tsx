'use client';

import { useEffect, useRef, useState } from 'react';

interface VoiceInputProps {
    isListening: boolean;
    setIsListening: (val: boolean) => void;
    status: 'idle' | 'listening' | 'processing';
    onCommand: (command: string) => void;
}

export default function VoiceInput({ isListening, setIsListening, status, onCommand }: VoiceInputProps) {
    const [isSupported, setIsSupported] = useState(true);
    const [interimText, setInterimText] = useState('');
    const [pendingCommand, setPendingCommand] = useState('');
    const [autoMode, setAutoMode] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        // Check for browser support
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setIsSupported(false);
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onresult = (event: any) => {
            const last = event.results.length - 1;
            const result = event.results[last];
            const transcript = result[0].transcript.trim();

            if (result.isFinal) {
                // Final result - set as pending command
                setPendingCommand(transcript);
                setInterimText('');

                // If auto mode, submit immediately
                if (autoMode && transcript) {
                    onCommand(transcript);
                    setPendingCommand('');
                }
            } else {
                // Interim result - show what user is saying
                setInterimText(transcript);
            }
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);

            // Handle specific errors
            if (event.error === 'not-allowed') {
                setError('Microphone access denied. Please allow microphone in browser settings.');
                setIsListening(false);
            } else if (event.error === 'no-speech') {
                // This is normal - just no speech detected, keep listening
                setError(null);
            } else if (event.error === 'audio-capture') {
                setError('No microphone found. Please connect a microphone.');
                setIsListening(false);
            } else if (event.error === 'network') {
                setError('Network error. Please check your connection.');
            } else {
                setError(`Error: ${event.error}`);
            }
        };

        recognition.onend = () => {
            // Auto-restart if still listening and no fatal error
            if (isListening && recognitionRef.current && !error) {
                setTimeout(() => {
                    try {
                        recognitionRef.current?.start();
                    } catch (e) {
                        // Already started or other issue
                    }
                }, 100);
            }
        };

        recognitionRef.current = recognition;

        return () => {
            recognition.abort();
        };
    }, [onCommand, setIsListening, isListening, autoMode]);

    useEffect(() => {
        if (!recognitionRef.current) return;

        if (isListening) {
            try {
                recognitionRef.current.start();
            } catch (e) {
                // Already started
            }
        } else {
            recognitionRef.current.stop();
        }
    }, [isListening]);

    const toggleListening = () => {
        setIsListening(!isListening);
        if (!isListening) {
            setPendingCommand('');
            setInterimText('');
        }
    };

    const handleSubmit = () => {
        if (pendingCommand) {
            onCommand(pendingCommand);
            setPendingCommand('');
        }
    };

    const handleClear = () => {
        setPendingCommand('');
        setInterimText('');
    };

    if (!isSupported) {
        return (
            <div className="text-center p-4 bg-red-50 rounded-xl">
                <p className="text-red-600 text-sm">
                    Voice input not supported in this browser.
                    Please use Chrome or Edge.
                </p>
            </div>
        );
    }

    return (
        <div className="text-center">
            {/* Auto Mode Toggle */}
            <div className="flex items-center justify-center gap-2 mb-4">
                <span className="text-xs text-gray-500">Manual</span>
                <button
                    onClick={() => setAutoMode(!autoMode)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${autoMode ? 'bg-orange-500' : 'bg-gray-300'
                        }`}
                >
                    <span
                        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${autoMode ? 'left-7' : 'left-1'
                            }`}
                    />
                </button>
                <span className="text-xs text-gray-500">Auto</span>
            </div>

            {/* Mic Button */}
            <button
                onClick={toggleListening}
                disabled={status === 'processing'}
                className={`
                    w-20 h-20 rounded-full flex items-center justify-center mx-auto
                    transition-all duration-300 shadow-lg
                    ${isListening
                        ? 'bg-gradient-to-r from-red-500 to-pink-500 animate-pulse shadow-red-200'
                        : 'bg-gradient-to-r from-orange-500 to-pink-500 hover:scale-105 shadow-orange-200'
                    }
                    ${status === 'processing' ? 'opacity-50 cursor-not-allowed' : ''}
                `}
            >
                <span className="text-3xl">
                    {status === 'processing' ? '⏳' : isListening ? '🔴' : '🎤'}
                </span>
            </button>

            <p className="mt-3 text-xs font-medium text-gray-500">
                {status === 'processing' && 'Processing...'}
                {status === 'idle' && !isListening && 'Click to start'}
                {status === 'idle' && isListening && 'Listening...'}
            </p>

            {/* Error Display */}
            {error && (
                <div className="mt-2 p-2 bg-red-50 rounded-lg">
                    <p className="text-xs text-red-600">{error}</p>
                </div>
            )}

            {/* Live Transcript Box */}
            <div className="mt-4 p-3 bg-gray-100 rounded-lg min-h-[60px] text-left">
                <p className="text-xs text-gray-400 mb-1">What I heard:</p>
                <p className="text-sm text-gray-800">
                    {interimText && <span className="text-gray-400 italic">{interimText}</span>}
                    {pendingCommand && <span className="font-medium">{pendingCommand}</span>}
                    {!interimText && !pendingCommand && (
                        <span className="text-gray-300">Speak a command...</span>
                    )}
                </p>
            </div>

            {/* Text Input Fallback */}
            <div className="mt-4">
                <p className="text-xs text-gray-400 mb-2">Or type a command:</p>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={pendingCommand}
                        onChange={(e) => setPendingCommand(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && pendingCommand) {
                                handleSubmit();
                            }
                        }}
                        placeholder="e.g. add a red button"
                        className="flex-1 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
                    />
                    <button
                        onClick={handleSubmit}
                        disabled={!pendingCommand || status === 'processing'}
                        className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-orange-500 to-pink-500 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Go
                    </button>
                </div>
            </div>

            {/* Submit / Clear Buttons (only in manual mode with voice) */}
            {!autoMode && pendingCommand && !error && (
                <div className="mt-3 flex gap-2">
                    <button
                        onClick={handleClear}
                        disabled={!pendingCommand}
                        className="flex-1 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Clear
                    </button>
                </div>
            )}

            {/* Audio Visualizer */}
            {isListening && (
                <div className="mt-3 flex justify-center gap-1">
                    {[...Array(5)].map((_, i) => (
                        <div
                            key={i}
                            className="w-1 bg-orange-400 rounded-full animate-pulse"
                            style={{
                                height: `${12 + Math.random() * 12}px`,
                                animationDelay: `${i * 0.1}s`
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// Web Speech API types - using any to avoid conflicts with browser types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const SpeechRecognition: any;
declare global {
    interface Window {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        SpeechRecognition: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        webkitSpeechRecognition: any;
    }
}

export { };
