import React from 'react';
import Svg, { Path } from 'react-native-svg';

export default function BackIcon() {
  return (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 12H5"
        stroke="#4C4C4C"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 19L5 12L12 5"
        stroke="#4C4C4C"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

