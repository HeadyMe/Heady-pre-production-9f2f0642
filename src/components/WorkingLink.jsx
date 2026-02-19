// Working Link Template
import React from 'react';
import { useNavigate } from 'react-router-dom';

const WorkingLink = ({ href, children, external = false, onClick }) => {
  const navigate = useNavigate();
  
  const handleClick = (event) => {
    if (onClick) {
      onClick(event);
    }
    
    if (external) {
      // Open external link
      window.open(href, '_blank', 'noopener,noreferrer');
    } else {
      // Internal navigation
      event.preventDefault();
      navigate(href);
    }
  };
  
  return (
    <a
      href={href}
      onClick={handleClick}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
    >
      {children}
    </a>
  );
};

export default WorkingLink;