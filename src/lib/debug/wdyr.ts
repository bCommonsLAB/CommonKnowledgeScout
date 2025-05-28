import React from 'react';

if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  import('@welldone-software/why-did-you-render').then(({ default: whyDidYouRender }) => {
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
  });
} 