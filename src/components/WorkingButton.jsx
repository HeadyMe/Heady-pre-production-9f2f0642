// Working Button Template
import React, { useState } from 'react';

const WorkingButton = ({ children, onClick, disabled = false, loading = false }) => {
  const [isLoading, setIsLoading] = useState(false);
  
  const handleClick = async (event) => {
    if (disabled || isLoading || loading) return;
    
    setIsLoading(true);
    try {
      await onClick(event);
    } catch (error) {
      console.error('Button action failed:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <button
      onClick={handleClick}
      disabled={disabled || isLoading || loading}
      type="button"
      aria-label={typeof children === 'string' ? children : 'Button'}
      className={`btn ${isLoading ? 'loading' : ''}`}
    >
      {isLoading ? 'Loading...' : children}
    </button>
  );
};

export default WorkingButton;