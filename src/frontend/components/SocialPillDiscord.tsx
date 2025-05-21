import React from 'react';

interface SocialPillDiscordProps {
  handle: string;
  style?: React.CSSProperties;
  className?: string;
}

const SocialPillDiscord: React.FC<SocialPillDiscordProps> = ({ handle, style, className }) => {
  if (!handle) return null;
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: '#5865F2',
        color: '#fff',
        borderRadius: 6,
        fontWeight: 600,
        fontSize: 14,
        padding: '2px 10px 2px 6px',
        lineHeight: 1.2,
        ...style,
      }}
    >
      <i className="pi pi-discord" style={{ marginRight: 6, fontSize: 16 }} />
      {handle}
    </span>
  );
};

export default SocialPillDiscord; 