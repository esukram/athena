/// <reference types="vite/client" />
import * as React from 'react';

declare module '*.png' {
  const value: string;
  export default value;
}

declare module '*.svg' {
  const value: string;
  export default value;
}
