import React from 'react';
import Svg, { Path } from 'react-native-svg';

export default function DropdownArrowIcon() {
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
      <Path
        d="M3 4.5L6 7.5L9 4.5"
        stroke="#1A1A1A"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

