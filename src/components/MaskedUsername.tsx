
import React from 'react';

interface MaskedUsernameProps {
  username: string;
  showChars?: number;
  className?: string;
}

const MaskedUsername: React.FC<MaskedUsernameProps> = ({ 
  username, 
  showChars = 3,
  className = ""
}) => {
  if (!username) return <span className={className}>Unknown</span>;
  
  // Show the first 'showChars' characters followed by asterisks
  const visiblePart = username.slice(0, showChars);
  const hiddenPart = '*'.repeat(Math.min(username.length - showChars, 5));
  
  return (
    <span className={className} title="Username is partially hidden for privacy">
      {visiblePart}{hiddenPart}
    </span>
  );
};

export default MaskedUsername;
