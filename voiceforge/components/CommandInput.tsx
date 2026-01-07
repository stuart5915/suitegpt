'use client';

import { useState } from 'react';

interface CommandInputProps {
    onCommand: (command: string) => void;
    status: 'idle' | 'processing';
}

export default function CommandInput({ onCommand, status }: CommandInputProps) {
    const [command, setCommand] = useState('');

    const handleSubmit = () => {
        if (command.trim() && status !== 'processing') {
            onCommand(command.trim());
            setCommand('');
        }
    };

    return (
        <div className="space-y-4">
            {/* Main Input */}
            <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                    What do you want to build?
                </label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleSubmit();
                            }
                        }}
                        placeholder="e.g. add a red button that says Click Me"
                        disabled={status === 'processing'}
                        className="flex-1 px-4 py-3 text-sm text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-300 disabled:opacity-50"
                    />
                    <button
                        onClick={handleSubmit}
                        disabled={!command.trim() || status === 'processing'}
                        className="px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-pink-500 rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
                    >
                        {status === 'processing' ? '⏳' : 'Build →'}
                    </button>
                </div>
            </div>

            {/* Status */}
            {status === 'processing' && (
                <div className="flex items-center gap-2 text-sm text-orange-600">
                    <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                    <span>AI is building...</span>
                </div>
            )}

            {/* Quick Commands */}
            <div>
                <p className="text-xs text-gray-400 mb-2">Try these:</p>
                <div className="flex flex-wrap gap-2">
                    {[
                        'red button',
                        'blue circle',
                        'header that says Welcome',
                        'input field',
                        'green box',
                    ].map((suggestion) => (
                        <button
                            key={suggestion}
                            onClick={() => setCommand(suggestion)}
                            className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                        >
                            {suggestion}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
