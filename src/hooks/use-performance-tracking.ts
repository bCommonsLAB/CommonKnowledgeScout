import { useEffect, useRef } from 'react';

export function usePerformanceTracking(componentName: string, deps: any[]) {
  const renderCount = useRef(0);
  const lastRender = useRef(performance.now());

  useEffect(() => {
    renderCount.current++;
    const now = performance.now();
    const timeSinceLastRender = now - lastRender.current;
    
    console.group(`${componentName} Performance`);
    console.log(`Render #${renderCount.current}`);
    console.log(`Time since last render: ${timeSinceLastRender.toFixed(2)}ms`);
    console.log('Changed dependencies:', deps);
    console.groupEnd();

    lastRender.current = now;
  }, deps);
} 