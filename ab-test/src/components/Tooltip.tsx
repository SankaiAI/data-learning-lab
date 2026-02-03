import { useState } from 'react';
import './Tooltip.css';

interface TooltipProps {
    content: string | React.ReactNode;
    children?: React.ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <span
            className="tooltip-wrapper"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children || <span className="tooltip-icon">?</span>}
            {isVisible && (
                <div className="tooltip-content">
                    {content}
                </div>
            )}
        </span>
    );
}

interface HelpTooltipProps {
    steps: string[];
    title?: string;
}

export function HelpTooltip({ steps, title }: HelpTooltipProps) {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <span
            className="tooltip-wrapper help-tooltip"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            <span className="tooltip-icon">?</span>
            {isVisible && (
                <div className="tooltip-content steps-tooltip">
                    {title && <div className="tooltip-title">{title}</div>}
                    <ol className="tooltip-steps">
                        {steps.map((step, index) => (
                            <li key={index}>{step}</li>
                        ))}
                    </ol>
                </div>
            )}
        </span>
    );
}
