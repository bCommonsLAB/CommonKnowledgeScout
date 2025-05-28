declare module '@welldone-software/why-did-you-render' {
  import * as React from 'react';
  const whyDidYouRender: (
    react: typeof React,
    options?: Record<string, unknown>
  ) => void;
  export default whyDidYouRender;
} 