import React from 'react';

interface SocialPillXProps {
  handle: string;
  style?: React.CSSProperties;
  className?: string;
}

const SocialPillX: React.FC<SocialPillXProps> = ({ handle, style, className }) => {
  if (!handle) return null;
  const xUrl = `https://x.com/${handle.replace('@', '')}`;
  return (
    <a
      href={xUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: '#000',
        color: '#fff',
        borderRadius: 6,
        fontWeight: 600,
        fontSize: 14,
        padding: '2px 10px 2px 6px',
        lineHeight: 1.2,
        textDecoration: 'none',
        ...style,
      }}
    >
      <img
        src="/x.svg"
        alt="X"
        width={14}
        height={14}
        style={{ marginRight: 6, verticalAlign: 'middle' }}
      />
      {handle}
    </a>
  );
};

export default SocialPillX; 