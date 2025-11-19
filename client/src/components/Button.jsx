import React from 'react';

const Button = ({ children, onClick, variant = 'primary', className = '', ...props }) => {
    const baseClass = 'btn';
    const variantClass = variant === 'primary' ? 'btn-primary' : 'btn-secondary';

    // Secondary style (if not defined in global CSS yet, we can add inline or rely on class)
    const secondaryStyle = variant === 'secondary' ? {
        backgroundColor: 'var(--bg-card)',
        color: 'var(--text-primary)',
        border: '1px solid rgba(255,255,255,0.1)'
    } : {};

    return (
        <button
            className={`${baseClass} ${variantClass} ${className}`}
            onClick={onClick}
            style={variant === 'secondary' ? secondaryStyle : {}}
            {...props}
        >
            {children}
        </button>
    );
};

export default Button;
