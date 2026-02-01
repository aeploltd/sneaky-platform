import React from 'react';
import { CircularProgress, Box } from '@mui/material';

interface LoadingSpinnerProps {
  size?: number;
  color?: 'primary' | 'secondary' | 'inherit';
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 40, 
  color = 'primary' 
}) => {
  return (
    <Box display="flex" justifyContent="center" alignItems="center">
      <CircularProgress size={size} color={color} />
    </Box>
  );
};

export default LoadingSpinner;