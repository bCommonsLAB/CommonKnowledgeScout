import React from 'react';

if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  const whyDidYouRender = require('@welldone-software/why-did-you-render');
  
  whyDidYouRender(React, {
    trackAllPureComponents: true,
    trackHooks: true,
    trackExtraHooks: [
      ['useSelectedFile'],
      ['useTranscriptionTwins']
    ],
    logOnDifferentValues: true,
    collapseGroups: false,
    onlyLogs: false,
    titleColor: "green",
    diffNameColor: "darkturquoise",
    customName: 'Library Components',
  });
} 