'use client';

interface AppElement {
    id: string;
    type: 'div' | 'button' | 'text' | 'input' | 'image' | 'container';
    props: Record<string, string>;
    content?: string;
}

interface CanvasPreviewProps {
    elements: AppElement[];
}

export default function CanvasPreview({ elements }: CanvasPreviewProps) {
    const renderElement = (element: AppElement) => {
        const { id, type, props, content } = element;
        const style = propsToStyle(props);

        switch (type) {
            case 'button':
                return (
                    <button key={id} style={style} className="cursor-pointer">
                        {content || 'Button'}
                    </button>
                );
            case 'text':
                return (
                    <p key={id} style={style}>
                        {content || 'Text'}
                    </p>
                );
            case 'input':
                return (
                    <input
                        key={id}
                        type="text"
                        placeholder={content || 'Enter text...'}
                        style={style}
                        className="outline-none"
                    />
                );
            case 'div':
                return (
                    <div key={id} style={style}>
                        {content}
                    </div>
                );
            case 'image':
                return (
                    <div key={id} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        🖼️
                    </div>
                );
            case 'container':
                return (
                    <div key={id} style={{ ...style, minWidth: '200px', minHeight: '100px' }}>
                        {content}
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="h-full p-6 flex flex-col items-center gap-4 overflow-auto bg-white">
            {elements.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-gray-300 text-lg">
                    <div className="text-center">
                        <span className="text-5xl block mb-4">✨</span>
                        <p>Type a command to build your app</p>
                        <p className="text-sm mt-2">e.g. "a blue button that says Click Me"</p>
                    </div>
                </div>
            ) : (
                elements.map(renderElement)
            )}
        </div>
    );
}

// Convert props object to React inline styles
function propsToStyle(props: Record<string, string>): React.CSSProperties {
    const style: React.CSSProperties = {};

    if (props.color) {
        style.backgroundColor = props.color;
        style.color = getContrastColor(props.color);
    }
    if (props.textColor) {
        style.color = props.textColor;
    }
    if (props.size === 'small') {
        style.padding = '8px 16px';
        style.fontSize = '14px';
    } else if (props.size === 'large') {
        style.padding = '16px 32px';
        style.fontSize = '20px';
    } else {
        style.padding = '12px 24px';
        style.fontSize = '16px';
    }
    if (props.rounded === 'true' || props.rounded === 'full') {
        style.borderRadius = props.rounded === 'full' ? '9999px' : '8px';
    } else {
        style.borderRadius = '8px';
    }

    // Default styling
    style.border = 'none';
    style.fontWeight = 500;
    style.transition = 'all 0.2s';

    return style;
}

// Get contrasting text color
function getContrastColor(bgColor: string): string {
    const lightColors = ['yellow', 'white', 'lime', 'cyan', 'pink', 'orange', '#fff', '#ffffff'];
    return lightColors.some(c => bgColor.toLowerCase().includes(c)) ? '#333' : '#fff';
}
