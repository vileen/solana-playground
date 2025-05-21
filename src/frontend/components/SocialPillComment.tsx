import React from 'react';

interface SocialPillCommentProps {
  text: string;
  style?: React.CSSProperties;
  className?: string;
}

const SocialPillComment: React.FC<SocialPillCommentProps> = ({ text, style, className }) => {
  if (!text) return null;
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        alignSelf: 'flex-start',
        background: '#43a047',
        color: '#fff',
        borderRadius: 6,
        fontWeight: 600,
        fontSize: 14,
        padding: '2px 10px',
        lineHeight: 1.2,
        ...style,
      }}
    >
      {text}
    </span>
  );
};

export default SocialPillComment; 