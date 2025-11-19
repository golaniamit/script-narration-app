import React from 'react';

const Card = ({ children, className = '', title, ...props }) => {
    return (
        <div className={`card ${className}`} {...props}>
            {title && <h3 style={{ marginBottom: '1rem', color: 'var(--text-accent)' }}>{title}</h3>}
            {children}
        </div>
    );
};

export default Card;
